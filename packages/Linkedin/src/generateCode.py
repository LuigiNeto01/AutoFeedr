import requests
LINKEDIN_TIMEOUT_SECONDS = 30


def gerar_token(client_id, client_secret, code, redirect_uri):
    # Troca o code de autorizacao pelo token de acesso.
    url = "https://www.linkedin.com/oauth/v2/accessToken"
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "client_secret": client_secret
    }

    print("Solicitando token de acesso 🔑")
    try:
        resp = requests.post(url, data=data, timeout=LINKEDIN_TIMEOUT_SECONDS)
    except requests.RequestException as exc:
        print(f"Falha de rede ao solicitar token: {exc}")
        return None
    print("Resposta do LinkedIn recebida.")

    if resp.status_code == 200:
        token = resp.json()["access_token"]
        expires = resp.json()["expires_in"]
        print(f"Token gerado com sucesso 🎉 expira em {expires/3600/24:.1f} dias")
        return token
    else:
        print(f"Erro ({resp.status_code}): {resp.text}")
        return None

if __name__ == "__main__":

    pass
