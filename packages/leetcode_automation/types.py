from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class LeetCodeProblemSummary:
    frontend_id: str
    title: str
    title_slug: str
    difficulty: str
    paid_only: bool
    topic_tags: list[str]


@dataclass
class LeetCodeProblemDetail:
    frontend_id: str
    question_id: str
    title: str
    title_slug: str
    difficulty: str
    content: str
    sample_test_case: str
    metadata: dict[str, Any]
    starter_code_python: str


@dataclass
class GeneratedAssets:
    solution_code: str
    tests_code: str


@dataclass
class TestRunResult:
    success: bool
    stdout: str
    stderr: str
    return_code: int


@dataclass
class GitPublishResult:
    commit_sha: str
    commit_url: str
    solution_path: str
    tests_path: str | None
