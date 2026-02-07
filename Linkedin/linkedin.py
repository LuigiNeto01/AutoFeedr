from .src.generateCode import gerar_token
from .src.postLinkedin import postar_no_linkedin
from .src.utils import json_data, ler_json

from datetime import datetime
import requests
from dotenv import load_dotenv
import os
import urllib.parse

# todo client id e secret estaram no .env
load_dotenv()

client_id = os.getenv("client_id")
client_secret = os.getenv("client_secret")
redirect_uri = os.getenv("redirect_uri")
LINKEDIN_TIMEOUT_SECONDS = 30

def _validar_ambiente_linkedin() -> None:
    faltantes = []
    if not client_id:
        faltantes.append("client_id")
    if not client_secret:
        faltantes.append("client_secret")
    if not redirect_uri:
        faltantes.append("redirect_uri")
    if faltantes:
        raise ValueError(f"Variaveis de ambiente ausentes para LinkedIn: {', '.join(faltantes)}")

def gerar_url_para_token():
    _validar_ambiente_linkedin()

    scopes = ["openid", "profile", "w_member_social"]
    # Montar URL de autorização
    base_url = "https://www.linkedin.com/oauth/v2/authorization"
    params = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": " ".join(scopes)
    }

    # Codificar e gerar a URL final
    url = f"{base_url}?{urllib.parse.urlencode(params)}"
    print("URL de autorizacao do LinkedIn gerada.")
    return url



def gerar_token_api(usuario, codigo):
    
    try:
        _validar_ambiente_linkedin()
        print(f"Gerando token de acesso para usuario: {usuario}")
        token = gerar_token(client_id, client_secret, codigo, redirect_uri)
        if not token:
            raise RuntimeError("Nao foi possivel gerar token para o usuario informado.")
        
        data = {usuario: {'token': token, 'DataToken': datetime.now().strftime("%d/%m/%Y %H:%M:%S")}}

        json_data(data)
        print("Token salvo com sucesso.")
        return True
    
    except Exception as e:
        print("Erro ao gerar token:", e)
        raise e


def gerar_urn(usuario):
    try:
        print(f"Buscando URN para usuario: {usuario}")
        dados = ler_json()
        if usuario not in dados or "token" not in dados[usuario]:
            raise KeyError(f"Token nao encontrado para usuario '{usuario}' em dados.json.")
        headers = {"Authorization": f"Bearer {dados[usuario]['token']}"}

        r = requests.get(
            "https://api.linkedin.com/v2/userinfo",
            headers=headers,
            timeout=LINKEDIN_TIMEOUT_SECONDS,
        )
        if r.status_code != 200:
            raise RuntimeError(f"Falha ao consultar userinfo ({r.status_code}): {r.text}")
        payload = r.json()
        urn = payload.get("sub")
        if not urn:
            raise RuntimeError("Resposta do LinkedIn sem campo 'sub' para URN.")
        data = {usuario: {'urn': urn}}

        json_data(data)
        print("URN salvo com sucesso.")

        return True
    
    except Exception as e:
        print("Erro ao gerar urn:", e)
        raise e

def FazerPost(texto, usuario):

    print(f"Publicando post para usuario: {usuario}")
    if not texto:
        print("Texto vazio. Publicacao cancelada.")
        return False
    if len(texto) > 3000:
        print(f"Texto excede 3000 caracteres ({len(texto)}). Publicacao cancelada.")
        return False
    dados = ler_json()
    if usuario not in dados:
        raise KeyError(f"Usuario '{usuario}' nao encontrado em dados.json.")
    if "token" not in dados[usuario] or "urn" not in dados[usuario]:
        raise KeyError(f"Dados incompletos para usuario '{usuario}' (token/urn).")
    return postar_no_linkedin(dados[usuario]['token'], f"urn:li:person:{dados[usuario]['urn']}", texto)

if __name__ == "__main__":
    FazerPost("Teste de post via API", "Luigi")
