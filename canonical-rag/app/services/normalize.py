import re
import unicodedata


def normalize_text(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text)
    ascii_text = decomposed.encode("ASCII", "ignore").decode("utf-8")
    normalized = re.sub(r"[^A-Z0-9\s]", " ", ascii_text.upper())
    return re.sub(r"\s+", " ", normalized).strip()
