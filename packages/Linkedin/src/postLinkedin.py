import requests
import logging
from datetime import datetime, timedelta
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
formatter = logging.Formatter('%(asctime)s — %(levelname)s — %(message)s 💬')
handler.setFormatter(formatter)
logger.addHandler(handler)
LINKEDIN_TIMEOUT_SECONDS = 30
MAX_LINKEDIN_POST_CHARS = 3000

def postar_no_linkedin(token, author_urn, texto):
    if not token:
        raise ValueError("Token do LinkedIn nao informado.")
    if not author_urn:
        raise ValueError("URN do autor nao informado.")
    if not texto:
        raise ValueError("Texto do post nao informado.")
    if len(texto) > MAX_LINKEDIN_POST_CHARS:
        raise ValueError(
            f"Texto excede limite de {MAX_LINKEDIN_POST_CHARS} caracteres: {len(texto)}."
        )

        
    # Usa versao da API baseada no mes anterior.
    Ano_Mes_Anterior = (datetime.now() - timedelta(days=30)).strftime("%Y%m")


    url = "https://api.linkedin.com/v2/ugcPosts"
    headers = {
        "Authorization": f"Bearer {token}",
        "LinkedIn-Version": f"{Ano_Mes_Anterior}",
        "X-Restli-Protocol-Version": "2.0.0",
        "Content-Type": "application/json"
    }
    data = {
            "author": author_urn,
            "lifecycleState": "PUBLISHED",
            "specificContent": {
                "com.linkedin.ugc.ShareContent": {
                    "shareCommentary": {"text": texto},
                    "shareMediaCategory": "NONE"
                }
            },
            "visibility": {
                "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
            }
        }

    print("Enviando post para o LinkedIn...")
    try:
        resp = requests.post(
            url,
            headers=headers,
            json=data,
            timeout=LINKEDIN_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        raise RuntimeError(f"Falha de rede ao postar no LinkedIn: {exc}") from exc
    if resp.status_code in (200, 201):
        print(f"URN do autor: {author_urn}")
        print("Post publicado com sucesso 🎉")
        return True
    else:
        print(f"Erro ao postar ({resp.status_code}): {resp.text}")
        raise RuntimeError(
            f"Erro ao postar ({resp.status_code}) - resposta: {resp.text}"
        )

if __name__ == "__main__":
    pass
