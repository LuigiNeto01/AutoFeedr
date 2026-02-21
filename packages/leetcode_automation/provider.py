from __future__ import annotations

import json
import random
import time
from dataclasses import asdict

import requests

from .types import LeetCodeProblemDetail, LeetCodeProblemSummary

QUESTION_LIST_QUERY = """
query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  problemsetQuestionList: questionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) {
    total: totalNum
    questions: data {
      frontendQuestionId: questionFrontendId
      title
      titleSlug
      difficulty
      paidOnly: isPaidOnly
      topicTags {
        slug
      }
    }
  }
}
"""

QUESTION_DETAIL_QUERY = """
query questionContent($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionId
    questionFrontendId
    title
    titleSlug
    content
    difficulty
    sampleTestCase
    metaData
    codeSnippets {
      lang
      langSlug
      code
    }
  }
}
"""

SELECTION_STRATEGIES = {"random", "easy_first", "sequential"}
DIFFICULTY_POLICIES = {"random", "easy", "medium", "hard", "free_any", "free_easy", "free_easy_medium"}
LEGACY_DIFFICULTY_POLICY_MAP = {
    "free_any": "random",
    "free_easy": "easy",
    "free_easy_medium": "medium",
}


class LeetCodeProvider:
    def __init__(self, graphql_url: str, timeout_seconds: int = 20, max_retries: int = 3) -> None:
        self.graphql_url = graphql_url.strip()
        self.timeout_seconds = timeout_seconds
        self.max_retries = max(1, max_retries)

    def _post(self, query: str, variables: dict) -> dict:
        last_error: Exception | None = None
        for attempt in range(1, self.max_retries + 1):
            try:
                response = requests.post(
                    self.graphql_url,
                    json={"query": query, "variables": variables},
                    timeout=self.timeout_seconds,
                    headers={
                        "Content-Type": "application/json",
                        "User-Agent": "AutoFeedr/leetcode-automation",
                    },
                )
                response.raise_for_status()
                payload = response.json()
                if payload.get("errors"):
                    raise RuntimeError(f"LeetCode GraphQL retornou erros: {payload['errors']}")
                return payload.get("data") or {}
            except Exception as exc:
                last_error = exc
                if attempt == self.max_retries:
                    break
                time.sleep(0.4 * (2 ** (attempt - 1)))

        raise RuntimeError(f"Falha ao consultar LeetCode GraphQL: {last_error}")

    def list_questions(self, difficulty: str | None = None, skip: int = 0, limit: int = 50) -> list[LeetCodeProblemSummary]:
        filters: dict[str, str] = {}
        if difficulty:
            filters["difficulty"] = difficulty

        data = self._post(
            QUESTION_LIST_QUERY,
            {
                "categorySlug": "",
                "skip": skip,
                "limit": limit,
                "filters": filters,
            },
        )

        raw = (
            data.get("problemsetQuestionList", {})
            .get("questions", [])
        )

        results: list[LeetCodeProblemSummary] = []
        for question in raw:
            results.append(
                LeetCodeProblemSummary(
                    frontend_id=str(question.get("frontendQuestionId") or "").strip(),
                    title=str(question.get("title") or "").strip(),
                    title_slug=str(question.get("titleSlug") or "").strip(),
                    difficulty=str(question.get("difficulty") or "").strip(),
                    paid_only=bool(question.get("paidOnly")),
                    topic_tags=[str(tag.get("slug") or "").strip() for tag in (question.get("topicTags") or []) if tag],
                )
            )

        return [item for item in results if item.frontend_id and item.title_slug]

    def get_question(self, title_slug: str) -> LeetCodeProblemDetail:
        data = self._post(QUESTION_DETAIL_QUERY, {"titleSlug": title_slug})
        raw = data.get("question")
        if not raw:
            raise RuntimeError(f"Problema '{title_slug}' nao encontrado no LeetCode.")

        snippets = raw.get("codeSnippets") or []
        starter_code_python = ""
        for snippet in snippets:
            lang_slug = str(snippet.get("langSlug") or "").strip().lower()
            if lang_slug == "python3":
                starter_code_python = str(snippet.get("code") or "")
                break

        metadata_raw = str(raw.get("metaData") or "").strip()
        metadata: dict = {}
        if metadata_raw:
            try:
                metadata = json.loads(metadata_raw)
            except json.JSONDecodeError:
                metadata = {}

        return LeetCodeProblemDetail(
            frontend_id=str(raw.get("questionFrontendId") or "").strip(),
            question_id=str(raw.get("questionId") or "").strip(),
            title=str(raw.get("title") or "").strip(),
            title_slug=str(raw.get("titleSlug") or "").strip(),
            difficulty=str(raw.get("difficulty") or "").strip(),
            content=str(raw.get("content") or "").strip(),
            sample_test_case=str(raw.get("sampleTestCase") or "").strip(),
            metadata=metadata,
            starter_code_python=starter_code_python,
        )

    def select_problem(
        self,
        selection_strategy: str,
        difficulty_policy: str,
        completed_frontend_ids: set[str],
        forced_problem_slug: str | None = None,
    ) -> LeetCodeProblemDetail:
        if forced_problem_slug:
            detail = self.get_question(forced_problem_slug)
            if detail.frontend_id in completed_frontend_ids:
                raise RuntimeError(
                    f"Problema '{forced_problem_slug}' ja foi resolvido para este repositorio."
                )
            return detail

        strategy = selection_strategy if selection_strategy in SELECTION_STRATEGIES else "random"
        raw_policy = difficulty_policy if difficulty_policy in DIFFICULTY_POLICIES else "random"
        policy = LEGACY_DIFFICULTY_POLICY_MAP.get(raw_policy, raw_policy)

        candidates = self._collect_candidates(policy=policy, completed_frontend_ids=completed_frontend_ids)
        if not candidates:
            raise RuntimeError("Nenhum problema elegivel encontrado (nao pago e nao resolvido).")

        selected = self._pick_candidate(strategy=strategy, candidates=candidates)
        return self.get_question(selected.title_slug)

    def _collect_candidates(
        self,
        policy: str,
        completed_frontend_ids: set[str],
        max_pages: int = 10,
        page_size: int = 50,
    ) -> list[LeetCodeProblemSummary]:
        difficulties = self._difficulty_order(policy)
        all_items: list[LeetCodeProblemSummary] = []

        for difficulty in difficulties:
            for page in range(max_pages):
                items = self.list_questions(
                    difficulty=difficulty,
                    skip=page * page_size,
                    limit=page_size,
                )
                if not items:
                    break
                for item in items:
                    if item.paid_only:
                        continue
                    if item.frontend_id in completed_frontend_ids:
                        continue
                    all_items.append(item)

        if policy == "random":
            for page in range(max_pages):
                items = self.list_questions(skip=page * page_size, limit=page_size)
                if not items:
                    break
                for item in items:
                    if item.paid_only:
                        continue
                    if item.frontend_id in completed_frontend_ids:
                        continue
                    all_items.append(item)

        dedup: dict[str, LeetCodeProblemSummary] = {}
        for item in all_items:
            dedup[item.frontend_id] = item
        return list(dedup.values())

    def _pick_candidate(
        self,
        strategy: str,
        candidates: list[LeetCodeProblemSummary],
    ) -> LeetCodeProblemSummary:
        if strategy == "sequential":
            return sorted(candidates, key=lambda item: _safe_question_number(item.frontend_id))[0]

        if strategy == "easy_first":
            easy = [item for item in candidates if item.difficulty.lower() == "easy"]
            if easy:
                return random.choice(easy)
            medium = [item for item in candidates if item.difficulty.lower() == "medium"]
            if medium:
                return random.choice(medium)
            return random.choice(candidates)

        return random.choice(candidates)

    def _difficulty_order(self, policy: str) -> list[str | None]:
        if policy == "easy":
            return ["EASY"]
        if policy == "medium":
            return ["MEDIUM"]
        if policy == "hard":
            return ["HARD"]
        return []


def _safe_question_number(raw_frontend_id: str) -> int:
    digits = "".join(ch for ch in raw_frontend_id if ch.isdigit())
    if not digits:
        return 10 ** 9
    return int(digits)


def summary_to_dict(summary: LeetCodeProblemSummary) -> dict:
    return asdict(summary)
