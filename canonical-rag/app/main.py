from fastapi import FastAPI, HTTPException
import psycopg2

from app.db import check_database
from app.schemas import ClassificationResponse, ItemInput
from app.services.classify import classify_item
from app.services.ollama import OllamaUnavailable, ensure_required_models

app = FastAPI(title="Mercado Fácil Canonical Product Classifier")


@app.get("/health")
def health() -> dict:
    dependencies: dict[str, str] = {"database": "down", "ollama": "down"}
    errors: list[str] = []

    try:
        dependencies["database"] = "up" if check_database() else "not_migrated"
        if dependencies["database"] != "up":
            errors.append("pgvector schema is not ready")
    except psycopg2.Error:
        errors.append("database is unavailable")

    try:
        ensure_required_models()
        dependencies["ollama"] = "up"
    except OllamaUnavailable as error:
        errors.append(str(error))

    if errors:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "error",
                "dependencies": dependencies,
                "errors": errors,
            },
        )

    return {"status": "ok", "dependencies": dependencies}


@app.post("/classify", response_model=ClassificationResponse)
def classify(item: ItemInput) -> ClassificationResponse:
    try:
        ensure_required_models()
        return classify_item(item)
    except OllamaUnavailable as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    except psycopg2.Error as error:
        raise HTTPException(
            status_code=503,
            detail="Classifier database is unavailable or not migrated.",
        ) from error
