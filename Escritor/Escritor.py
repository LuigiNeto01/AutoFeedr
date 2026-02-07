from typing import Optional
from .src.prompt import PROMPT_GERACAO_POST, PROMPT_TRADUCAO
from .src.utils import conectar_gemini, gerar_resposta

MAX_SECTION_CHARS = 1400
MAX_LINKEDIN_POST_CHARS = 3000

def _fit_text_limit(text: str, limit: int) -> str:
    """Garante limite por caracteres sem retornar string vazia."""
    clean = (text or "").strip()
    if len(clean) <= limit:
        return clean
    if limit <= 3:
        return clean[:limit]
    clipped = clean[:limit - 3].rstrip()
    return f"{clipped}..."

def _montar_post_bilingue(post_pt_br: str, post_en_us: str) -> str:
    header_pt = "「PT-BR」\n"
    header_en = "\n\n「EN-US」\n"
    base = f"{header_pt}{post_pt_br}{header_en}{post_en_us}"
    if len(base) <= MAX_LINKEDIN_POST_CHARS:
        return base

    # Reserva espaco para cabecalhos e comprime blocos de forma equilibrada.
    available = MAX_LINKEDIN_POST_CHARS - len(header_pt) - len(header_en)
    per_section = max(200, available // 2)
    pt_fit = _fit_text_limit(post_pt_br, per_section)
    en_fit = _fit_text_limit(post_en_us, per_section)
    post = f"{header_pt}{pt_fit}{header_en}{en_fit}"
    return _fit_text_limit(post, MAX_LINKEDIN_POST_CHARS)

def gerar_post(
    informacoes: str,
    prompt_generation: str | None = None,
    prompt_translation: str | None = None,
) -> Optional[str]:

    print("Conectando ao Gemini...")
    modelo = conectar_gemini()

    # Gera o post em portugues a partir do prompt base.
    prompt_template_pt = prompt_generation or PROMPT_GERACAO_POST
    prompt_pt_br = prompt_template_pt.format(informacoes=informacoes)
    post_pt_br = gerar_resposta(modelo, prompt_pt_br)
    if not post_pt_br:
        print("Falha ao gerar post em PT-BR. Abortando.")
        return None
    post_pt_br = _fit_text_limit(post_pt_br, MAX_SECTION_CHARS)
    print("Post em PT-BR gerado.")

    # Traduz o post para ingles (US) mantendo o estilo.
    prompt_template_translation = prompt_translation or PROMPT_TRADUCAO
    prompt_traducao = prompt_template_translation.format(post_portugues=post_pt_br)
    post_en_us = gerar_resposta(modelo, prompt_traducao)
    if not post_en_us:
        print("Falha ao gerar post em EN-US. Abortando.")
        return None
    post_en_us = _fit_text_limit(post_en_us, MAX_SECTION_CHARS)
    print("Post em EN-US gerado.")

    post = _montar_post_bilingue(post_pt_br, post_en_us)
    if len(post) > MAX_LINKEDIN_POST_CHARS:
        print("Post excedeu limite do LinkedIn apos ajustes. Abortando.")
        return None

    print(f"Post final montado ({len(post)} caracteres).")
    return post
