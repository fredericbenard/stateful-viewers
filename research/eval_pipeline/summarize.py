"""Aggregate and summarize scores across all runs of an experiment."""

from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from rich.console import Console
from rich.table import Table

console = Console()


def summarize_experiment(output_dir: Path, experiment_id: str) -> dict[str, Any]:
    """Load all runs for an experiment and return an aggregated summary.

    Returns a dict with per-variant, per-criterion stats (mean, min, max, count)
    and per-run metadata.
    """
    exp_dir = output_dir / experiment_id
    if not exp_dir.is_dir():
        console.print(f"[red]No output directory found: {exp_dir}[/red]")
        return {}

    run_dirs = sorted(
        [d for d in exp_dir.iterdir() if d.is_dir() and (d / "results.json").exists()]
    )
    if not run_dirs:
        console.print(f"[yellow]No runs found in {exp_dir}[/yellow]")
        return {}

    # Collect all scores keyed by (prompt_variant_id, criterion_id)
    scores_by_key: dict[tuple[str, str], list[int]] = defaultdict(list)
    # Also collect per-run metadata
    runs_meta: list[dict[str, Any]] = []
    # Result id -> prompt_variant_id mapping across all runs
    result_variant_map: dict[str, str] = {}

    for run_dir in run_dirs:
        results_path = run_dir / "results.json"
        scores_path = run_dir / "scores.json"
        config_path = run_dir / "config.json"

        results = json.loads(results_path.read_text())
        for r in results:
            result_variant_map[r["id"]] = r["prompt_variant_id"]

        run_meta: dict[str, Any] = {
            "run_dir": run_dir.name,
            "num_results": len(results),
        }
        if config_path.exists():
            config = json.loads(config_path.read_text())
            run_meta["provider"] = config.get("provider", "")
            run_meta["model"] = config.get("model", "")

        if scores_path.exists():
            scores = json.loads(scores_path.read_text())
            run_meta["num_scores"] = len(scores)
            for s in scores:
                variant_id = result_variant_map.get(s["run_result_id"], "unknown")
                key = (variant_id, s["criterion_id"])
                if s["score"] > 0:
                    scores_by_key[key].append(s["score"])
        else:
            run_meta["num_scores"] = 0

        runs_meta.append(run_meta)

    # Build aggregated stats
    all_variants = sorted({k[0] for k in scores_by_key})
    all_criteria = sorted({k[1] for k in scores_by_key})

    variant_stats: dict[str, dict[str, dict[str, Any]]] = {}
    for vid in all_variants:
        variant_stats[vid] = {}
        for cid in all_criteria:
            vals = scores_by_key.get((vid, cid), [])
            if vals:
                variant_stats[vid][cid] = {
                    "mean": round(sum(vals) / len(vals), 2),
                    "min": min(vals),
                    "max": max(vals),
                    "count": len(vals),
                }
            else:
                variant_stats[vid][cid] = {
                    "mean": None,
                    "min": None,
                    "max": None,
                    "count": 0,
                }

    summary = {
        "experiment_id": experiment_id,
        "num_runs": len(run_dirs),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "runs": runs_meta,
        "variants": all_variants,
        "criteria": all_criteria,
        "scores": variant_stats,
    }

    return summary


def print_summary(summary: dict[str, Any]) -> None:
    """Print a rich table summarizing scores across all runs."""
    if not summary:
        return

    variants = summary.get("variants", [])
    criteria = summary.get("criteria", [])
    scores = summary.get("scores", {})
    num_runs = summary.get("num_runs", 0)

    console.print(
        f"\n[bold]{summary['experiment_id']}[/bold] — "
        f"{num_runs} run(s)\n"
    )

    # Runs metadata
    runs_table = Table(title="Runs", show_lines=True)
    runs_table.add_column("Run", style="dim")
    runs_table.add_column("Provider")
    runs_table.add_column("Model")
    runs_table.add_column("Results", justify="center")
    runs_table.add_column("Scores", justify="center")
    for r in summary.get("runs", []):
        runs_table.add_row(
            r["run_dir"],
            r.get("provider", ""),
            r.get("model", ""),
            str(r.get("num_results", 0)),
            str(r.get("num_scores", 0)),
        )
    console.print(runs_table)

    # Mean scores table
    mean_table = Table(title="Mean scores (across all runs)", show_lines=True)
    mean_table.add_column("Variant", style="bold")
    for cid in criteria:
        mean_table.add_column(cid, justify="center")
    mean_table.add_column("avg", justify="center", style="bold")

    for vid in variants:
        row = [vid]
        row_vals = []
        for cid in criteria:
            stats = scores.get(vid, {}).get(cid, {})
            mean = stats.get("mean")
            count = stats.get("count", 0)
            if mean is not None:
                row.append(f"{mean:.1f} [dim](n={count})[/dim]")
                row_vals.append(mean)
            else:
                row.append("-")
        if row_vals:
            row.append(f"{sum(row_vals) / len(row_vals):.1f}")
        else:
            row.append("-")
        mean_table.add_row(*row)

    console.print()
    console.print(mean_table)

    # Range table (min-max) for quick spread visibility
    range_table = Table(title="Score ranges [min-max]", show_lines=True)
    range_table.add_column("Variant", style="bold")
    for cid in criteria:
        range_table.add_column(cid, justify="center")

    for vid in variants:
        row = [vid]
        for cid in criteria:
            stats = scores.get(vid, {}).get(cid, {})
            lo = stats.get("min")
            hi = stats.get("max")
            if lo is not None:
                row.append(f"{lo}-{hi}")
            else:
                row.append("-")
        range_table.add_row(*row)

    console.print()
    console.print(range_table)


def summarize_single_run(run_dir: Path) -> dict[str, Any]:
    """Build a summary dict for a single run directory.

    Uses the same structure as summarize_experiment so print_summary works
    for both single-run and multi-run summaries.
    """
    if not run_dir.is_dir():
        console.print(f"[red]Run directory not found: {run_dir}[/red]")
        return {}

    results_path = run_dir / "results.json"
    if not results_path.is_file():
        console.print(f"[red]results.json not found in {run_dir}[/red]")
        return {}

    results = json.loads(results_path.read_text())
    result_variant_map = {r["id"]: r["prompt_variant_id"] for r in results}

    config_path = run_dir / "config.json"
    config = json.loads(config_path.read_text()) if config_path.exists() else {}

    run_meta: dict[str, Any] = {
        "run_dir": run_dir.name,
        "num_results": len(results),
        "provider": config.get("provider", ""),
        "model": config.get("model", ""),
    }

    scores_by_key: dict[tuple[str, str], list[int]] = defaultdict(list)
    scores_path = run_dir / "scores.json"
    if scores_path.exists():
        scores = json.loads(scores_path.read_text())
        run_meta["num_scores"] = len(scores)
        for s in scores:
            variant_id = result_variant_map.get(s["run_result_id"], "unknown")
            key = (variant_id, s["criterion_id"])
            if s["score"] > 0:
                scores_by_key[key].append(s["score"])
    else:
        run_meta["num_scores"] = 0

    all_variants = sorted({k[0] for k in scores_by_key})
    all_criteria = sorted({k[1] for k in scores_by_key})

    variant_stats: dict[str, dict[str, dict[str, Any]]] = {}
    for vid in all_variants:
        variant_stats[vid] = {}
        for cid in all_criteria:
            vals = scores_by_key.get((vid, cid), [])
            if vals:
                variant_stats[vid][cid] = {
                    "mean": round(sum(vals) / len(vals), 2),
                    "min": min(vals),
                    "max": max(vals),
                    "count": len(vals),
                }
            else:
                variant_stats[vid][cid] = {"mean": None, "min": None, "max": None, "count": 0}

    experiment_id = config.get("experiment_id", run_dir.parent.name)

    return {
        "experiment_id": experiment_id,
        "num_runs": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "runs": [run_meta],
        "variants": all_variants,
        "criteria": all_criteria,
        "scores": variant_stats,
    }


def save_summary(output_dir: Path, summary: dict[str, Any]) -> Path:
    """Save the summary JSON to the experiment output directory."""
    exp_dir = output_dir / summary["experiment_id"]
    path = exp_dir / "summary.json"
    path.write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n")
    console.print(f"\nSummary saved to [bold]{path}[/bold]")
    return path
