from contextlib import contextmanager
from typing import Iterator

import psycopg2
from psycopg2.extensions import connection
from psycopg2.extras import RealDictCursor

from app.config import settings


@contextmanager
def get_connection() -> Iterator[connection]:
    conn = psycopg2.connect(settings.database_url)
    try:
        yield conn
    finally:
        conn.close()


def check_database() -> bool:
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT
                EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector'),
                to_regclass('public.canonical_product_embeddings') IS NOT NULL
            """
        )
        extension_ready, table_ready = cursor.fetchone()
        return bool(extension_ready and table_ready)


def vector_literal(values: list[float]) -> str:
    return "[" + ",".join(f"{value:.10g}" for value in values) + "]"


def fetch_vector_candidates(
    embedding: list[float],
    embedding_model: str,
    top_k: int,
    ncm: str | None = None,
    unit: str | None = None,
    brand: str | None = None,
) -> list[dict]:
    filters = ["cpe.embedding_model = %s", "cp.is_active = TRUE"]
    params: list[object] = [vector_literal(embedding), embedding_model]

    if ncm:
        filters.append("cp.attributes_json ->> 'ncm' = %s")
        params.append(ncm)
    if unit:
        filters.append("UPPER(cp.attributes_json ->> 'unit') = UPPER(%s)")
        params.append(unit)
    if brand:
        filters.append("UPPER(COALESCE(cp.brand, '')) = UPPER(%s)")
        params.append(brand)

    params.append(top_k)
    where_clause = " AND ".join(filters)

    with get_connection() as conn, conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            f"""
            WITH query_vector AS (SELECT %s::vector AS embedding)
            SELECT
                cp.id::text AS canonical_product_id,
                cp.canonical_name,
                cp.attributes_json AS metadata,
                GREATEST(0, LEAST(1, 1 - (cpe.embedding <=> query_vector.embedding)))::float8 AS similarity
            FROM canonical_product_embeddings cpe
            JOIN canonical_products cp ON cp.id = cpe.canonical_product_id
            CROSS JOIN query_vector
            WHERE {where_clause}
            ORDER BY cpe.embedding <=> query_vector.embedding
            LIMIT %s
            """,
            params,
        )
        return [dict(row) for row in cursor.fetchall()]
