#!/usr/bin/env python3
"""Run a full contrastive stateful-reflection experiment.

Picks a set of artifacts (profile, style, initial state) from existing
generation runs and runs the complete 2×2 matrix:

  1. GPT-5.2 generation  (+self-eval)
  2. Claude cross-judge on GPT output
  3. Claude generation with --reuse-artifacts  (+self-eval)
  4. GPT cross-judge on Claude output

Usage:

  # Run with the default "high-ambiguity" artifact set
  python scripts/run_contrastive_stateful.py

  # Dry-run: print commands without executing
  python scripts/run_contrastive_stateful.py --dry-run

  # Custom artifact selection
  python scripts/run_contrastive_stateful.py \
    --profile output/profile_generation/2026-02-20T00-41-51/results.json:parametric_001_high_stro_more_symb \
    --style   output/style_generation/2026-02-20T00-44-27/results.json:parametric_006_mixe_lite \
    --state   output/initial_state_generation/2026-02-20T00-46-27/results.json:parametric_004_depl_cont
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

RESEARCH_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DIR = RESEARCH_DIR / "output" / "stateful_reflection"

DEFAULTS = {
    "profile": "output/profile_generation/2026-02-20T00-41-51/results.json:parametric_001_high_stro_more_symb",
    "style": "output/style_generation/2026-02-20T00-44-27/results.json:parametric_006_mixe_lite",
    "state": "output/initial_state_generation/2026-02-20T00-46-27/results.json:parametric_004_depl_cont",
}


def _newest_run_dir() -> Path | None:
    """Return the most recently created run directory."""
    if not OUTPUT_DIR.is_dir():
        return None
    dirs = sorted(OUTPUT_DIR.iterdir(), key=lambda d: d.name, reverse=True)
    return dirs[0] if dirs else None


def _run(cmd: list[str], *, dry_run: bool = False, label: str = "") -> None:
    header = f"\n{'=' * 60}\n  {label}\n{'=' * 60}"
    print(header)
    print(f"  cmd: {' '.join(cmd)}\n")
    if dry_run:
        print("  [dry-run] skipped\n")
        return
    result = subprocess.run(cmd, cwd=RESEARCH_DIR)
    if result.returncode != 0:
        print(f"\n  *** FAILED (exit {result.returncode}) ***\n")
        sys.exit(result.returncode)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run contrastive stateful-reflection 2×2 experiment."
    )
    parser.add_argument(
        "--profile", default=DEFAULTS["profile"],
        help="Profile artifact (results.json:variant_id).",
    )
    parser.add_argument(
        "--style", default=DEFAULTS["style"],
        help="Style artifact (results.json:variant_id).",
    )
    parser.add_argument(
        "--state", default=DEFAULTS["state"],
        help="Initial-state artifact (results.json:variant_id).",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print commands only.")
    args = parser.parse_args()

    py = sys.executable
    script = str(RESEARCH_DIR / "scripts" / "run_stateful.py")

    # ── Step 1: GPT generation + GPT self-eval ──────────────────────
    before = _newest_run_dir()

    _run(
        [
            py, script,
            "-p", "openai", "-m", "gpt-5.2",
            "--profile", args.profile,
            "--style", args.style,
            "--initial-state", args.state,
            "--evaluate",
        ],
        dry_run=args.dry_run,
        label="Step 1/4: GPT-5.2 generation + GPT self-eval",
    )

    gpt_run_dir = _newest_run_dir()
    if not args.dry_run:
        if gpt_run_dir == before or gpt_run_dir is None:
            print("ERROR: Could not detect new GPT run directory.")
            sys.exit(1)
        print(f"  GPT run dir: {gpt_run_dir}\n")
    else:
        gpt_run_dir = Path("output/stateful_reflection/<GPT_TIMESTAMP>")

    # ── Step 2: Claude cross-judge on GPT output ────────────────────
    _run(
        [
            py, script,
            "--evaluate-only", str(gpt_run_dir),
            "--judge-provider", "anthropic",
            "--judge-model", "claude-opus-4-6",
        ],
        dry_run=args.dry_run,
        label="Step 2/4: Claude cross-judge on GPT output",
    )

    # ── Step 3: Claude generation + Claude self-eval ────────────────
    before_claude = _newest_run_dir()

    _run(
        [
            py, script,
            "-p", "anthropic", "-m", "claude-opus-4-6",
            "--reuse-artifacts", str(gpt_run_dir),
            "--evaluate",
        ],
        dry_run=args.dry_run,
        label="Step 3/4: Claude generation + Claude self-eval (reusing artifacts)",
    )

    claude_run_dir = _newest_run_dir()
    if not args.dry_run:
        if claude_run_dir == before_claude or claude_run_dir is None:
            print("ERROR: Could not detect new Claude run directory.")
            sys.exit(1)
        print(f"  Claude run dir: {claude_run_dir}\n")
    else:
        claude_run_dir = Path("output/stateful_reflection/<CLAUDE_TIMESTAMP>")

    # ── Step 4: GPT cross-judge on Claude output ────────────────────
    _run(
        [
            py, script,
            "--evaluate-only", str(claude_run_dir),
            "--judge-provider", "openai",
            "--judge-model", "gpt-5.2",
        ],
        dry_run=args.dry_run,
        label="Step 4/4: GPT cross-judge on Claude output",
    )

    # ── Summary ─────────────────────────────────────────────────────
    print(f"\n{'=' * 60}")
    print("  All 4 steps complete!")
    print(f"{'=' * 60}")
    if not args.dry_run:
        print(f"  GPT run:    {gpt_run_dir}")
        print(f"  Claude run: {claude_run_dir}")
    print(f"\n  Score files in each run dir:")
    print(f"    scores_openai_gpt-5.2.json")
    print(f"    scores_anthropic_claude-opus-4-6.json")
    print()


if __name__ == "__main__":
    main()
