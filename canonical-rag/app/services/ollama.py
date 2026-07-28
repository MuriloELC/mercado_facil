import json
from typing import Any

import requests

from app.config import settings


class OllamaUnavailable(RuntimeError):
    pass


def _post(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    try:
        response = requests.post(
            f"{settings.ollama_url}{path}",
            json=payload,
            timeout=settings.ollama_timeout_seconds,
        )
        response.raise_for_status()
        return response.json()
    except (requests.RequestException, ValueError) as error:
        raise OllamaUnavailable(str(error)) from error


def list_models() -> list[str]:
    try:
        response = requests.get(
            f"{settings.ollama_url}/api/tags",
            timeout=min(settings.ollama_timeout_seconds, 5),
        )
        response.raise_for_status()
        return [item["name"] for item in response.json().get("models", [])]
    except (requests.RequestException, ValueError, KeyError) as error:
        raise OllamaUnavailable(str(error)) from error


def ensure_required_models() -> None:
    available = list_models()
    required = [settings.embed_model, settings.chat_model]
    missing = [
        model
        for model in required
        if not any(
            candidate == model
            or candidate.split(":", 1)[0] == model.split(":", 1)[0]
            for candidate in available
        )
    ]
    if missing:
        raise OllamaUnavailable("Missing Ollama model(s): " + ", ".join(missing))


def embed_texts(texts: list[str]) -> list[list[float]]:
    payload = _post("/api/embed", {"model": settings.embed_model, "input": texts})
    embeddings = payload.get("embeddings")
    if not isinstance(embeddings, list) or len(embeddings) != len(texts):
        raise OllamaUnavailable("Ollama returned an invalid embeddings response.")
    return embeddings


def rerank_candidates(
    description: str,
    normalized_description: str,
    candidates: list[dict],
) -> list[dict]:
    schema = {
        "type": "object",
        "properties": {
            "ranked_candidates": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "canonical_product_id": {"type": "string"},
                        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                        "reason": {"type": "string"},
                    },
                    "required": ["canonical_product_id", "confidence", "reason"],
                },
            }
        },
        "required": ["ranked_candidates"],
    }
    prompt = (
        "Classifique o item de nota fiscal usando somente os candidatos fornecidos. "
        "Ordene do melhor para o pior e explique brevemente. "
        f"Item original: {description}\n"
        f"Item normalizado: {normalized_description}\n"
        f"Candidatos: {json.dumps(candidates, ensure_ascii=False)}"
    )
    payload = _post(
        "/api/chat",
        {
            "model": settings.chat_model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            "format": schema,
            "options": {"temperature": 0},
        },
    )
    try:
        content = payload["message"]["content"]
        ranked = json.loads(content)["ranked_candidates"]
        if not isinstance(ranked, list):
            raise ValueError("ranked_candidates is not a list")
        return ranked
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
        raise ValueError("Ollama returned an invalid ranking response.") from error
