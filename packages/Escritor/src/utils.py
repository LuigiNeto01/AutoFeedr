from __future__ import annotations

from dataclasses import dataclass
from typing import Any, List

import dotenv
import requests
from google import genai

from packages.shared import load_ai_config

dotenv.load_dotenv()


@dataclass
class AISession:
    provider: str
    model: str
    gemini_client: genai.Client | None = None
    openai_api_key: str | None = None
    openai_base_url: str | None = None


def conectar_ia(openai_api_key: str | None = None) -> AISession:
    config = load_ai_config()

    if config.provider == "gemini":
        if not config.gemini_api_key:
            raise ValueError("GEMINI_API_KEY nao configurada no ambiente.")
        print("Configurando cliente IA (Gemini)...")
        client = genai.Client(api_key=config.gemini_api_key)
        print(f"Modelo selecionado: {config.model}")
        return AISession(provider="gemini", model=config.model, gemini_client=client)

    api_key = (openai_api_key or "").strip()
    if not api_key:
        raise ValueError("OPENAI_API_KEY do usuario nao configurada.")
    print("Configurando cliente IA (OpenAI)...")
    print(f"Modelo selecionado: {config.model}")
    return AISession(
        provider="openai",
        model=config.model,
        openai_api_key=api_key,
        openai_base_url=config.openai_base_url,
    )


def conectar_gemini() -> AISession:
    # Compatibilidade retroativa para chamadas legadas.
    return conectar_ia()


def gerar_resposta(modelo: AISession, prompt: str) -> str:
    try:
        print(f"Enviando prompt para IA ({modelo.provider})...")
        if modelo.provider == "gemini":
            if not modelo.gemini_client:
                raise RuntimeError("Sessao Gemini invalida.")
            resposta = modelo.gemini_client.models.generate_content(
                model=modelo.model,
                contents=prompt,
            )
            texto = (resposta.text or "").strip()
        else:
            texto = _gerar_resposta_openai(modelo, prompt)

        if not texto:
            raise RuntimeError(f"Resposta vazia da IA ({modelo.provider}).")

        print("Resposta recebida da IA.")
        return texto
    except Exception as exc:
        raise RuntimeError(f"Falha ao gerar resposta na IA ({modelo.provider}): {exc}") from exc


def listar_modelos() -> List[str]:
    config = load_ai_config()
    if config.provider == "gemini":
        if not config.gemini_api_key:
            return []
        try:
            client = genai.Client(api_key=config.gemini_api_key)
            return [model.name for model in client.models.list()]
        except Exception:
            return []

    return [config.model]


def _gerar_resposta_openai(modelo: AISession, prompt: str) -> str:
    if not modelo.openai_api_key or not modelo.openai_base_url:
        raise RuntimeError("Sessao OpenAI invalida.")

    url = f"{modelo.openai_base_url}/responses"
    response = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {modelo.openai_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": modelo.model,
            "input": prompt,
        },
        timeout=60,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"OpenAI HTTP {response.status_code}: {response.text}")
    payload: dict[str, Any] = response.json()

    direct_output = (payload.get("output_text") or "").strip()
    if direct_output:
        return direct_output

    # Fallback para formatos sem output_text.
    parts: list[str] = []
    for item in payload.get("output", []) or []:
        for content in item.get("content", []) or []:
            text = content.get("text")
            if isinstance(text, str) and text.strip():
                parts.append(text.strip())
    return "\n".join(parts).strip()
