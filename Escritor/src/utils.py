import google.generativeai as genai
import os, dotenv

dotenv.load_dotenv()

# Carrega configuracoes do ambiente.
API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "models/gemini-pro-latest")

def conectar_gemini(api_key: str = API_KEY, modelo: str = GEMINI_MODEL):
    """
    Conecta à API do Gemini e retorna um modelo configurado.
    """
    try:
        # Configura o cliente do Gemini com a chave de API.
        print("Configurando cliente Gemini...")
        genai.configure(api_key=api_key)
        print(f"Modelo Gemini selecionado: {modelo}")
        return genai.GenerativeModel(modelo)
    except Exception as e:
        print("Falha ao conectar no Gemini.")
        raise

def gerar_resposta(modelo, prompt: str):
    """
    Envia um prompt para o modelo Gemini e retorna a resposta.
    """
    try:
        print("Enviando prompt para o Gemini...")
        resposta = modelo.generate_content(prompt)
        texto = resposta.text.strip()
        print("Resposta recebida do Gemini.")
        return texto
    except Exception as e:
        print(f"Falha ao gerar resposta no Gemini: {e}")
        return None
