from __future__ import annotations

import json
import re

from packages.Escritor.src.utils import GeminiSession, conectar_gemini, gerar_resposta

from .prompts import PROMPT_FIX_SOLUTION, PROMPT_GENERATE_SOLUTION, PROMPT_GENERATE_TESTS
from .types import LeetCodeProblemDetail


def get_gemini_session() -> GeminiSession:
    return conectar_gemini()


def generate_solution_code(session: GeminiSession, problem: LeetCodeProblemDetail) -> str:
    prompt = PROMPT_GENERATE_SOLUTION.format(
        frontend_id=problem.frontend_id,
        title=problem.title,
        difficulty=problem.difficulty,
        title_slug=problem.title_slug,
        starter_code=problem.starter_code_python or "(empty)",
        content=problem.content,
        sample_test_case=problem.sample_test_case,
        metadata_json=json.dumps(problem.metadata, ensure_ascii=False, indent=2),
    )
    output = gerar_resposta(session, prompt)
    if not output:
        raise RuntimeError("Falha ao gerar solucao Python no Gemini.")
    return extract_python_code(output)


def generate_tests_code(session: GeminiSession, problem: LeetCodeProblemDetail, solution_code: str) -> str:
    prompt = PROMPT_GENERATE_TESTS.format(
        frontend_id=problem.frontend_id,
        title=problem.title,
        difficulty=problem.difficulty,
        title_slug=problem.title_slug,
        content=problem.content,
        sample_test_case=problem.sample_test_case,
        metadata_json=json.dumps(problem.metadata, ensure_ascii=False, indent=2),
        solution_code=solution_code,
    )
    output = gerar_resposta(session, prompt)
    if not output:
        raise RuntimeError("Falha ao gerar testes Python no Gemini.")
    return extract_python_code(output)


def fix_solution_code(
    session: GeminiSession,
    problem: LeetCodeProblemDetail,
    solution_code: str,
    tests_code: str,
    failure_output: str,
) -> str:
    prompt = PROMPT_FIX_SOLUTION.format(
        frontend_id=problem.frontend_id,
        title=problem.title,
        difficulty=problem.difficulty,
        title_slug=problem.title_slug,
        solution_code=solution_code,
        tests_code=tests_code,
        failure_output=failure_output,
    )
    output = gerar_resposta(session, prompt)
    if not output:
        raise RuntimeError("Falha ao corrigir solucao no Gemini.")
    return extract_python_code(output)


def extract_python_code(raw_text: str) -> str:
    text = (raw_text or "").strip()
    if not text:
        raise RuntimeError("Resposta vazia ao extrair codigo Python.")

    fence_match = re.search(r"```(?:python)?\s*(.*?)```", text, re.DOTALL | re.IGNORECASE)
    if fence_match:
        text = fence_match.group(1).strip()

    lines = text.splitlines()
    if lines and lines[0].strip().lower() == "python":
        text = "\n".join(lines[1:]).strip()

    if "class Solution" not in text and "def " not in text:
        raise RuntimeError("Codigo gerado nao parece uma solucao Python valida.")

    return text
