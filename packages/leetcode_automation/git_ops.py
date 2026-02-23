from __future__ import annotations

import os
import re
import shlex
import subprocess
import tempfile
import json
from datetime import UTC, datetime
from pathlib import Path

from .types import GitPublishResult


class CommandError(RuntimeError):
    pass


def publish_to_github(
    repo_ssh_url: str,
    default_branch: str,
    solutions_dir: str,
    problem_question_id: str,
    problem_slug: str,
    problem_title: str,
    problem_difficulty: str,
    filename: str,
    solution_code: str,
    commit_author_name: str,
    commit_author_email: str,
    ssh_private_key: str,
    ssh_passphrase: str | None = None,
    tmp_root: str = "/tmp/autofeedr",
) -> GitPublishResult:
    if not ssh_private_key.strip():
        raise RuntimeError("Chave SSH vazia para publicacao no GitHub.")

    branch = (default_branch or "main").strip()
    base_dir = (solutions_dir or "problems").strip().strip("/")
    difficulty_dir = _normalize_difficulty(problem_difficulty)
    solution_rel_path = f"{base_dir}/{difficulty_dir}/{filename}" if base_dir else f"{difficulty_dir}/{filename}"

    tmp_base_path = Path(tmp_root)
    tmp_base_path.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="autofeedr-git-", dir=str(tmp_base_path)) as temp_dir:
        temp_path = Path(temp_dir)
        repo_path = temp_path / "repo"
        ssh_path = temp_path / "ssh"
        ssh_path.mkdir(parents=True, exist_ok=True)

        key_path = ssh_path / "id_key"
        # Some RSA OpenSSH keys fail to load without a trailing newline in this runtime.
        normalized_private_key = ssh_private_key.strip() + "\n"
        key_path.write_text(normalized_private_key, encoding="utf-8")
        os.chmod(key_path, 0o600)

        known_hosts_path = ssh_path / "known_hosts"
        _write_known_hosts(known_hosts_path)

        base_env = os.environ.copy()
        base_env["GIT_SSH_COMMAND"] = (
            f"ssh -i {shlex.quote(str(key_path))} "
            "-o IdentitiesOnly=yes "
            "-o StrictHostKeyChecking=yes "
            f"-o UserKnownHostsFile={shlex.quote(str(known_hosts_path))}"
        )

        agent_env: dict[str, str] = {}
        try:
            if (ssh_passphrase or "").strip():
                agent_env = _start_ssh_agent(base_env)
                passphrase_env = {**base_env, **agent_env}
                _run_command(
                    ["ssh-add", str(key_path)],
                    env=passphrase_env,
                    stdin_text=(ssh_passphrase or "") + "\n",
                    err_prefix="Falha ao carregar chave SSH com passphrase",
                )
                # With ssh-agent active, prefer agent identity.
                base_env["GIT_SSH_COMMAND"] = (
                    "ssh "
                    "-o IdentitiesOnly=yes "
                    "-o StrictHostKeyChecking=yes "
                    f"-o UserKnownHostsFile={shlex.quote(str(known_hosts_path))}"
                )

            git_env = {**base_env, **agent_env}
            _clone_repo(repo_ssh_url=repo_ssh_url, branch=branch, repo_path=repo_path, env=git_env)

            solution_path = repo_path / solution_rel_path
            solution_path.parent.mkdir(parents=True, exist_ok=True)
            solution_path.write_text(solution_code, encoding="utf-8")
            _update_progress_file(
                repo_path=repo_path,
                repo_ssh_url=repo_ssh_url,
                problem_question_id=problem_question_id,
                problem_slug=problem_slug,
                problem_title=problem_title,
                problem_difficulty=difficulty_dir,
                solution_rel_path=solution_rel_path,
            )

            _run_command(["git", "config", "user.name", commit_author_name], cwd=repo_path, env=git_env)
            _run_command(["git", "config", "user.email", commit_author_email], cwd=repo_path, env=git_env)

            _run_command(["git", "add", "-A"], cwd=repo_path, env=git_env)

            commit_message = f"leetcode: solve #{filename.split('_', 1)[0]} {filename.rsplit('.', 1)[0]}"
            _run_command(["git", "commit", "-m", commit_message], cwd=repo_path, env=git_env)
            _run_command(["git", "push", "origin", branch], cwd=repo_path, env=git_env)

            sha = _run_command(["git", "rev-parse", "HEAD"], cwd=repo_path, env=git_env).strip()
            commit_url = _build_commit_url(repo_ssh_url, sha)
            return GitPublishResult(
                commit_sha=sha,
                commit_url=commit_url,
                solution_path=solution_rel_path,
                tests_path=None,
            )
        finally:
            if agent_env:
                _stop_ssh_agent({**base_env, **agent_env})


def _clone_repo(repo_ssh_url: str, branch: str, repo_path: Path, env: dict[str, str]) -> None:
    try:
        _run_command(
            ["git", "clone", "--depth", "1", "--branch", branch, repo_ssh_url, str(repo_path)],
            env=env,
            err_prefix="Falha ao clonar repositorio GitHub",
        )
        return
    except CommandError:
        _run_command(["git", "clone", "--depth", "1", repo_ssh_url, str(repo_path)], env=env)

    checkout_target = f"origin/{branch}"
    has_remote_branch = subprocess.run(
        ["git", "show-ref", "--verify", "--quiet", f"refs/remotes/{checkout_target}"],
        cwd=str(repo_path),
        env=env,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    ).returncode == 0

    if has_remote_branch:
        _run_command(["git", "checkout", "-B", branch, checkout_target], cwd=repo_path, env=env)
    else:
        _run_command(["git", "checkout", "-B", branch], cwd=repo_path, env=env)


def _run_command(
    command: list[str],
    cwd: Path | None = None,
    env: dict[str, str] | None = None,
    stdin_text: str | None = None,
    err_prefix: str | None = None,
) -> str:
    process = subprocess.run(
        command,
        cwd=str(cwd) if cwd else None,
        env=env,
        input=stdin_text,
        capture_output=True,
        text=True,
        check=False,
    )
    if process.returncode != 0:
        prefix = err_prefix or "Comando falhou"
        raise CommandError(
            f"{prefix}: {' '.join(command)}\n"
            f"stdout:\n{process.stdout}\n"
            f"stderr:\n{process.stderr}"
        )
    return process.stdout


def _write_known_hosts(known_hosts_path: Path) -> None:
    result = subprocess.run(
        ["ssh-keyscan", "github.com"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0 or not result.stdout.strip():
        raise RuntimeError(f"Falha ao obter host key do GitHub: {result.stderr}")
    known_hosts_path.write_text(result.stdout, encoding="utf-8")


def _start_ssh_agent(env: dict[str, str]) -> dict[str, str]:
    result = subprocess.run(
        ["ssh-agent", "-s"],
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Falha ao iniciar ssh-agent: {result.stderr}")

    parsed: dict[str, str] = {}
    for key in ("SSH_AUTH_SOCK", "SSH_AGENT_PID"):
        match = re.search(rf"{key}=([^;]+);", result.stdout)
        if not match:
            raise RuntimeError("Resposta inesperada ao iniciar ssh-agent.")
        parsed[key] = match.group(1)
    return parsed


def _stop_ssh_agent(env: dict[str, str]) -> None:
    subprocess.run(
        ["ssh-agent", "-k"],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )


def _build_commit_url(repo_ssh_url: str, commit_sha: str) -> str:
    match = re.match(r"^git@github\.com:([^/]+)/([^/]+?)(?:\.git)?$", repo_ssh_url.strip())
    if not match:
        return ""
    owner = match.group(1)
    repo = match.group(2)
    return f"https://github.com/{owner}/{repo}/commit/{commit_sha}"


def _normalize_difficulty(difficulty: str) -> str:
    normalized = (difficulty or "").strip().lower()
    if normalized not in {"easy", "medium", "hard"}:
        return "easy"
    return normalized


def _parse_repository_name(repo_ssh_url: str) -> str:
    match = re.match(r"^git@github\.com:([^/]+)/([^/]+?)(?:\.git)?$", repo_ssh_url.strip())
    if not match:
        return ""
    return f"{match.group(1)}/{match.group(2)}"


def _update_progress_file(
    repo_path: Path,
    repo_ssh_url: str,
    problem_question_id: str,
    problem_slug: str,
    problem_title: str,
    problem_difficulty: str,
    solution_rel_path: str,
) -> None:
    progress_path = repo_path / "PROGRESS.md"
    legacy_metadata_path = repo_path / "metadata" / "solved_problems.json"

    items = _load_progress_items(progress_path)
    legacy_items = _load_legacy_json_items(legacy_metadata_path)
    if legacy_items:
        items.extend(legacy_items)

    question_id = str(problem_question_id).strip()
    slug = str(problem_slug).strip()
    title = str(problem_title).strip() or slug
    difficulty = _normalize_difficulty(problem_difficulty)
    now = datetime.now().strftime("%H:%M - %d/%m/%y")

    items = [
        item
        for item in items
        if not (
            str(item.get("question_id", "")).strip() == question_id
            or str(item.get("slug", "")).strip() == slug
        )
    ]
    items.append(
        {
            "question_id": question_id,
            "slug": slug,
            "title": title,
            "difficulty": difficulty,
            "path": solution_rel_path,
            "resolved_at": now,
        }
    )

    progress_path.write_text(_render_progress_markdown(items), encoding="utf-8")

    if legacy_metadata_path.exists():
        legacy_metadata_path.unlink()
        try:
            legacy_metadata_path.parent.rmdir()
        except OSError:
            pass


def _load_legacy_json_items(metadata_path: Path) -> list[dict[str, str]]:
    if not metadata_path.exists():
        return []
    try:
        payload = json.loads(metadata_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []

    raw_items = payload.get("items")
    if not isinstance(raw_items, list):
        return []

    items: list[dict[str, str]] = []
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        question_id = str(item.get("question_id") or item.get("frontend_id") or "").strip()
        slug = str(item.get("slug") or "").strip()
        title = str(item.get("title") or slug or "").strip()
        path = str(item.get("path") or "").strip()
        difficulty = _normalize_difficulty(str(item.get("difficulty") or "easy"))
        resolved_at = _format_progress_datetime(str(item.get("committed_at") or ""))
        if not question_id or not slug or not path:
            continue
        items.append(
            {
                "question_id": question_id,
                "slug": slug,
                "title": title or slug,
                "difficulty": difficulty,
                "path": path,
                "resolved_at": resolved_at,
            }
        )
    return items


def _load_progress_items(progress_path: Path) -> list[dict[str, str]]:
    if not progress_path.exists():
        return []
    text = progress_path.read_text(encoding="utf-8")
    lines = text.splitlines()
    items: list[dict[str, str]] = []
    current_difficulty = ""
    current: dict[str, str] | None = None

    for raw_line in lines:
        line = raw_line.rstrip()
        header_match = re.match(r"^##\s+(Easy|Medium|Hard)\s*$", line, re.IGNORECASE)
        if header_match:
            current_difficulty = header_match.group(1).lower()
            current = None
            continue

        item_match = re.match(r"^- \[#([^\]]+)\s+(.+)\]\(https://leetcode\.com/problems/([^/]+)/?\)\s*$", line)
        if item_match:
            current = {
                "question_id": item_match.group(1).strip(),
                "title": item_match.group(2).strip(),
                "slug": item_match.group(3).strip(),
                "difficulty": current_difficulty or "easy",
                "path": "",
                "resolved_at": "",
            }
            items.append(current)
            continue

        if current is None:
            continue

        qid_match = re.match(r"^\s*- Question ID:\s*(.+?)\s*$", line)
        if qid_match:
            current["question_id"] = qid_match.group(1).strip()
            continue
        path_match = re.match(r"^\s*- Arquivo:\s*`(.+?)`\s*$", line)
        if path_match:
            current["path"] = path_match.group(1).strip()
            continue
        resolved_match = re.match(r"^\s*- Resolvido em:\s*(.+?)\s*$", line)
        if resolved_match:
            current["resolved_at"] = resolved_match.group(1).strip()
            continue

    return [item for item in items if item.get("question_id") and item.get("slug") and item.get("path")]


def _render_progress_markdown(items: list[dict[str, str]]) -> str:
    dedup: dict[tuple[str, str], dict[str, str]] = {}
    for item in items:
        key = (str(item.get("question_id", "")).strip(), str(item.get("slug", "")).strip())
        if not key[0] and not key[1]:
            continue
        dedup[key] = {
            "question_id": str(item.get("question_id", "")).strip(),
            "slug": str(item.get("slug", "")).strip(),
            "title": str(item.get("title", "")).strip() or str(item.get("slug", "")).strip(),
            "difficulty": _normalize_difficulty(str(item.get("difficulty", "easy"))),
            "path": str(item.get("path", "")).strip(),
            "resolved_at": str(item.get("resolved_at", "")).strip() or "--:-- - --/--/--",
        }

    all_items = list(dedup.values())
    ordered_difficulties = ("easy", "medium", "hard")
    grouped = {difficulty: [] for difficulty in ordered_difficulties}
    for item in all_items:
        grouped[_normalize_difficulty(item.get("difficulty", "easy"))].append(item)

    for difficulty in ordered_difficulties:
        grouped[difficulty].sort(
            key=lambda item: (
                _progress_sort_key(item.get("resolved_at", "")),
                _safe_int(item.get("question_id", "")),
                item.get("slug", ""),
            ),
            reverse=True,
        )

    total = sum(len(grouped[d]) for d in ordered_difficulties)
    lines: list[str] = [
        "# LeetCode Progress",
        "",
        f"Total de questoes resolvidas: {total}",
        "",
    ]

    for difficulty in ordered_difficulties:
        lines.append(f"## {difficulty.title()}")
        lines.append("")
        if not grouped[difficulty]:
            lines.append("- Nenhuma questao registrada ainda.")
            lines.append("")
            continue

        for item in grouped[difficulty]:
            question_id = item.get("question_id", "")
            slug = item.get("slug", "")
            title = item.get("title", slug)
            lines.append(f"- [#{question_id} {title}](https://leetcode.com/problems/{slug}/)")
            lines.append(f"  - Question ID: {question_id}")
            lines.append(f"  - Arquivo: `{item.get('path', '')}`")
            lines.append(f"  - Resolvido em: {item.get('resolved_at', '--:-- - --/--/--')}")
            lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def _format_progress_datetime(raw: str) -> str:
    text = str(raw or "").strip()
    if not text:
        return "--:-- - --/--/--"
    if not re.search(r"([zZ]|[+\-]\d{2}:\d{2})$", text):
        text = text + "Z"
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return "--:-- - --/--/--"
    local_dt = dt.astimezone()
    return local_dt.strftime("%H:%M - %d/%m/%y")


def _progress_sort_key(raw: str) -> tuple[int, ...]:
    try:
        dt = datetime.strptime(raw.strip(), "%H:%M - %d/%m/%y")
        return (dt.year, dt.month, dt.day, dt.hour, dt.minute)
    except ValueError:
        return (0, 0, 0, 0, 0)


def _safe_int(raw: str) -> int:
    digits = "".join(ch for ch in str(raw) if ch.isdigit())
    return int(digits) if digits else 0
