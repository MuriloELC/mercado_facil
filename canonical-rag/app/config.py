from dataclasses import dataclass
import os

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgres://postgres:postgres@localhost:5501/lista_compras",
    )
    ollama_url: str = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
    embed_model: str = os.getenv("OLLAMA_EMBED_MODEL", "embeddinggemma")
    chat_model: str = os.getenv("OLLAMA_CHAT_MODEL", "qwen2.5:7b")
    ollama_timeout_seconds: float = float(
        os.getenv("OLLAMA_TIMEOUT_SECONDS", "120")
    )
    top_k: int = int(os.getenv("RAG_TOP_K", "5"))


settings = Settings()
