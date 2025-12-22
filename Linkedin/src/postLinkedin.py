import requests
import logging
from datetime import datetime, timedelta
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
formatter = logging.Formatter('%(asctime)s — %(levelname)s — %(message)s 💬')
handler.setFormatter(formatter)
logger.addHandler(handler)

def postar_no_linkedin(token, author_urn, texto):

        
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

    resp = requests.post(url, headers=headers, json=data)
    if resp.status_code in (200, 201):
        print("Post publicado com sucesso 🎉")
        return True
    else:
        print(f"Erro ao postar ({resp.status_code}): {resp.text}")
        raise f"Erro ao postar ({resp.status_code}) - Quantidade de Caracteres: {len(resp.text)}"

if __name__ == "__main__":
    postar_no_linkedin(
        token='AQWfXQd-7h2PGx454jQBgO96UDLvGRM-mw6ADbhdgu4v3-l-pILam1l33XbCHygHC_ccvyIN2Nee0OaFaHM-jnM-B73RguzlMUl4RVL7ZhWMBhb2UDBfe9D6d2_noOiGy6fDFzXVEGQmQA4Pn7-17yLSqfhkgag6_2uC83idBZWAx3qhIPfwUb19BntiFtpaPZ2reQivz-btS1gMLt_au6fqGNhUmnwsr97ck-gzEnZ0cZPxUM29Vzwle9VZwGEcP1SKj69S41a0Q0XUtG9vFFwMqnN0rTd2Q7Va6Pb6_tEIyD3vGhPYsmhS_9214z8O9Px4I-RqwpKEL9LoVrPBxGfv0QfCDQ',
        author_urn="urn:li:person:f0do7Ez2ov",
        texto="Salve rede! #Python #LinkedInAPI"
    )
