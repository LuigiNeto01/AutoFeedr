from packages.arxiv_reciver.main import get_article
from packages.Linkedin import FazerPost
from packages.Escritor import gerar_post

if __name__ == "__main__":
    print("Iniciando teste manual de fluxo completo...")
    # Busca o Artigo
    articles = get_article(
        topics=["machine learning"],
        start="2025-10-16T00:00:00",
        end="2025-10-16T23:59:59",
        per_topic=1,
        save_in_file=True,
    )
    print(f"Artigo encontrado: {str(articles)}")
    
    # Escreve o texto do Post
    texto_post = gerar_post(str(articles))
    if not texto_post:
        print("Post nao gerado. Publicacao cancelada.")
        print("Teste finalizado.")
    else:
        print(f"Post Gerado: {texto_post}")
        FazerPost(texto_post, "Luigi")
        print("Teste finalizado.")
