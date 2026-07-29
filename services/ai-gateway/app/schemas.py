from __future__ import annotations

from typing import Literal
import unicodedata

from pydantic import BaseModel, Field, ValidationInfo, field_validator, model_validator


_PLACEHOLDERS = {
    "gancho", "ganchos", "cena", "cenas", "fala", "falas", "exercicio",
    "exercicios", "captacao", "captação", "edicao", "edição", "texto",
    "visual", "cta", "legenda", "hashtag", "hashtags",
}


def _useful_text(value: str) -> str:
    cleaned = value.strip()
    normalized = "".join(
        char for char in unicodedata.normalize("NFKD", cleaned.casefold())
        if not unicodedata.combining(char)
    ).strip(" .,:;!?-_")
    if normalized in _PLACEHOLDERS or len(cleaned) < 8:
        raise ValueError("texto genérico ou curto demais")
    return cleaned


class ContentScene(BaseModel):
    order: int = Field(ge=1, le=8)
    visual: str = Field(min_length=8, max_length=500)
    speech: str = Field(min_length=8, max_length=800)
    duration_seconds: int = Field(ge=2, le=20)

    @field_validator("visual", "speech")
    @classmethod
    def scene_text_must_be_useful(cls, value: str) -> str:
        return _useful_text(value)


class ContentPackage(BaseModel):
    objective: str = Field(min_length=8, max_length=500)
    hooks: list[str] = Field(min_length=3, max_length=3)
    scenes: list[ContentScene] = Field(min_length=2, max_length=8)
    capture_notes: list[str] = Field(default_factory=list, max_length=8)
    editing_notes: list[str] = Field(default_factory=list, max_length=8)
    caption: str = Field(min_length=8, max_length=2200)
    cta: str = Field(min_length=8, max_length=300)
    hashtags: list[str] = Field(default_factory=list, max_length=10)
    suggested_time: str | None = None

    @field_validator("objective", "caption", "cta")
    @classmethod
    def main_text_must_be_useful(cls, value: str) -> str:
        return _useful_text(value)

    @field_validator("hooks")
    @classmethod
    def hooks_must_be_specific(cls, values: list[str]) -> list[str]:
        cleaned = [_useful_text(value) for value in values]
        if len({value.casefold() for value in cleaned}) != len(cleaned):
            raise ValueError("ganchos duplicados")
        return cleaned

    @field_validator("capture_notes", "editing_notes")
    @classmethod
    def notes_must_be_specific(cls, values: list[str]) -> list[str]:
        return [_useful_text(value) for value in values]

    @model_validator(mode="after")
    def enforce_short_video_contract(self, info: ValidationInfo) -> "ContentPackage":
        total = sum(scene.duration_seconds for scene in self.scenes)
        content_format = str((info.context or {}).get("format", "short-video"))
        if content_format != "carousel":
            maximum = 45 if content_format == "story" else 60
            if total < 15 or total > maximum:
                raise ValueError(f"roteiro deve durar entre 15 e {maximum} segundos")
        orders = [scene.order for scene in self.scenes]
        if orders != list(range(1, len(self.scenes) + 1)):
            raise ValueError("cenas devem ter ordem sequencial")
        signatures = {(scene.visual.casefold(), scene.speech.casefold()) for scene in self.scenes}
        if len(signatures) != len(self.scenes):
            raise ValueError("cenas duplicadas")
        return self


class PlanItem(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    platform: Literal["instagram", "tiktok"]
    format: str = Field(min_length=1, max_length=100)
    scheduled_for: str | None = None
    rationale: str = Field(min_length=1, max_length=1000)


class WeeklyPlanResult(BaseModel):
    rationale: str = Field(min_length=1, max_length=2000)
    items: list[PlanItem] = Field(min_length=1, max_length=21)


class MemorySuggestion(BaseModel):
    category: str = Field(min_length=1, max_length=100)
    content: str = Field(min_length=1, max_length=1000)
    confidence: float = Field(ge=0, le=1)
    sensitivity: Literal["normal", "sensitive"] = "normal"


class MemoryExtractionResult(BaseModel):
    suggestions: list[MemorySuggestion] = Field(default_factory=list, max_length=20)


class ConversationSummaryResult(BaseModel):
    summary: str = Field(min_length=1, max_length=8000)
    pending_items: list[str] = Field(default_factory=list, max_length=30)


class TrendInterpretationResult(BaseModel):
    summary: str = Field(min_length=1, max_length=3000)
    recommendations: list[str] = Field(default_factory=list, max_length=20)
    evidence_ids: list[str] = Field(default_factory=list, max_length=100)


RESULT_MODELS = {
    "plan.generate": WeeklyPlanResult,
    "plan.revise": WeeklyPlanResult,
    "content.generate": ContentPackage,
    "content.revise": ContentPackage,
    "memories.extract": MemoryExtractionResult,
    "conversations.summarize": ConversationSummaryResult,
    "trends.research": TrendInterpretationResult,
}


def validate_result(kind: str, value: object, payload: dict | None = None) -> dict:
    model = RESULT_MODELS.get(kind)
    if model is None:
        raise ValueError(f"Unsupported job kind: {kind}")
    context = {"format": (payload or {}).get("format", "short-video")}
    return model.model_validate(value, context=context).model_dump(mode="json")


def json_schema_for(kind: str) -> dict:
    model = RESULT_MODELS.get(kind)
    if model is None:
        raise ValueError(f"Unsupported job kind: {kind}")
    return model.model_json_schema()


def ollama_schema_for(kind: str) -> dict:
    """Remove large string bounds that Ollama cannot compile into a grammar."""
    schema = json_schema_for(kind)

    def strip_runtime_bounds(value: object) -> None:
        if isinstance(value, dict):
            value.pop("maxLength", None)
            for child in value.values():
                strip_runtime_bounds(child)
        elif isinstance(value, list):
            for child in value:
                strip_runtime_bounds(child)

    strip_runtime_bounds(schema)
    return schema
