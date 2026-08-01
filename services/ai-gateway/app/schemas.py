from __future__ import annotations

from typing import Annotated, Literal, Union
import unicodedata

from pydantic import BaseModel, Field, RootModel, ValidationInfo, field_validator, model_validator


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


class CreativeIdea(BaseModel):
    title: str = Field(min_length=8, max_length=160)
    concept: str = Field(min_length=12, max_length=500)
    hook: str = Field(min_length=8, max_length=240)
    scenes: list[ContentScene] = Field(min_length=3, max_length=8)
    narration: str = Field(min_length=20, max_length=1800)
    final_line: str = Field(min_length=8, max_length=300)
    text_overlays: list[str] = Field(default_factory=list, max_length=8)
    capture_notes: list[str] = Field(default_factory=list, max_length=10)
    editing_notes: list[str] = Field(default_factory=list, max_length=8)

    @field_validator("title", "concept", "hook", "narration", "final_line")
    @classmethod
    def idea_text_must_be_useful(cls, value: str) -> str:
        return _useful_text(value)

    @field_validator("text_overlays", "capture_notes", "editing_notes")
    @classmethod
    def idea_notes_must_be_specific(cls, values: list[str]) -> list[str]:
        return [_useful_text(value) for value in values]


class CreatorServicePackage(BaseModel):
    objective: str = Field(min_length=8, max_length=500)
    recommended_idea_index: int = Field(ge=1, le=3)
    ideas: list[CreativeIdea] = Field(min_length=3, max_length=3)
    caption: str = Field(min_length=8, max_length=2200)
    cta: str = Field(min_length=8, max_length=300)
    hashtags: list[str] = Field(min_length=3, max_length=10)
    suggested_time: str | None = None

    @field_validator("objective", "caption", "cta")
    @classmethod
    def package_text_must_be_useful(cls, value: str) -> str:
        return _useful_text(value)

    @model_validator(mode="after")
    def enforce_complete_service(self, info: ValidationInfo) -> "CreatorServicePackage":
        if len({idea.title.casefold() for idea in self.ideas}) != 3 or len({idea.hook.casefold() for idea in self.ideas}) != 3:
            raise ValueError("as três ideias devem ter títulos e ganchos diferentes")
        content_format = str((info.context or {}).get("format", "short-video"))
        maximum = None if content_format == "carousel" else 45 if content_format == "story" else 60
        for idea in self.ideas:
            duration = sum(scene.duration_seconds for scene in idea.scenes)
            if maximum is not None and (duration < 15 or duration > maximum):
                raise ValueError(f"cada ideia deve durar entre 15 e {maximum} segundos")
            if [scene.order for scene in idea.scenes] != list(range(1, len(idea.scenes) + 1)):
                raise ValueError("cenas devem ter ordem sequencial em cada ideia")
        return self


class ContentPackage(BaseModel):
    creative_type: Literal["advertising_image", "instagram_carousel", "short_video", "tech_educational_video", "ugc_ad", "story_sequence", "live_stream", "newsletter"] | None = None
    template_provenance: dict | None = None
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


class ProvenancedCreative(BaseModel):
    template_provenance: dict | None = None
    objective: str = Field(min_length=8, max_length=500)
    cta: str = Field(min_length=8, max_length=300)


class AdvertisingImagePackage(ProvenancedCreative):
    creative_type: Literal["advertising_image"]
    headline: str = Field(min_length=8, max_length=120)
    visual_direction: str = Field(min_length=12, max_length=1000)
    overlay_text: str = Field(min_length=3, max_length=160)
    caption: str = Field(min_length=8, max_length=2200)


class CarouselSlide(BaseModel):
    order: int = Field(ge=1, le=10)
    text: str = Field(min_length=8, max_length=500)
    visual: str = Field(min_length=8, max_length=500)
    alt_text: str = Field(min_length=8, max_length=500)


class InstagramCarouselPackage(ProvenancedCreative):
    creative_type: Literal["instagram_carousel"]
    cover_hook: str = Field(min_length=8, max_length=160)
    slides: list[CarouselSlide] = Field(min_length=3, max_length=10)
    caption: str = Field(min_length=8, max_length=2200)


class ShortVideoPackage(ContentPackage):
    creative_type: Literal["short_video"]


class TechnicalStep(BaseModel):
    order: int = Field(ge=1, le=12)
    instruction: str = Field(min_length=8, max_length=500)
    demonstration: str = Field(min_length=8, max_length=500)
    verification: str = Field(min_length=8, max_length=500)


class TechEducationalVideoPackage(ProvenancedCreative):
    creative_type: Literal["tech_educational_video"]
    hook: str = Field(min_length=8, max_length=200)
    prerequisites: list[str] = Field(default_factory=list, max_length=10)
    steps: list[TechnicalStep] = Field(min_length=1, max_length=12)
    limitations: list[str] = Field(default_factory=list, max_length=10)
    caption: str = Field(min_length=8, max_length=2200)


class UgcAdPackage(ProvenancedCreative):
    creative_type: Literal["ugc_ad"]
    personal_hook: str = Field(min_length=8, max_length=200)
    relatable_problem: str = Field(min_length=8, max_length=500)
    product_demo: str = Field(min_length=8, max_length=800)
    proof: str = Field(min_length=8, max_length=800)
    qualification: str = Field(min_length=8, max_length=500)
    disclosure: str = Field(min_length=3, max_length=300)
    caption: str = Field(min_length=8, max_length=2200)


class StoryFrame(BaseModel):
    order: int = Field(ge=1, le=10)
    visual: str = Field(min_length=8, max_length=500)
    text: str = Field(min_length=3, max_length=300)
    duration_seconds: int = Field(ge=2, le=15)
    interaction: str | None = Field(default=None, max_length=200)


class StorySequencePackage(ProvenancedCreative):
    creative_type: Literal["story_sequence"]
    frames: list[StoryFrame] = Field(min_length=2, max_length=10)
    caption: str = Field(min_length=8, max_length=2200)


class LiveSegment(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    talking_points: list[str] = Field(min_length=1, max_length=12)
    duration_minutes: int = Field(ge=1, le=120)


class LiveStreamPackage(ProvenancedCreative):
    creative_type: Literal["live_stream"]
    opening: str = Field(min_length=8, max_length=1000)
    agenda: list[str] = Field(min_length=1, max_length=12)
    segments: list[LiveSegment] = Field(min_length=1, max_length=12)
    moderation_plan: str = Field(min_length=8, max_length=1000)
    contingency_plan: str = Field(min_length=8, max_length=1000)


class NewsletterSection(BaseModel):
    heading: str = Field(min_length=3, max_length=160)
    body: str = Field(min_length=8, max_length=4000)


class NewsletterPackage(ProvenancedCreative):
    creative_type: Literal["newsletter"]
    subject: str = Field(min_length=8, max_length=160)
    preheader: str = Field(min_length=8, max_length=200)
    opening: str = Field(min_length=8, max_length=1000)
    sections: list[NewsletterSection] = Field(min_length=1, max_length=12)


class AdaptedContentPackage(RootModel[Annotated[Union[
    AdvertisingImagePackage, InstagramCarouselPackage, ShortVideoPackage,
    TechEducationalVideoPackage, UgcAdPackage, StorySequencePackage,
    LiveStreamPackage, NewsletterPackage,
], Field(discriminator="creative_type")]]):
    pass


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
    "content.generate": CreatorServicePackage,
    "content.revise": CreatorServicePackage,
    "content.adapt": AdaptedContentPackage,
    "memories.extract": MemoryExtractionResult,
    "conversations.summarize": ConversationSummaryResult,
    "trends.research": TrendInterpretationResult,
}


def validate_result(kind: str, value: object, payload: dict | None = None) -> dict:
    model = RESULT_MODELS.get(kind)
    if model is None:
        raise ValueError(f"Unsupported job kind: {kind}")
    context = {"format": (payload or {}).get("format", "short-video")}
    result = model.model_validate(value, context=context).model_dump(mode="json")
    if kind in {"content.generate", "content.revise", "content.adapt"} and payload:
        if payload.get("creative_type"):
            result["creative_type"] = payload["creative_type"]
        if payload.get("template_provenance"):
            result["template_provenance"] = payload["template_provenance"]
    return result


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
