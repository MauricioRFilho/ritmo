from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

MODULE_PATH = Path(__file__).resolve()
MODEL_CANDIDATES = [MODULE_PATH.parents[1] / "modelos"]
if len(MODULE_PATH.parents) > 3:
    MODEL_CANDIDATES.append(MODULE_PATH.parents[3] / "modelos")
MODELS_DIR = next((path for path in MODEL_CANDIDATES if (path / "library.json").is_file()), MODEL_CANDIDATES[0])
CREATIVE_TYPES = {"advertising_image", "instagram_carousel", "short_video", "tech_educational_video", "ugc_ad", "story_sequence", "live_stream", "newsletter"}

TEMPLATE_GUIDANCE: dict[str, dict[str, Any]] = {
    "advertising_image": {
        "structure": ["single_message", "focal_point", "scene", "art_direction", "text_overlay", "negative_prompt"],
        "rules": ["um único foco visual", "pouco texto legível", "variações por conceito", "alegações exigem evidência"],
    },
    "instagram_carousel": {
        "structure": ["cover_hook", "one_idea_per_slide", "progression", "summary", "call_to_action"],
        "rules": ["até 10 cards", "primeiro card promete valor", "ordem bloqueada em narrativa", "CTA no último card"],
    },
    "short_video": {
        "structure": ["hook", "body_value", "proof_or_demo", "close", "call_to_action"],
        "rules": ["9:16", "valor nos primeiros 3 segundos", "20–45 segundos", "safe zone", "fala literal e filmável"],
    },
    "tech_educational_video": {
        "structure": ["learner_problem", "promised_outcome", "prerequisites", "steps", "verification", "limitations", "recap", "next_action"],
        "rules": ["cada passo tem demonstração", "definir termos", "mostrar resultado observável", "citar fonte para alegações"],
    },
    "ugc_ad": {
        "structure": ["personal_hook", "relatable_problem", "product_in_use", "concrete_benefit", "proof", "qualification", "offer", "call_to_action"],
        "rules": ["voz natural", "prova visual para benefício", "não inventar depoimento", "disclosure e direitos explícitos"],
    },
    "story_sequence": {"structure": ["opening", "interaction", "development", "call_to_action"], "rules": ["até 15 segundos por quadro", "elemento interativo"]},
    "live_stream": {"structure": ["opening", "agenda", "segments", "questions", "close"], "rules": ["moderador definido", "plano de contingência"]},
    "newsletter": {"structure": ["subject", "preheader", "opening", "sections", "call_to_action"], "rules": ["assunto específico", "um CTA principal", "alegações com fonte"]},
}

FORMAT_TEMPLATE = {
    "carousel": "instagram_carousel",
    "reel": "short_video",
    "short-video": "short_video",
    "story": "short_video",
    "live": "live_stream",
    "email": "newsletter",
    "image": "advertising_image",
}

class TemplateSelection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    template_id: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    template_version: int = Field(ge=1)
    adaptation_brief: str = Field(min_length=8, max_length=4000)


def require_template_reference(payload: dict[str, Any]) -> tuple[str, int]:
    try:
        template_id = str(UUID(str(payload["template_id"])))
        version = int(payload["template_version"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("template_id UUID e template_version são obrigatórios") from exc
    if version < 1:
        raise ValueError("template_version deve ser positivo")
    return template_id, version

def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8-sig"))

def load_library() -> dict[str, Any]:
    return _read_json(MODELS_DIR / "library.json")

def load_approved_template(template_id: str) -> dict[str, Any]:
    library = load_library()
    entry = next((item for item in library["templates"] if item["id"] == template_id), None)
    if not entry or entry.get("status", "approved") != "approved": raise ValueError("template inexistente ou não aprovado")
    spec = normalize_legacy_template(_read_json(MODELS_DIR / entry["source"]))
    if spec["creative_type"] != entry["creative_type"]: raise ValueError("tipo do template diverge do catálogo")
    spec["provenance"] = {**spec.get("provenance", {}), "template_id": template_id, "template_version": int(spec.get("provenance", {}).get("template_version", 1)), "catalog": library["library_id"]}
    return spec

def approved_template_summary() -> list[dict[str, Any]]:
    return [{"id": item["id"], "creative_type": item["creative_type"], "status": item.get("status", "approved")} for item in load_library()["templates"] if item.get("status", "approved") == "approved"]

def sync_official_templates(client: Any) -> int:
    rows = []
    for entry in approved_template_summary():
        spec = load_approved_template(entry["id"])
        metadata = spec.get("metadata", {})
        rows.append({
            "template_key": entry["id"], "version": spec["provenance"]["template_version"],
            "origin": "official", "title": metadata.get("title", entry["id"]),
            "summary": metadata.get("objective", "Modelo oficial aprovado pelo Ritmo"),
            "creative_type": entry["creative_type"],
            "format": metadata.get("format", entry["creative_type"]),
            "platform": metadata.get("platform", "multi"),
            "objective": metadata.get("objective", "Criar conteúdo original"),
            "niches": metadata.get("niches", []), "tags": metadata.get("tags", []),
            "schema_version": spec.get("schema_version", 1), "template_json": spec,
            "editorial_status": "approved", "performance_status": "unmeasured", "active": True,
        })
    existing_result = client.table("creative_template_catalog").select(
        "template_key,version,template_json"
    ).eq("origin", "official").execute()
    existing = {(item["template_key"], item["version"]): item["template_json"] for item in (existing_result.data or [])}
    missing = []
    for row in rows:
        key = (row["template_key"], row["version"])
        if key in existing:
            if json.dumps(existing[key], ensure_ascii=False, sort_keys=True) != json.dumps(row["template_json"], ensure_ascii=False, sort_keys=True):
                raise ValueError(f"template oficial imutável divergiu: {key[0]}@{key[1]}")
        else:
            missing.append(row)
    if missing:
        client.table("creative_template_catalog").insert(missing).execute()
    return len(rows)


def select_template(payload: dict[str, Any]) -> str:
    template_id = payload.get("template_id")
    if isinstance(template_id, str) and template_id: return load_approved_template(template_id)["creative_type"]
    requested = str(payload.get("creative_type") or payload.get("template_type") or "")
    if requested in TEMPLATE_GUIDANCE:
        return requested
    return FORMAT_TEMPLATE.get(str(payload.get("format", "short-video")), "short_video")


def creative_library_context(payload: dict[str, Any]) -> str:
    template_id = payload.get("template_id")
    if isinstance(template_id, str) and template_id:
        spec = payload.get("approved_template")
        if not isinstance(spec, dict):
            raise ValueError("spec aprovada ausente do payload server-side")
        creative_type = str(spec.get("creative_type") or payload.get("creative_type"))
        if creative_type not in TEMPLATE_GUIDANCE:
            raise ValueError("tipo criativo aprovado não suportado")
        return json.dumps({"template_id": template_id, "creative_type": creative_type, "structure": TEMPLATE_GUIDANCE[creative_type]["structure"], "rules": TEMPLATE_GUIDANCE[creative_type]["rules"], "reference_spec": spec.get("creative", spec), "provenance": spec.get("provenance", payload.get("template_provenance", {})), "adaptation_policy": "Use apenas a estrutura. Não copie frases, personagens, claims, marcas ou execução literal."}, ensure_ascii=False)
    template_type = select_template(payload)
    return json.dumps({"template_type": template_type, **TEMPLATE_GUIDANCE[template_type]}, ensure_ascii=False)


def normalize_legacy_template(value: dict[str, Any]) -> dict[str, Any]:
    """Wrap v0 examples without mutating or discarding their specific payload."""
    if value.get("schema_version") == 1 and value.get("creative_type") in CREATIVE_TYPES:
        return value
    legacy_type = str(value.get("creator_type", ""))
    if legacy_type not in CREATIVE_TYPES:
        raise ValueError(f"unsupported creative type: {legacy_type}")
    title = (
        value.get("project", {}).get("title")
        or value.get("project", {}).get("name")
        or value.get("campaign", {}).get("campaign_name")
        or legacy_type
    )
    return {
        "schema_version": 1,
        "creative_type": legacy_type,
        "metadata": {"title": title, "language": "pt-BR", "tags": []},
        "creative": value,
        "provenance": {"origin": "seed", "legacy_schema": 0},
    }
