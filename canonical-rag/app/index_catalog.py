import csv
from hashlib import sha256
import json
from pathlib import Path
import re
import unicodedata

from psycopg2.extras import Json

from app.config import settings
from app.db import get_connection, vector_literal
from app.services.ollama import embed_texts, ensure_required_models


def slugify(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", value)
    ascii_text = decomposed.encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", ascii_text))


def catalog_path() -> Path:
    return Path(__file__).resolve().parent.parent / "data" / "canonical_products.csv"


def main() -> None:
    ensure_required_models()
    records_by_slug: dict[str, dict] = {}
    with catalog_path().open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            name = (row.get("canonical_name") or "").strip()
            if not name:
                continue
            metadata = {
                "ncm": (row.get("ncm") or "").strip() or None,
                "unit": (row.get("unit") or "").strip() or None,
                "keywords": (row.get("keywords") or "").strip(),
                "source": "canonical-rag-csv",
            }
            content = " | ".join(
                value
                for value in [name, metadata["ncm"], metadata["unit"], metadata["keywords"]]
                if value
            )
            record = {
                "name": name,
                "slug": slugify(name),
                "brand": (row.get("brand") or "").strip() or None,
                "metadata": metadata,
                "content": content,
                "content_hash": sha256(content.encode("utf-8")).hexdigest(),
            }
            records_by_slug[record["slug"]] = record

    records = list(records_by_slug.values())

    pending: list[dict] = []
    with get_connection() as conn, conn.cursor() as cursor:
        for record in records:
            cursor.execute(
                """
                INSERT INTO canonical_products (slug, canonical_name, brand, attributes_json)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (slug) DO UPDATE SET
                    canonical_name = EXCLUDED.canonical_name,
                    brand = EXCLUDED.brand,
                    attributes_json = EXCLUDED.attributes_json,
                    is_active = TRUE
                RETURNING id::text
                """,
                (record["slug"], record["name"], record["brand"], Json(record["metadata"])),
            )
            product_id = cursor.fetchone()[0]
            cursor.execute(
                """
                SELECT 1 FROM canonical_product_embeddings
                WHERE canonical_product_id = %s
                  AND embedding_model = %s
                  AND content_hash = %s
                """,
                (product_id, settings.embed_model, record["content_hash"]),
            )
            if cursor.fetchone() is None:
                pending.append({**record, "product_id": product_id})
        conn.commit()

    if pending:
        embeddings = embed_texts([record["content"] for record in pending])
        with get_connection() as conn, conn.cursor() as cursor:
            for record, embedding in zip(pending, embeddings, strict=True):
                cursor.execute(
                    """
                    INSERT INTO canonical_product_embeddings (
                        canonical_product_id, embedding, embedding_model, content_hash
                    ) VALUES (%s, %s::vector, %s, %s)
                    ON CONFLICT (canonical_product_id) DO UPDATE SET
                        embedding = EXCLUDED.embedding,
                        embedding_model = EXCLUDED.embedding_model,
                        content_hash = EXCLUDED.content_hash,
                        updated_at = NOW()
                    """,
                    (
                        record["product_id"],
                        vector_literal(embedding),
                        settings.embed_model,
                        record["content_hash"],
                    ),
                )
            conn.commit()

    print(json.dumps({"catalog_products": len(records), "embedded": len(pending)}))


if __name__ == "__main__":
    main()
