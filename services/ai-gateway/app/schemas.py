from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ContentScene(BaseModel):
    order: int = Field(ge=1)
    visual: str = Field(min_length=1, max_length=1000)
    speech: str = Field(min_length=1, max_length=2000)
    duration_seconds: int = Field(ge=1, le=300)


class ContentPackage(BaseModel):
    objective: str = Field(min_length=1, max_length=500)
    hooks: list[str] = Field(min_length=1, max_length=5)
    scenes: list[ContentScene] = Field(min_length=1, max_length=30)
    capture_notes: list[str] = Field(default_factory=list, max_length=20)
    editing_notes: list[str] = Field(default_factory=list, max_length=20)
    caption: str = Field(min_length=1, max_length=5000)
    cta: str = Field(min_length=1, max_length=500)
    hashtags: list[str] = Field(default_factory=list, max_length=30)
    suggested_time: str | None = None


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


def validate_result(kind: str, value: object) -> dict:
    model = RESULT_MODELS.get(kind)
    if model is None:
        raise ValueError(f"Unsupported job kind: {kind}")
    return model.model_validate(value).model_dump(mode="json")


def json_schema_for(kind: str) -> dict:
    model = RESULT_MODELS.get(kind)
    if model is None:
        raise ValueError(f"Unsupported job kind: {kind}")
    return model.model_json_schema()
