from typing import Optional
from .src.prompt import PROMPT_GERACAO_POST, PROMPT_TRADUCAO
from .src.utils import conectar_gemini, gerar_resposta

def gerar_post(informacoes: str) -> Optional[str]:

    print("Conectando ao Gemini...")
    modelo = conectar_gemini()

    # Gera o post em portugues a partir do prompt base.
    prompt_pt_br = PROMPT_GERACAO_POST.format(informacoes=informacoes)
    post_pt_br = gerar_resposta(modelo, prompt_pt_br)
    if not post_pt_br:
        print("Falha ao gerar post em PT-BR. Abortando.")
        return None
    print("Post em PT-BR gerado.")

    # Traduz o post para ingles (US) mantendo o estilo.
    prompt_traducao = PROMPT_TRADUCAO.format(post_portugues=post_pt_br)
    post_en_us = gerar_resposta(modelo, prompt_traducao)
    if not post_en_us:
        print("Falha ao gerar post em EN-US. Abortando.")
        return None
    print("Post em EN-US gerado.")

    post =  f"""「PT-BR」\n{post_pt_br}\n\n「EN-US」\n{post_en_us}"""

    print("Post final montado.")
    return post
