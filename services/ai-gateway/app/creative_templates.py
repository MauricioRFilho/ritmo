from __future__ import annotations

import json
from typing import Any

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
}

FORMAT_TEMPLATE = {
    "carousel": "instagram_carousel",
    "reel": "short_video",
    "short-video": "short_video",
    "story": "short_video",
}


def select_template(payload: dict[str, Any]) -> str:
    requested = str(payload.get("creative_type") or payload.get("template_type") or "")
    if requested in TEMPLATE_GUIDANCE:
        return requested
    return FORMAT_TEMPLATE.get(str(payload.get("format", "short-video")), "short_video")


def creative_library_context(payload: dict[str, Any]) -> str:
    template_type = select_template(payload)
    return json.dumps({"template_type": template_type, **TEMPLATE_GUIDANCE[template_type]}, ensure_ascii=False)


def normalize_legacy_template(value: dict[str, Any]) -> dict[str, Any]:
    """Wrap v0 examples without mutating or discarding their specific payload."""
    if value.get("schema_version") == 1 and value.get("creative_type") in TEMPLATE_GUIDANCE:
        return value
    legacy_type = str(value.get("creator_type", ""))
    if legacy_type not in TEMPLATE_GUIDANCE:
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
