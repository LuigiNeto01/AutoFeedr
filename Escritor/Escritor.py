from src.prompt import PROMPT_GERACAO_POST, PROMPT_TRADUCAO
from src.utils import conectar_gemini, gerar_resposta

def gerar_post(informacoes: str) -> str:

    modelo = conectar_gemini()

    prompt_pt_br = PROMPT_GERACAO_POST.format(informacoes=informacoes)
    post_pt_br = gerar_resposta(modelo, prompt_pt_br)

    prompt_traducao = PROMPT_TRADUCAO.format(post_portugues=post_pt_br)
    post_en_us = gerar_resposta(modelo, prompt_traducao)

    post =  f"""「PT-BR」\n{post_pt_br}\n\n「EN-US」\n{post_en_us}"""

    return post