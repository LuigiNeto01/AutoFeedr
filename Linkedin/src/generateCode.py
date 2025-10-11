import requests


def gerar_token(client_id, client_secret, code, redirect_uri):
    url = "https://www.linkedin.com/oauth/v2/accessToken"
    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "client_secret": client_secret
    }

    print("Solicitando token de acesso 🔑")
    resp = requests.post(url, data=data)

    if resp.status_code == 200:
        token = resp.json()["access_token"]
        expires = resp.json()["expires_in"]
        print(f"Token gerado com sucesso 🎉 expira em {expires/3600/24:.1f} dias")
        print(f"Access Token: {token}")
        return token
    else:
        print(f"Erro ({resp.status_code}): {resp.text}")
        return None

if __name__ == "__main__":

    pass
