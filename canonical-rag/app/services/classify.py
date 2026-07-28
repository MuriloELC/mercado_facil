from app.config import settings
from app.schemas import (
    ClassificationCandidate,
    ClassificationModels,
    ClassificationResponse,
    ItemInput,
)
from app.services.ollama import rerank_candidates
from app.services.search import search_candidates


def classify_item(item: ItemInput) -> ClassificationResponse:
    normalized, vector_candidates = search_candidates(
        item.description,
        item.top_k,
        ncm=item.ncm,
        unit=item.unit,
        brand=item.brand,
    )

    ranked_by_id: dict[str, dict] = {}
    ranked_order: list[str] = []
    try:
        ranked = rerank_candidates(item.description, normalized, vector_candidates)
        for candidate in ranked:
            candidate_id = str(candidate.get("canonical_product_id", ""))
            if candidate_id and candidate_id not in ranked_by_id:
                ranked_by_id[candidate_id] = candidate
                ranked_order.append(candidate_id)
    except ValueError:
        pass

    vector_by_id = {
        candidate["canonical_product_id"]: candidate for candidate in vector_candidates
    }
    ordered_ids = ranked_order + [
        candidate_id
        for candidate_id in vector_by_id
        if candidate_id not in ranked_by_id
    ]

    candidates: list[ClassificationCandidate] = []
    for candidate_id in ordered_ids:
        vector_candidate = vector_by_id.get(candidate_id)
        if not vector_candidate:
            continue
        ranking = ranked_by_id.get(candidate_id)
        similarity = float(vector_candidate["similarity"])
        confidence = float(ranking["confidence"]) if ranking else similarity
        reason = (
            str(ranking["reason"])
            if ranking
            else "Ordenado por similaridade vetorial; revisão do LLM indisponível."
        )
        candidates.append(
            ClassificationCandidate(
                canonical_product_id=candidate_id,
                canonical_name=vector_candidate["canonical_name"],
                similarity=max(0, min(1, similarity)),
                confidence=max(0, min(1, confidence)),
                reason=reason,
                metadata=vector_candidate.get("metadata") or {},
            )
        )

    return ClassificationResponse(
        normalized_description=normalized,
        candidates=candidates[: item.top_k],
        needs_human_review=True,
        models=ClassificationModels(
            embedding=settings.embed_model,
            chat=settings.chat_model,
        ),
    )
