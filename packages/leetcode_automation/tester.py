from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

from .types import TestRunResult


def run_solution_tests(solution_code: str, tests_code: str, timeout_seconds: int = 20) -> TestRunResult:
    with tempfile.TemporaryDirectory(prefix="autofeedr-leetcode-test-") as tmp_dir:
        tmp_path = Path(tmp_dir)
        solution_path = tmp_path / "solution.py"
        tests_path = tmp_path / "tests.py"

        solution_path.write_text(solution_code, encoding="utf-8")
        tests_path.write_text(tests_code, encoding="utf-8")

        try:
            process = subprocess.run(
                [sys.executable, str(tests_path)],
                cwd=str(tmp_path),
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            return TestRunResult(
                success=False,
                stdout=(exc.stdout or ""),
                stderr=(exc.stderr or "") + f"\nTimeout apos {timeout_seconds}s.",
                return_code=124,
            )

        return TestRunResult(
            success=process.returncode == 0,
            stdout=process.stdout,
            stderr=process.stderr,
            return_code=process.returncode,
        )
