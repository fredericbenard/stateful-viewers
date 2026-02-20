#!/usr/bin/env python3
"""CLI entry point for running experiments and evaluating results."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

# Ensure the research/ directory is on sys.path so `eval_pipeline` is importable.
_RESEARCH_DIR = Path(__file__).resolve().parent.parent
if str(_RESEARCH_DIR) not in sys.path:
    sys.path.insert(0, str(_RESEARCH_DIR))

from dotenv import load_dotenv
from rich.console import Console

from eval_pipeline.config_loader import load_experiment
from eval_pipeline.evaluator import evaluate_results, save_scores, scaffold_human_ratings
from eval_pipeline.manifest import save_manifest
from eval_pipeline.provider_factory import create_provider
from eval_pipeline.runner import run_experiment, save_run
from eval_pipeline.summarize import print_summary, save_summary, summarize_experiment
from eval_pipeline.types import EvalScore, PromptVariant, RunResult

console = Console()

OUTPUT_DIR = _RESEARCH_DIR / "output"


def main() -> None:
    load_dotenv(_RESEARCH_DIR / ".env")

    parser = argparse.ArgumentParser(
        description="Run an LLM evaluation experiment."
    )
    parser.add_argument(
        "--experiment", "-e",
        required=True,
        help="Experiment id (directory name under experiments/).",
    )
    parser.add_argument(
        "--provider", "-p",
        default=None,
        help="Override provider (openai, anthropic, gemini).",
    )
    parser.add_argument(
        "--model", "-m",
        default=None,
        help="Override model name.",
    )
    parser.add_argument(
        "--evaluate",
        action="store_true",
        help="Run LLM-as-judge evaluation after generating responses.",
    )
    parser.add_argument(
        "--evaluate-only",
        metavar="RUN_DIR",
        default=None,
        help="Evaluate existing results in the given run directory (skip generation).",
    )
    parser.add_argument(
        "--judge-provider",
        default=None,
        help="Provider for the judge LLM (defaults to same as --provider).",
    )
    parser.add_argument(
        "--judge-model",
        default=None,
        help="Model for the judge LLM (defaults to same as --model).",
    )
    parser.add_argument(
        "--summarize",
        action="store_true",
        help="Summarize scores across all runs of the experiment (no generation or evaluation).",
    )
    parser.add_argument(
        "--show",
        metavar="RUN_DIR",
        default=None,
        help="Show scores and responses for an existing run directory (no API calls).",
    )

    args = parser.parse_args()

    if args.show:
        _show_run(Path(args.show))
        return

    if args.summarize:
        summary = summarize_experiment(OUTPUT_DIR, args.experiment)
        if summary:
            print_summary(summary)
            save_summary(OUTPUT_DIR, summary)
        return

    config, prompts, criteria = load_experiment(
        args.experiment,
        provider_override=args.provider,
        model_override=args.model,
    )

    if args.evaluate_only:
        _evaluate_existing(args, config, prompts, criteria)
        return

    # --- Run generation ---
    provider = create_provider(config.provider, config.model)
    results = run_experiment(config, prompts, config.images, provider)

    if not results:
        console.print("[red]No results generated.[/red]")
        sys.exit(1)

    run_dir = save_run(OUTPUT_DIR, config, prompts, results)
    save_manifest(run_dir)
    scaffold_human_ratings(run_dir, results, criteria)

    # --- Evaluate if requested ---
    if args.evaluate:
        _run_evaluation(args, config, run_dir, results, prompts, criteria)

    console.print("\n[bold green]Done.[/bold green]\n")


def _load_prompts_from_run(run_dir: Path) -> list[PromptVariant]:
    """Load prompts from a previous run's prompts.json."""
    prompts_path = run_dir / "prompts.json"
    if not prompts_path.is_file():
        console.print(f"[red]prompts.json not found in {run_dir}[/red]")
        sys.exit(1)

    raw = json.loads(prompts_path.read_text())
    return [
        PromptVariant(
            id=p["id"],
            name=p["name"],
            system_prompt=p["system_prompt"],
            user_prompt=p["user_prompt"],
        )
        for p in raw
    ]


def _evaluate_existing(args, config, prompts, criteria) -> None:
    """Load results from an existing run directory and evaluate them."""
    run_dir = Path(args.evaluate_only)
    if not run_dir.is_dir():
        console.print(f"[red]Run directory not found: {run_dir}[/red]")
        sys.exit(1)

    results_path = run_dir / "results.json"
    if not results_path.is_file():
        console.print(f"[red]results.json not found in {run_dir}[/red]")
        sys.exit(1)

    raw = json.loads(results_path.read_text())
    results = [
        RunResult(
            id=r["id"],
            prompt_variant_id=r["prompt_variant_id"],
            image_id=r["image_id"],
            provider=r["provider"],
            model=r["model"],
            raw_response=r["raw_response"],
            timestamp=r["timestamp"],
            latency_ms=r["latency_ms"],
        )
        for r in raw
    ]

    run_prompts_path = run_dir / "prompts.json"
    if run_prompts_path.is_file():
        prompts = _load_prompts_from_run(run_dir)
        console.print(
            f"[cyan]Loaded {len(prompts)} prompt(s) from run directory[/cyan]\n"
        )

    _run_evaluation(args, config, run_dir, results, prompts, criteria)
    console.print("\n[bold green]Done.[/bold green]\n")


def _run_evaluation(args, config, run_dir, results, prompts, criteria) -> None:
    judge_provider_name = args.judge_provider or config.provider
    judge_model = args.judge_model or config.model
    judge = create_provider(judge_provider_name, judge_model)

    judge_name = f"{judge_provider_name}/{judge_model}"
    scores, judge_prompts = evaluate_results(
        results,
        prompts,
        criteria,
        judge,
        judge_model_name=judge_name,
    )
    save_scores(run_dir, scores, judge_model_name=judge_name, judge_prompts=judge_prompts)

    _print_summary(results, scores, criteria)


def _print_summary(
    results: list[RunResult],
    scores: list[EvalScore],
    criteria,
) -> None:
    """Print a compact summary table of scores by variant and criterion."""
    from rich.table import Table

    variant_ids = sorted({r.prompt_variant_id for r in results})
    criterion_ids = [c.id for c in criteria]

    score_map: dict[tuple[str, str], list[int]] = {}
    for s in scores:
        result = next((r for r in results if r.id == s.run_result_id), None)
        if not result:
            continue
        key = (result.prompt_variant_id, s.criterion_id)
        score_map.setdefault(key, []).append(s.score)

    table = Table(title="Evaluation Summary", show_lines=True)
    table.add_column("Variant", style="bold")
    for cid in criterion_ids:
        table.add_column(cid, justify="center")

    for vid in variant_ids:
        row = [vid]
        for cid in criterion_ids:
            vals = score_map.get((vid, cid), [])
            if vals:
                avg = sum(vals) / len(vals)
                row.append(f"{avg:.1f}")
            else:
                row.append("-")
        table.add_row(*row)

    console.print()
    console.print(table)


def _show_run(run_dir: Path) -> None:
    """Display the Evaluation Summary table for an existing run (same as --evaluate output)."""
    from rich.table import Table

    if not run_dir.is_dir():
        console.print(f"[red]Run directory not found: {run_dir}[/red]")
        sys.exit(1)

    results_path = run_dir / "results.json"
    scores_path = run_dir / "scores.json"
    if not results_path.is_file():
        console.print(f"[red]results.json not found in {run_dir}[/red]")
        sys.exit(1)
    if not scores_path.is_file():
        console.print(f"[red]scores.json not found in {run_dir} (run with --evaluate first)[/red]")
        sys.exit(1)

    results_raw = json.loads(results_path.read_text())
    scores_raw = json.loads(scores_path.read_text())
    result_map = {r["id"]: r["prompt_variant_id"] for r in results_raw}

    variant_ids = sorted({r["prompt_variant_id"] for r in results_raw})
    criterion_ids = sorted({s["criterion_id"] for s in scores_raw})

    score_map: dict[tuple[str, str], list[int]] = {}
    for s in scores_raw:
        vid = result_map.get(s["run_result_id"])
        if vid:
            score_map.setdefault((vid, s["criterion_id"]), []).append(s["score"])

    table = Table(title="Evaluation Summary", show_lines=True)
    table.add_column("Variant", style="bold")
    for cid in criterion_ids:
        table.add_column(cid, justify="center")

    for vid in variant_ids:
        row = [vid]
        for cid in criterion_ids:
            vals = score_map.get((vid, cid), [])
            if vals:
                avg = sum(vals) / len(vals)
                row.append(f"{avg:.1f}")
            else:
                row.append("-")
        table.add_row(*row)

    console.print()
    console.print(table)


if __name__ == "__main__":
    main()
