"""Run manifest: capture CLI args, git state, and environment for reproducibility."""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


def _git_sha(repo_dir: Path) -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"],
            cwd=repo_dir,
            stderr=subprocess.DEVNULL,
        ).decode().strip()
    except Exception:
        return "unknown"


def _git_dirty(repo_dir: Path) -> bool:
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=repo_dir,
            capture_output=True,
            text=True,
        )
        return bool(result.stdout.strip())
    except Exception:
        return False


def save_manifest(run_dir: Path, *, argv: list[str] | None = None) -> None:
    """Write ``run_manifest.json`` capturing the command and environment."""
    repo_dir = Path(__file__).resolve().parent.parent.parent

    manifest = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "argv": argv or sys.argv,
        "python_version": sys.version,
        "git_sha": _git_sha(repo_dir),
        "git_dirty": _git_dirty(repo_dir),
    }

    path = run_dir / "run_manifest.json"
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
