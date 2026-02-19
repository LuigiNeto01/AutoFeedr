from __future__ import annotations

import os
import re
import shlex
import subprocess
import tempfile
from pathlib import Path

from .types import GitPublishResult


class CommandError(RuntimeError):
    pass


def publish_to_github(
    repo_ssh_url: str,
    default_branch: str,
    solutions_dir: str,
    filename: str,
    solution_code: str,
    tests_code: str,
    commit_author_name: str,
    commit_author_email: str,
    ssh_private_key: str,
    ssh_passphrase: str | None = None,
    tmp_root: str = "/tmp/autofeedr",
) -> GitPublishResult:
    if not ssh_private_key.strip():
        raise RuntimeError("Chave SSH vazia para publicacao no GitHub.")

    branch = (default_branch or "main").strip()
    base_dir = (solutions_dir or "leetcode/python").strip().strip("/")
    solution_rel_path = f"{base_dir}/{filename}" if base_dir else filename
    tests_rel_path = f"{base_dir}/tests/{filename.replace('.py', '_test.py')}" if base_dir else f"tests/{filename.replace('.py', '_test.py')}"

    tmp_base_path = Path(tmp_root)
    tmp_base_path.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="autofeedr-git-", dir=str(tmp_base_path)) as temp_dir:
        temp_path = Path(temp_dir)
        repo_path = temp_path / "repo"
        ssh_path = temp_path / "ssh"
        ssh_path.mkdir(parents=True, exist_ok=True)

        key_path = ssh_path / "id_key"
        key_path.write_text(ssh_private_key, encoding="utf-8")
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
            tests_path = repo_path / tests_rel_path
            solution_path.parent.mkdir(parents=True, exist_ok=True)
            tests_path.parent.mkdir(parents=True, exist_ok=True)
            solution_path.write_text(solution_code, encoding="utf-8")
            tests_path.write_text(tests_code, encoding="utf-8")

            _run_command(["git", "config", "user.name", commit_author_name], cwd=repo_path, env=git_env)
            _run_command(["git", "config", "user.email", commit_author_email], cwd=repo_path, env=git_env)

            _run_command(["git", "add", solution_rel_path, tests_rel_path], cwd=repo_path, env=git_env)

            commit_message = f"leetcode: solve #{filename.split('_', 1)[0]} {filename.rsplit('.', 1)[0]}"
            _run_command(["git", "commit", "-m", commit_message], cwd=repo_path, env=git_env)
            _run_command(["git", "push", "origin", branch], cwd=repo_path, env=git_env)

            sha = _run_command(["git", "rev-parse", "HEAD"], cwd=repo_path, env=git_env).strip()
            commit_url = _build_commit_url(repo_ssh_url, sha)
            return GitPublishResult(
                commit_sha=sha,
                commit_url=commit_url,
                solution_path=solution_rel_path,
                tests_path=tests_rel_path,
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
