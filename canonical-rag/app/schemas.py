from typing import Any

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class ItemInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    description: str = Field(
        min_length=1,
        max_length=220,
        validation_alias=AliasChoices("description", "raw_description", "descricao"),
    )
    ncm: str | None = Field(default=None, max_length=20)
    unit: str | None = Field(
        default=None,
        max_length=20,
        validation_alias=AliasChoices("unit", "unidade"),
    )
    brand: str | None = Field(
        default=None,
        max_length=100,
        validation_alias=AliasChoices("brand", "marca"),
    )
    top_k: int = Field(default=5, ge=1, le=10)


class ClassificationCandidate(BaseModel):
    canonical_product_id: str
    canonical_name: str
    similarity: float = Field(ge=0, le=1)
    confidence: float = Field(ge=0, le=1)
    reason: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class ClassificationModels(BaseModel):
    embedding: str
    chat: str


class ClassificationResponse(BaseModel):
    normalized_description: str
    candidates: list[ClassificationCandidate]
    needs_human_review: bool = True
    models: ClassificationModels
