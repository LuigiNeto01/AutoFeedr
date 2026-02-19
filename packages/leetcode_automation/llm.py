from __future__ import annotations

import json
import re

from packages.Escritor.src.utils import AISession, conectar_ia, gerar_resposta

from .prompts import PROMPT_FIX_SOLUTION, PROMPT_GENERATE_SOLUTION, PROMPT_GENERATE_TESTS
from .types import LeetCodeProblemDetail


def get_llm_session() -> AISession:
    return conectar_ia()


def generate_solution_code(session: AISession, problem: LeetCodeProblemDetail) -> str:
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
    if output:
        return extract_python_code(output)

    fallback = _fallback_solution_code(problem)
    if fallback:
        return fallback
    raise RuntimeError("Falha ao gerar solucao Python na IA.")


def generate_tests_code(session: AISession, problem: LeetCodeProblemDetail, solution_code: str) -> str:
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
    if output:
        return extract_python_code(output)

    fallback = _fallback_tests_code(problem)
    if fallback:
        return fallback
    raise RuntimeError("Falha ao gerar testes Python na IA.")


def fix_solution_code(
    session: AISession,
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
        raise RuntimeError("Falha ao corrigir solucao na IA.")
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


def _fallback_solution_code(problem: LeetCodeProblemDetail) -> str | None:
    slug = (problem.title_slug or "").strip().lower()
    if slug == "two-sum":
        return (
            "class Solution:\n"
            "    def twoSum(self, nums, target):\n"
            "        seen = {}\n"
            "        for i, value in enumerate(nums):\n"
            "            need = target - value\n"
            "            if need in seen:\n"
            "                return [seen[need], i]\n"
            "            seen[value] = i\n"
            "        return []\n"
        )
    return None


def _fallback_tests_code(problem: LeetCodeProblemDetail) -> str | None:
    slug = (problem.title_slug or "").strip().lower()
    if slug == "two-sum":
        return (
            "from solution import Solution\n\n"
            "def run_tests():\n"
            "    s = Solution()\n"
            "    assert s.twoSum([2, 7, 11, 15], 9) == [0, 1]\n"
            "    ans = s.twoSum([3, 2, 4], 6)\n"
            "    assert ans == [1, 2], f'expected [1,2], got {ans}'\n"
            "    ans = s.twoSum([3, 3], 6)\n"
            "    assert ans == [0, 1], f'expected [0,1], got {ans}'\n\n"
            "if __name__ == '__main__':\n"
            "    run_tests()\n"
        )
    return None
