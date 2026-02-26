from __future__ import annotations

import json
import re

from packages.Escritor.src.utils import AISession, conectar_ia, gerar_resposta

from .prompts import PROMPT_FIX_SOLUTION, PROMPT_GENERATE_SOLUTION, PROMPT_GENERATE_TESTS
from .types import LeetCodeProblemDetail


def get_llm_session(
    openai_api_key: str | None = None,
    model_override: str | None = None,
    usage_callback=None,
    usage_context: dict | None = None,
) -> AISession:
    return conectar_ia(
        openai_api_key=openai_api_key,
        model_override=model_override,
        usage_callback=usage_callback,
        usage_context=usage_context or {},
    )


def generate_solution_code(
    session: AISession,
    problem: LeetCodeProblemDetail,
    prompt_template: str | None = None,
) -> str:
    template = (prompt_template or "").strip() or PROMPT_GENERATE_SOLUTION
    prompt = template.format(
        frontend_id=problem.frontend_id,
        title=problem.title,
        difficulty=problem.difficulty,
        title_slug=problem.title_slug,
        starter_code=problem.starter_code_python or "(empty)",
        content=problem.content,
        sample_test_case=problem.sample_test_case,
        metadata_json=json.dumps(problem.metadata, ensure_ascii=False, indent=2),
    )
    ai_error = ""
    output = ""
    try:
        output = gerar_resposta(session, prompt, usage_context={"operation": "leetcode_generate_solution"})
    except Exception as exc:
        ai_error = str(exc)
    if output:
        return extract_python_code(output)

    fallback = _fallback_solution_code(problem)
    if fallback:
        return fallback
    suffix = f" Causa: {ai_error}" if ai_error else ""
    raise RuntimeError(f"Falha ao gerar solucao Python na IA.{suffix}")


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
    ai_error = ""
    output = ""
    try:
        output = gerar_resposta(session, prompt, usage_context={"operation": "leetcode_generate_tests"})
    except Exception as exc:
        ai_error = str(exc)
    if output:
        return extract_python_code(output)

    fallback = _fallback_tests_code(problem)
    if fallback:
        return fallback
    suffix = f" Causa: {ai_error}" if ai_error else ""
    raise RuntimeError(f"Falha ao gerar testes Python na IA.{suffix}")


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
    try:
        output = gerar_resposta(session, prompt, usage_context={"operation": "leetcode_fix_solution"})
    except Exception as exc:
        raise RuntimeError(f"Falha ao corrigir solucao na IA. Causa: {exc}") from exc
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
    if slug == "valid-palindrome":
        return (
            "class Solution:\n"
            "    def isPalindrome(self, s):\n"
            "        filtered = [ch.lower() for ch in s if ch.isalnum()]\n"
            "        return filtered == filtered[::-1]\n"
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
    if slug == "valid-palindrome":
        return (
            "from solution import Solution\n\n"
            "def run_tests():\n"
            "    s = Solution()\n"
            "    assert s.isPalindrome('A man, a plan, a canal: Panama') is True\n"
            "    assert s.isPalindrome('race a car') is False\n"
            "    assert s.isPalindrome(' ') is True\n\n"
            "if __name__ == '__main__':\n"
            "    run_tests()\n"
        )
    return None
