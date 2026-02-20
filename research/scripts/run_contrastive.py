#!/usr/bin/env python3
"""Run a full 2×2 (generator × judge) stateful-reflection experiment.

For each experiment directory, runs:
  1. GPT-5.2 generation  + GPT self-eval
  2. Claude cross-judge on GPT output
  3. Claude generation   + Claude self-eval  (same frozen artifacts)
  4. GPT cross-judge on Claude output

Artifacts are loaded from the experiment's artifacts/ folder — no cross-run
filesystem dependencies.

Usage:
  # Single profile:
  python scripts/run_contrastive.py stateful_reflection_low_ambiguity

  # Multiple profiles in sequence:
  python scripts/run_contrastive.py stateful_reflection_low_ambiguity stateful_reflection_high_ambiguity

  # Dry-run:
  python scripts/run_contrastive.py stateful_reflection_low_ambiguity --dry-run
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

RESEARCH_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DIR = RESEARCH_DIR / "output"
EXPERIMENTS_DIR = RESEARCH_DIR / "experiments"

GPT_PROVIDER = "openai"
GPT_MODEL = "gpt-5.2"
CLAUDE_PROVIDER = "anthropic"
CLAUDE_MODEL = "claude-opus-4-6"


def _newest_run_dir(experiment_name: str) -> Path | None:
    """Return the most recently created run directory for this experiment."""
    exp_output = OUTPUT_DIR / experiment_name
    if not exp_output.is_dir():
        return None
    dirs = sorted(exp_output.iterdir(), key=lambda d: d.name, reverse=True)
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


def run_2x2(experiment_name: str, *, dry_run: bool = False) -> None:
    """Run the full 2×2 matrix for a single experiment."""
    exp_dir = EXPERIMENTS_DIR / experiment_name
    if not exp_dir.is_dir():
        print(f"Error: experiment directory not found: {exp_dir}")
        sys.exit(1)

    artifacts_dir = exp_dir / "artifacts"
    if not artifacts_dir.is_dir():
        print(f"Error: no artifacts/ directory in {exp_dir}. Run freeze_artifacts.py first.")
        sys.exit(1)

    print(f"\n{'#' * 60}")
    print(f"  Experiment: {experiment_name}")
    print(f"{'#' * 60}")

    py = sys.executable
    script = str(RESEARCH_DIR / "scripts" / "run_stateful.py")

    # Step 1: GPT generation + GPT self-eval
    before = _newest_run_dir(experiment_name)

    _run(
        [py, script, experiment_name, "-p", GPT_PROVIDER, "-m", GPT_MODEL, "--evaluate"],
        dry_run=dry_run,
        label=f"[{experiment_name}] Step 1/4: GPT generation + GPT self-eval",
    )

    gpt_run_dir = _newest_run_dir(experiment_name)
    if not dry_run:
        if gpt_run_dir == before or gpt_run_dir is None:
            print("ERROR: Could not detect new GPT run directory.")
            sys.exit(1)
        print(f"  GPT run dir: {gpt_run_dir}\n")
    else:
        gpt_run_dir = Path(f"output/{experiment_name}/<GPT_TIMESTAMP>")

    # Step 2: Claude cross-judge on GPT output
    _run(
        [py, script, experiment_name, "--evaluate-only", str(gpt_run_dir),
         "--judge-provider", CLAUDE_PROVIDER, "--judge-model", CLAUDE_MODEL],
        dry_run=dry_run,
        label=f"[{experiment_name}] Step 2/4: Claude cross-judge on GPT output",
    )

    # Step 3: Claude generation + Claude self-eval (same frozen artifacts)
    before_claude = _newest_run_dir(experiment_name)

    _run(
        [py, script, experiment_name, "-p", CLAUDE_PROVIDER, "-m", CLAUDE_MODEL, "--evaluate"],
        dry_run=dry_run,
        label=f"[{experiment_name}] Step 3/4: Claude generation + Claude self-eval",
    )

    claude_run_dir = _newest_run_dir(experiment_name)
    if not dry_run:
        if claude_run_dir == before_claude or claude_run_dir is None:
            print("ERROR: Could not detect new Claude run directory.")
            sys.exit(1)
        print(f"  Claude run dir: {claude_run_dir}\n")
    else:
        claude_run_dir = Path(f"output/{experiment_name}/<CLAUDE_TIMESTAMP>")

    # Step 4: GPT cross-judge on Claude output
    _run(
        [py, script, experiment_name, "--evaluate-only", str(claude_run_dir),
         "--judge-provider", GPT_PROVIDER, "--judge-model", GPT_MODEL],
        dry_run=dry_run,
        label=f"[{experiment_name}] Step 4/4: GPT cross-judge on Claude output",
    )

    print(f"\n{'=' * 60}")
    print(f"  [{experiment_name}] All 4 steps complete!")
    print(f"{'=' * 60}")
    if not dry_run:
        print(f"  GPT run:    {gpt_run_dir}")
        print(f"  Claude run: {claude_run_dir}")
    print(f"  Score files: scores_{GPT_PROVIDER}_{GPT_MODEL}.json, scores_{CLAUDE_PROVIDER}_{CLAUDE_MODEL}.json\n")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run 2×2 (generator × judge) contrastive experiments.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "experiments", nargs="+",
        help="One or more experiment directory names (e.g. stateful_reflection_low_ambiguity).",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print commands without executing.")

    args = parser.parse_args()

    for experiment_name in args.experiments:
        run_2x2(experiment_name, dry_run=args.dry_run)

    if len(args.experiments) > 1:
        print(f"\n{'#' * 60}")
        print(f"  All {len(args.experiments)} experiments complete.")
        print(f"{'#' * 60}\n")


if __name__ == "__main__":
    main()
