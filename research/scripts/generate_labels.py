#!/usr/bin/env python3
"""Generate short labels for artifacts in one or more generation runs.

Usage:

  # Label all variants in a profile generation run
  python scripts/generate_labels.py output/profile_generation/2026-02-20T00-41-51

  # Label multiple runs at once
  python scripts/generate_labels.py \
    output/profile_generation/2026-02-20T00-41-51 \
    output/style_generation/2026-02-20T00-44-27 \
    output/initial_state_generation/2026-02-20T00-46-27

  # Override provider/model for label generation
  python scripts/generate_labels.py --provider anthropic output/profile_generation/...

Labels are saved to labels.json in each run directory and printed to stdout.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_RESEARCH_DIR = Path(__file__).resolve().parent.parent
if str(_RESEARCH_DIR) not in sys.path:
    sys.path.insert(0, str(_RESEARCH_DIR))

from dotenv import load_dotenv
from rich.console import Console
from rich.table import Table

from eval_pipeline.labeler import generate_label
from eval_pipeline.provider_factory import create_provider

console = Console()

_EXPERIMENT_TO_TYPE = {
    "profile_generation": "profile",
    "style_generation": "style",
    "initial_state_generation": "initial_state",
}


def _detect_artifact_type(run_dir: Path) -> str:
    """Infer artifact type from the run directory path."""
    for parent in [run_dir.parent.name, run_dir.name]:
        if parent in _EXPERIMENT_TO_TYPE:
            return _EXPERIMENT_TO_TYPE[parent]
    return "profile"


def label_run(run_dir: Path, provider, artifact_type: str) -> dict[str, str]:
    """Generate labels for all results in a run. Returns {variant_id: label}."""
    results_path = run_dir / "results.json"
    if not results_path.is_file():
        console.print(f"[red]results.json not found in {run_dir}[/red]")
        return {}

    results = json.loads(results_path.read_text())
    labels: dict[str, str] = {}

    for r in results:
        vid = r["prompt_variant_id"]
        text = r["raw_response"]
        label = generate_label(text, artifact_type, provider)
        labels[vid] = label

    return labels


def main() -> None:
    load_dotenv(_RESEARCH_DIR / ".env")

    parser = argparse.ArgumentParser(description="Generate labels for run artifacts.")
    parser.add_argument("run_dirs", nargs="+", help="One or more run directories.")
    parser.add_argument("--provider", "-p", default="openai", help="Provider for labeling (default: openai).")
    parser.add_argument("--model", "-m", default=None, help="Model for labeling.")
    args = parser.parse_args()

    provider = create_provider(args.provider, args.model)

    for run_dir_str in args.run_dirs:
        run_dir = Path(run_dir_str)
        if not run_dir.is_dir():
            console.print(f"[red]Not a directory: {run_dir}[/red]")
            continue

        artifact_type = _detect_artifact_type(run_dir)
        console.print(
            f"\n[bold]{run_dir}[/bold] "
            f"(type: [cyan]{artifact_type}[/cyan])"
        )

        labels = label_run(run_dir, provider, artifact_type)
        if not labels:
            continue

        labels_path = run_dir / "labels.json"
        labels_path.write_text(
            json.dumps(labels, indent=2, ensure_ascii=False) + "\n"
        )
        console.print(f"Saved to [bold]{labels_path}[/bold]")

        table = Table(show_lines=True)
        table.add_column("Variant", style="bold")
        table.add_column("Label")
        for vid, label in labels.items():
            table.add_row(vid, label)
        console.print(table)

    console.print("\n[bold green]Done.[/bold green]\n")


if __name__ == "__main__":
    main()
