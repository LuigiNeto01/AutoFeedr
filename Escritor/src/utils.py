import google.generativeai as genai
import os, dotenv

dotenv.load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")

def conectar_gemini(api_key: str = API_KEY, modelo: str = "gemini-2.5-flash"):
    """
    Conecta à API do Gemini e retorna um modelo configurado.
    """
    try:
        genai.configure(api_key=api_key)
        return genai.GenerativeModel(modelo)
    except Exception as e:
        raise

def gerar_resposta(modelo, prompt: str):
    """
    Envia um prompt para o modelo Gemini e retorna a resposta.
    """
    try:
        resposta = modelo.generate_content(prompt)
        texto = resposta.text.strip()
        return texto
    except Exception as e:
        return None