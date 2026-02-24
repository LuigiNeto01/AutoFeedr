PROMPT_GENERATE_SOLUTION = """
You are an expert competitive programming assistant.

Generate a Python 3 LeetCode solution for the following problem.
Return ONLY valid Python code, no markdown, no explanation.

Requirements:
1) Keep LeetCode-compatible signature/class style.
2) Include only code needed to solve the problem.
3) Prefer clear and robust logic over micro-optimizations.
4) Use only Python standard library (no pandas, numpy, pytest, or third-party libs).
5) If using forward type references (TreeNode/ListNode), avoid runtime NameError.
   Prefer `from __future__ import annotations` or quoted annotations.

Problem metadata:
- Frontend ID: {frontend_id}
- Title: {title}
- Difficulty: {difficulty}
- Slug: {title_slug}

Starter code (python3):
{starter_code}

Problem statement (HTML may be present):
{content}

Sample test case (raw):
{sample_test_case}

JSON metadata:
{metadata_json}
""".strip()


PROMPT_GENERATE_TESTS = """
You are a software test engineer.

Given a LeetCode solution module in Python, generate a test script.
Return ONLY valid Python code, no markdown.

Constraints:
1) The script must import `Solution` from `solution` module.
2) It must define `run_tests()` and execute it under `if __name__ == "__main__":`.
3) Use official examples from the problem statement when possible.
4) Add additional edge cases with deterministic expected outputs.
5) On failure, raise AssertionError with clear messages.
6) Use only Python standard library (no pandas, numpy, pytest, or third-party libs).

Problem metadata:
- Frontend ID: {frontend_id}
- Title: {title}
- Difficulty: {difficulty}
- Slug: {title_slug}

Problem statement (HTML may be present):
{content}

Sample test case (raw):
{sample_test_case}

JSON metadata:
{metadata_json}

Solution code:
{solution_code}
""".strip()


PROMPT_FIX_SOLUTION = """
You are debugging a failing LeetCode Python solution.

Return ONLY corrected Python solution code, no markdown.

Problem metadata:
- Frontend ID: {frontend_id}
- Title: {title}
- Difficulty: {difficulty}
- Slug: {title_slug}

Current solution code:
{solution_code}

Test script:
{tests_code}

Failure output from test run:
{failure_output}

Fix the solution so these tests pass while keeping LeetCode-compatible style.
""".strip()
