from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class AIConfig:
    provider: str
    model: str
    gemini_api_key: str | None
    openai_api_key: str | None
    openai_base_url: str


def load_ai_config() -> AIConfig:
    provider = (os.getenv("LLM_PROVIDER") or "openai").strip().lower()
    if provider not in {"openai", "gemini"}:
        provider = "openai"

    gemini_model = _normalize_gemini_model(os.getenv("GEMINI_MODEL") or "gemini-2.5-flash")
    openai_model = (os.getenv("OPENAI_MODEL") or "gpt-5-mini").strip()
    model = openai_model if provider == "openai" else gemini_model

    return AIConfig(
        provider=provider,
        model=model,
        gemini_api_key=(os.getenv("GEMINI_API_KEY") or "").strip() or None,
        openai_api_key=(os.getenv("OPENAI_API_KEY") or "").strip() or None,
        openai_base_url=(os.getenv("OPENAI_BASE_URL") or "https://api.openai.com/v1").strip().rstrip("/"),
    )


def _normalize_gemini_model(model_name: str) -> str:
    if model_name.startswith("models/"):
        return model_name.split("/", 1)[1]
    return model_name
