from src import *

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

def gerar_url_para_token():

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
    return url



def gerar_token_api(usuario, codigo):
    
    try:
        token = gerar_token(client_id, client_secret, codigo, redirect_uri)
        
        data = {usuario: {'token': token, 'DataToken': datetime.now().strftime("%d/%m/%Y %H:%M:%S")}}

        json_data(data)
        return True
    
    except Exception as e:
        print("Erro ao gerar token:", e)
        raise e


def gerar_urn(usuario):
    try:
        dados = ler_json()
        headers = {"Authorization": f"Bearer {dados[usuario]['token']}"}

        r = requests.get("https://api.linkedin.com/v2/userinfo", headers=headers)
        data = {usuario: {'urn': r.json()['sub']}}

        json_data(data)

        return True
    
    except Exception as e:
        print("Erro ao gerar urn:", e)
        raise e

def FazerPost(texto, usuario):

    dados = ler_json()
    return postar_no_linkedin(dados[usuario]['token'], f"urn:li:person:{dados[usuario]['urn']}", texto)