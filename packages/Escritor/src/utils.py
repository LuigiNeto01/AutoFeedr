from google import genai
import os, dotenv
from dataclasses import dataclass
from typing import List

dotenv.load_dotenv()

# Carrega configuracoes do ambiente.
API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

@dataclass
class GeminiSession:
    client: genai.Client
    model: str

def _normalize_model_name(modelo: str) -> str:
    # Compatibilidade com configuracoes antigas no formato "models/<nome>".
    if modelo.startswith("models/"):
        return modelo.split("/", 1)[1]
    return modelo

def conectar_gemini(api_key: str = API_KEY, modelo: str = GEMINI_MODEL):
    """
    Conecta à API do Gemini e retorna um modelo configurado.
    """
    try:
        if not api_key:
            raise ValueError("GEMINI_API_KEY nao configurada no ambiente.")
        model_name = _normalize_model_name(modelo)
        # Configura cliente da SDK nova do Gemini.
        print("Configurando cliente Gemini...")
        client = genai.Client(api_key=api_key)
        print(f"Modelo Gemini selecionado: {model_name}")
        return GeminiSession(client=client, model=model_name)
    except Exception as e:
        print("Falha ao conectar no Gemini.")
        raise

def gerar_resposta(modelo: GeminiSession, prompt: str):
    """
    Envia um prompt para o modelo Gemini e retorna a resposta.
    """
    try:
        print("Enviando prompt para o Gemini...")
        resposta = modelo.client.models.generate_content(
            model=modelo.model,
            contents=prompt,
        )
        texto = (resposta.text or "").strip()
        if not texto:
            print("Resposta vazia do Gemini.")
            return None
        print("Resposta recebida do Gemini.")
        return texto
    except Exception as e:
        print(f"Falha ao gerar resposta no Gemini: {e}")
        return None

def listar_modelos(api_key: str = API_KEY) -> List[str]:
    """Retorna lista de nomes de modelos disponiveis para a conta."""
    if not api_key:
        return []
    try:
        client = genai.Client(api_key=api_key)
        return [model.name for model in client.models.list()]
    except Exception:
        return []
