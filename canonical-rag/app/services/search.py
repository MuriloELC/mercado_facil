from app.config import settings
from app.db import fetch_vector_candidates
from app.services.normalize import normalize_text
from app.services.ollama import embed_texts


def search_candidates(
    description: str,
    top_k: int,
    ncm: str | None = None,
    unit: str | None = None,
    brand: str | None = None,
) -> tuple[str, list[dict]]:
    normalized = normalize_text(description)
    query = " | ".join(part for part in [normalized, ncm, unit, brand] if part)
    embedding = embed_texts([query])[0]
    candidates = fetch_vector_candidates(
        embedding,
        settings.embed_model,
        top_k,
        ncm=ncm,
        unit=unit,
        brand=brand,
    )
    return normalized, candidates
