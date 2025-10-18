from arxiv_reciver.main import get_article
from Linkedin import FazerPost
from Escritor import gerar_post
from post_scheduler.main import exec_scheduler
from time import sleep
from datetime import datetime



if __name__ == "__main__":
    print(f"------------ Execucao Programada em {datetime.now().strftime('%d/%m/%Y %H:%M')} ------------")
    while True:
        sleep(30)
        exec_config = exec_scheduler()
        if exec_config['found']:

            # Busca o Artigo
            articles = get_article(
                topics=[exec_config['topic']],
                per_topic=1,
                save_in_file=True,
            )
            # verificando se foi encontrado algum arquivo
            if not articles[exec_config['topic']]:
                print(f"Nenhum artigo encontrado para o topico: ({exec_config['topic']}).")
                continue

            print(f"Artigo encontrado: {str(articles)}")
            
            # Escreve o texto do Post
            texto_post = gerar_post(str(articles))
            print(f"Post Gerado: {texto_post}")

            FazerPost(texto_post, exec_config['user'])
