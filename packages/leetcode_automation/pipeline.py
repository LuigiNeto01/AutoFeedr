from __future__ import annotations

import re
from dataclasses import dataclass

from .git_ops import publish_to_github
from .llm import (
    fix_solution_code,
    generate_solution_code,
    generate_tests_code,
    get_llm_session,
)
from .provider import LeetCodeProvider
from .tester import run_solution_tests


@dataclass
class LeetCodePipelineInput:
    repo_ssh_url: str
    default_branch: str
    solutions_dir: str
    commit_author_name: str
    commit_author_email: str
    ssh_private_key: str
    ssh_passphrase: str | None

    selection_strategy: str
    difficulty_policy: str
    completed_frontend_ids: set[str]
    forced_problem_slug: str | None

    max_attempts: int
    graphql_url: str
    http_timeout_seconds: int
    test_timeout_seconds: int
    tmp_root: str
    solution_prompt_template: str | None = None
    openai_api_key: str | None = None
    model_override: str | None = None
    usage_callback: object | None = None
    usage_context_base: dict | None = None


@dataclass
class LeetCodePipelineResult:
    problem_frontend_id: str
    problem_slug: str
    problem_title: str
    problem_difficulty: str
    attempts_used: int
    solution_path: str
    tests_path: str | None
    commit_sha: str
    commit_url: str


def execute_leetcode_pipeline(payload: LeetCodePipelineInput) -> LeetCodePipelineResult:
    provider = LeetCodeProvider(
        graphql_url=payload.graphql_url,
        timeout_seconds=payload.http_timeout_seconds,
        max_retries=3,
    )

    problem = provider.select_problem(
        selection_strategy=payload.selection_strategy,
        difficulty_policy=payload.difficulty_policy,
        completed_frontend_ids=payload.completed_frontend_ids,
        forced_problem_slug=payload.forced_problem_slug,
    )

    session = get_llm_session(
        openai_api_key=payload.openai_api_key,
        model_override=payload.model_override,
        usage_callback=payload.usage_callback,
        usage_context=payload.usage_context_base or {},
    )
    solution_code = generate_solution_code(
        session,
        problem,
        prompt_template=payload.solution_prompt_template,
    )
    tests_code = generate_tests_code(session, problem, solution_code)

    last_failure = ""
    attempts_used = 0

    for attempt in range(1, payload.max_attempts + 1):
        attempts_used = attempt
        test_result = run_solution_tests(
            solution_code=solution_code,
            tests_code=tests_code,
            timeout_seconds=payload.test_timeout_seconds,
        )
        if test_result.success:
            break

        last_failure = (
            f"Tentativa {attempt} falhou.\n"
            f"Return code: {test_result.return_code}\n"
            f"STDOUT:\n{test_result.stdout}\n"
            f"STDERR:\n{test_result.stderr}"
        )
        if attempt >= payload.max_attempts:
            raise RuntimeError(f"PIPELINE_ATTEMPTS_EXHAUSTED\n{last_failure}")

        solution_code = fix_solution_code(
            session=session,
            problem=problem,
            solution_code=solution_code,
            tests_code=tests_code,
            failure_output=last_failure,
        )

    filename = _build_solution_filename(problem.frontend_id, problem.title_slug)
    publish_result = publish_to_github(
        repo_ssh_url=payload.repo_ssh_url,
        default_branch=payload.default_branch,
        solutions_dir=payload.solutions_dir,
        problem_question_id=problem.question_id,
        problem_slug=problem.title_slug,
        problem_title=problem.title,
        problem_difficulty=problem.difficulty,
        filename=filename,
        solution_code=solution_code,
        commit_author_name=payload.commit_author_name,
        commit_author_email=payload.commit_author_email,
        ssh_private_key=payload.ssh_private_key,
        ssh_passphrase=payload.ssh_passphrase,
        tmp_root=payload.tmp_root,
    )

    return LeetCodePipelineResult(
        problem_frontend_id=problem.frontend_id,
        problem_slug=problem.title_slug,
        problem_title=problem.title,
        problem_difficulty=problem.difficulty,
        attempts_used=attempts_used,
        solution_path=publish_result.solution_path,
        tests_path=publish_result.tests_path,
        commit_sha=publish_result.commit_sha,
        commit_url=publish_result.commit_url,
    )


def _build_solution_filename(frontend_id: str, slug: str) -> str:
    safe_slug = re.sub(r"[^a-zA-Z0-9_-]+", "_", slug.strip()).strip("_")
    safe_id = re.sub(r"[^0-9]+", "", frontend_id.strip()) or "unknown"
    return f"{safe_id}_{safe_slug or 'problem'}.py"
