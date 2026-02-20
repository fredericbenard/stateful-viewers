#!/usr/bin/env python3
"""Run a stateful gallery walk: generate or load profile/style/state, then
reflect on each image sequentially with state carryover.

Usage examples:

  # Generate all artifacts, walk through the gallery, and evaluate:
  python scripts/run_stateful.py --evaluate

  # Use saved artifacts from previous generation runs:
  python scripts/run_stateful.py \
    --profile output/profile_generation/2026-02-19T.../results.json:hint_unusual_combo \
    --style output/style_generation/2026-02-19T.../results.json:hint_terse_fragmented \
    --initial-state output/initial_state_generation/2026-02-19T.../results.json:hint_melancholic_open

  # Use inline text (for quick testing):
  python scripts/run_stateful.py --profile-text "Tolerance for ambiguity is high..."

  # Override provider/model:
  python scripts/run_stateful.py --provider anthropic --model claude-sonnet-4-5-20250514

  # Show results from a previous run:
  python scripts/run_stateful.py --show output/stateful_reflection/2026-02-19T.../

  # Evaluate an existing run:
  python scripts/run_stateful.py --evaluate-only output/stateful_reflection/2026-02-19T.../
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_RESEARCH_DIR = Path(__file__).resolve().parent.parent
if str(_RESEARCH_DIR) not in sys.path:
    sys.path.insert(0, str(_RESEARCH_DIR))

from dotenv import load_dotenv
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
from rich.table import Table

import yaml

from eval_pipeline.image_utils import load_image_as_base64
from eval_pipeline.parametric import generate_parametric_variants
from eval_pipeline.provider_factory import create_provider
from eval_pipeline.types import (
    EvalCriterion,
    ExperimentConfig,
    ImageInput,
    PromptVariant,
    RunResult,
    TokenUsage,
)
from eval_pipeline.evaluator import evaluate_results, save_scores, scaffold_human_ratings

console = Console()

OUTPUT_DIR = _RESEARCH_DIR / "output"
EXPERIMENTS_DIR = _RESEARCH_DIR / "experiments"


# ---------------------------------------------------------------------------
# Parsing [REFLECTION] and [STATE] from model output
# ---------------------------------------------------------------------------

def parse_reflection_and_state(text: str) -> tuple[str, str]:
    """Extract reflection and state text from a [REFLECTION]...[STATE]... response."""
    reflection = ""
    state = ""

    ref_match = re.search(
        r"\[REFLECTION\]\s*\n\s*\n(.*?)(?=\[STATE\]|\Z)",
        text,
        re.DOTALL,
    )
    if ref_match:
        reflection = ref_match.group(1).strip()

    state_match = re.search(
        r"\[STATE\]\s*\n\s*\n(.*)",
        text,
        re.DOTALL,
    )
    if state_match:
        state = state_match.group(1).strip()

    return reflection, state


# ---------------------------------------------------------------------------
# Artifact loading
# ---------------------------------------------------------------------------

def _load_artifact_from_results(path_spec: str) -> str:
    """Load an artifact from a results.json file.

    ``path_spec`` is either:
      - ``path/to/results.json:variant_id`` — load the response for that variant
      - ``path/to/results.json`` — load the first result
    """
    parts = path_spec.rsplit(":", 1)
    results_path = Path(parts[0])
    variant_id = parts[1] if len(parts) > 1 else None

    if not results_path.is_file():
        raise FileNotFoundError(f"Results file not found: {results_path}")

    raw = json.loads(results_path.read_text())
    if variant_id:
        matches = [r for r in raw if r["prompt_variant_id"] == variant_id]
        if not matches:
            available = sorted({r["prompt_variant_id"] for r in raw})
            raise ValueError(
                f"Variant '{variant_id}' not found in {results_path}. "
                f"Available: {available}"
            )
        return matches[0]["raw_response"]
    return raw[0]["raw_response"]


def _load_artifact(
    file_spec: str | None,
    inline_text: str | None,
    experiment_id: str,
    label: str,
    provider: Any,
    config: ExperimentConfig,
) -> str:
    """Resolve an artifact from: inline text, file reference, or generation."""
    if inline_text:
        console.print(f"  {label}: [dim]inline text ({len(inline_text)} chars)[/dim]")
        return inline_text

    if file_spec:
        json_part = file_spec.rsplit(":", 1)[0] if ":" in file_spec else file_spec
        if json_part.endswith(".json"):
            text = _load_artifact_from_results(file_spec)
        else:
            p = Path(file_spec)
            if not p.is_file():
                raise FileNotFoundError(f"Artifact file not found: {p}")
            text = p.read_text().strip()
        console.print(f"  {label}: [dim]loaded from {file_spec} ({len(text)} chars)[/dim]")
        return text

    return _generate_artifact(experiment_id, label, provider, config)


def _generate_artifact(
    experiment_id: str,
    label: str,
    provider: Any,
    config: ExperimentConfig,
    *,
    use_parametric: bool = True,
) -> str:
    """Generate an artifact using a parametric (or fixed) prompt variant."""
    if use_parametric:
        variants = generate_parametric_variants(experiment_id, 1, EXPERIMENTS_DIR)
    else:
        exp_dir = EXPERIMENTS_DIR / experiment_id
        prompts_path = exp_dir / "prompts.yaml"
        if not prompts_path.is_file():
            raise FileNotFoundError(
                f"Cannot generate {label}: {prompts_path} not found. "
                f"Provide --{label.lower().replace(' ', '-')} or "
                f"--{label.lower().replace(' ', '-')}-text instead."
            )
        raw = yaml.safe_load(prompts_path.read_text())
        raw_variants = raw.get("variants", [])
        if not raw_variants:
            raise ValueError(f"No variants found in {prompts_path}")
        v = random.choice(raw_variants)
        from eval_pipeline.types import PromptVariant as PV
        variants = [PV(
            id=v["id"], name=v["name"],
            system_prompt=v["system_prompt"].strip(),
            user_prompt=v["user_prompt"].strip(),
        )]

    variant = variants[0]
    console.print(
        f"  {label}: [cyan]generating[/cyan] "
        f"(variant: {variant.id}, provider: {config.provider}/{config.model})"
    )

    resp = provider.generate_text(
        system_prompt=variant.system_prompt,
        user_prompt=variant.user_prompt,
        temperature=config.temperature,
        max_tokens=1024,
    )
    console.print(f"  {label}: [green]generated[/green] ({len(resp.content)} chars, {resp.latency_ms}ms)")
    return resp.content


# ---------------------------------------------------------------------------
# Sequential gallery walk
# ---------------------------------------------------------------------------

def run_gallery_walk(
    config: ExperimentConfig,
    images: list[ImageInput],
    system_prompt: str,
    user_prompt_template: str,
    profile: str,
    style: str,
    initial_state: str,
    provider: Any,
) -> tuple[list[RunResult], list[str]]:
    """Run the sequential gallery walk and return results + assembled prompts."""

    results: list[RunResult] = []
    assembled_prompts: list[str] = []
    current_state = initial_state

    console.print(
        f"\nGallery walk: {len(images)} image(s)\n"
        f"Provider: [cyan]{config.provider}[/cyan]  Model: [cyan]{config.model}[/cyan]\n"
    )

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        TimeElapsedColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("Walking...", total=len(images))

        for i, image in enumerate(images):
            progress.update(task, description=f"Image {i + 1}/{len(images)}: [{image.id}]")

            image_b64, mime_type = load_image_as_base64(image.source)

            user_prompt = user_prompt_template.format(
                profile=profile,
                style=style,
                current_state=current_state,
            )

            if image.caption:
                user_prompt = f'{user_prompt}\n\nThe image caption: "{image.caption}"'

            assembled_prompts.append(user_prompt)

            resp = provider.generate(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                image_base64=image_b64,
                mime_type=mime_type,
                temperature=config.temperature,
                max_tokens=config.max_tokens,
            )

            reflection, new_state = parse_reflection_and_state(resp.content)

            if new_state:
                current_state = new_state
            else:
                console.print(
                    f"  [yellow]Warning: no [STATE] block parsed from image {i + 1} "
                    f"({image.id}). Carrying forward previous state.[/yellow]"
                )

            result = RunResult(
                prompt_variant_id=f"reflection/{image.id}",
                image_id=image.id,
                provider=config.provider,
                model=config.model,
                raw_response=resp.content,
                latency_ms=resp.latency_ms,
                token_usage=TokenUsage(
                    prompt_tokens=resp.prompt_tokens,
                    completion_tokens=resp.completion_tokens,
                ),
            )
            results.append(result)
            progress.advance(task)

    console.print(f"\n[green]Completed gallery walk: {len(results)} reflection(s).[/green]\n")
    return results, assembled_prompts


# ---------------------------------------------------------------------------
# Save / show
# ---------------------------------------------------------------------------

def save_run(
    config: ExperimentConfig,
    results: list[RunResult],
    artifacts: dict[str, str],
    assembled_prompts: list[str] | None = None,
    system_prompt: str = "",
) -> Path:
    """Save results, artifacts, and assembled prompts to a timestamped output directory."""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S")
    run_dir = OUTPUT_DIR / config.experiment_id / timestamp
    run_dir.mkdir(parents=True, exist_ok=True)

    (run_dir / "config.json").write_text(
        json.dumps(config.to_dict(), indent=2, ensure_ascii=False) + "\n"
    )
    (run_dir / "artifacts.json").write_text(
        json.dumps(artifacts, indent=2, ensure_ascii=False) + "\n"
    )
    (run_dir / "results.json").write_text(
        json.dumps([r.to_dict() for r in results], indent=2, ensure_ascii=False) + "\n"
    )

    if assembled_prompts is not None:
        prompt_records = [
            {
                "result_id": r.id,
                "prompt_variant_id": r.prompt_variant_id,
                "system_prompt": system_prompt,
                "user_prompt": p,
            }
            for r, p in zip(results, assembled_prompts)
        ]
        (run_dir / "assembled_prompts.json").write_text(
            json.dumps(prompt_records, indent=2, ensure_ascii=False) + "\n"
        )

    console.print(f"Results saved to [bold]{run_dir}[/bold]")
    return run_dir


def show_run(run_dir: Path) -> None:
    """Display trajectory and scores for an existing run."""
    if not run_dir.is_dir():
        console.print(f"[red]Run directory not found: {run_dir}[/red]")
        sys.exit(1)

    artifacts_path = run_dir / "artifacts.json"
    results_path = run_dir / "results.json"

    if artifacts_path.is_file():
        artifacts = json.loads(artifacts_path.read_text())
        console.print("\n[bold]Profile:[/bold]")
        console.print(artifacts.get("profile", "(not found)")[:200] + "...")
        console.print("\n[bold]Style:[/bold]")
        console.print(artifacts.get("style", "(not found)")[:200] + "...")
        console.print("\n[bold]Initial state:[/bold]")
        console.print(artifacts.get("initial_state", "(not found)"))

    if results_path.is_file():
        results_raw = json.loads(results_path.read_text())
        console.print(f"\n[bold]Trajectory ({len(results_raw)} images):[/bold]\n")
        for i, r in enumerate(results_raw):
            reflection, state = parse_reflection_and_state(r["raw_response"])
            console.print(f"[bold cyan]Image {i + 1}: {r['image_id']}[/bold cyan]")
            console.print(f"[dim]({r['latency_ms']}ms, {r.get('token_usage', {}).get('completion_tokens', '?')} tokens)[/dim]")
            console.print(f"\n{reflection}\n")
            console.print(f"[dim]State: {state}[/dim]\n")

    scores_path = run_dir / "scores.json"
    if scores_path.is_file():
        scores_raw = json.loads(scores_path.read_text())
        criterion_ids = sorted({s["criterion_id"] for s in scores_raw})
        table = Table(title="Evaluation Scores", show_lines=True)
        table.add_column("Image", style="bold")
        for cid in criterion_ids:
            table.add_column(cid, justify="center")

        result_map = {r["id"]: r["image_id"] for r in json.loads(results_path.read_text())}
        image_scores: dict[str, dict[str, list[int]]] = {}
        for s in scores_raw:
            img_id = result_map.get(s["run_result_id"], "?")
            image_scores.setdefault(img_id, {}).setdefault(s["criterion_id"], []).append(s["score"])

        for img_id in sorted(image_scores.keys()):
            row = [img_id]
            for cid in criterion_ids:
                vals = image_scores[img_id].get(cid, [])
                if vals:
                    avg = sum(vals) / len(vals)
                    row.append(f"{avg:.1f}")
                else:
                    row.append("-")
            table.add_row(*row)

        console.print()
        console.print(table)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    load_dotenv(_RESEARCH_DIR / ".env")

    parser = argparse.ArgumentParser(
        description="Run a stateful gallery walk experiment.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--provider", "-p", default=None, help="Override provider.")
    parser.add_argument("--model", "-m", default=None, help="Override model.")

    parser.add_argument("--profile", default=None, help="Path to profile (results.json:variant_id or text file).")
    parser.add_argument("--profile-text", default=None, help="Inline profile text.")
    parser.add_argument("--style", default=None, help="Path to style (results.json:variant_id or text file).")
    parser.add_argument("--style-text", default=None, help="Inline style text.")
    parser.add_argument("--initial-state", default=None, help="Path to initial state (results.json:variant_id or text file).")
    parser.add_argument("--initial-state-text", default=None, help="Inline initial state text.")

    parser.add_argument(
        "--reuse-artifacts", metavar="RUN_DIR", default=None,
        help="Load profile/style/initial-state from a previous stateful run's artifacts.json.",
    )

    parser.add_argument("--evaluate", action="store_true", help="Evaluate after running.")
    parser.add_argument("--evaluate-only", metavar="RUN_DIR", default=None, help="Evaluate an existing run.")
    parser.add_argument("--judge-provider", default=None, help="Provider for judge LLM.")
    parser.add_argument("--judge-model", default=None, help="Model for judge LLM.")
    parser.add_argument("--show", metavar="RUN_DIR", default=None, help="Show results from existing run.")

    args = parser.parse_args()

    if args.show:
        show_run(Path(args.show))
        return

    exp_dir = EXPERIMENTS_DIR / "stateful_reflection"
    config_raw = yaml.safe_load((exp_dir / "config.yaml").read_text())

    config = ExperimentConfig(
        experiment_id=config_raw["experiment_id"],
        provider=args.provider or config_raw.get("provider", "openai"),
        model=args.model or config_raw.get("model", "gpt-5.2"),
        temperature=config_raw.get("temperature", 0.7),
        max_tokens=config_raw.get("max_tokens", 2048),
        images=[
            ImageInput(id=img["id"], source=img["source"], caption=img.get("caption"))
            for img in config_raw.get("images", [])
        ],
    )

    prompts_raw = yaml.safe_load((exp_dir / "prompts.yaml").read_text())
    system_prompt = prompts_raw["system_prompt"].strip()
    user_prompt_template = prompts_raw["user_prompt_template"].strip()

    criteria_raw = yaml.safe_load((exp_dir / "criteria.yaml").read_text())
    criteria = [
        EvalCriterion(
            id=c["id"],
            name=c["name"],
            description=c["description"].strip(),
            scoring_prompt=c["scoring_prompt"].strip(),
        )
        for c in criteria_raw.get("criteria", [])
    ]

    if args.evaluate_only:
        _evaluate_existing(args, config, criteria, system_prompt, user_prompt_template)
        return

    provider = create_provider(config.provider, config.model)

    console.print("\n[bold]Resolving artifacts...[/bold]")

    if args.reuse_artifacts:
        artifacts_path = Path(args.reuse_artifacts) / "artifacts.json"
        if not artifacts_path.is_file():
            console.print(f"[red]artifacts.json not found in {args.reuse_artifacts}[/red]")
            sys.exit(1)
        saved = json.loads(artifacts_path.read_text())
        profile = saved["profile"]
        style = saved["style"]
        initial_state = saved["initial_state"]
        console.print(
            f"  Reusing artifacts from [cyan]{args.reuse_artifacts}[/cyan] "
            f"(profile: {len(profile)} chars, style: {len(style)} chars, "
            f"state: {len(initial_state)} chars)"
        )
    else:
        profile = _load_artifact(args.profile, args.profile_text, "profile_generation", "Profile", provider, config)
        style = _load_artifact(args.style, args.style_text, "style_generation", "Style", provider, config)
        initial_state = _load_artifact(args.initial_state, args.initial_state_text, "initial_state_generation", "Initial state", provider, config)

    results, assembled_prompts = run_gallery_walk(
        config=config,
        images=config.images,
        system_prompt=system_prompt,
        user_prompt_template=user_prompt_template,
        profile=profile,
        style=style,
        initial_state=initial_state,
        provider=provider,
    )

    if not results:
        console.print("[red]No results generated.[/red]")
        sys.exit(1)

    artifacts = {
        "profile": profile,
        "style": style,
        "initial_state": initial_state,
    }
    run_dir = save_run(config, results, artifacts, assembled_prompts, system_prompt)

    prompts_for_eval = [
        PromptVariant(
            id=result.prompt_variant_id,
            name=f"Stateful reflection ({result.image_id})",
            system_prompt=system_prompt,
            user_prompt=assembled_prompt,
        )
        for result, assembled_prompt in zip(results, assembled_prompts)
    ]
    scaffold_human_ratings(run_dir, results, criteria)

    if args.evaluate:
        judge_provider_name = args.judge_provider or config.provider
        judge_model = args.judge_model or config.model
        judge = create_provider(judge_provider_name, judge_model)
        judge_name = f"{judge_provider_name}/{judge_model}"

        scores = evaluate_results(
            results,
            prompts_for_eval,
            criteria,
            judge,
            judge_model_name=judge_name,
        )
        save_scores(run_dir, scores, judge_model_name=judge_name)

    show_run(run_dir)
    console.print("\n[bold green]Done.[/bold green]\n")


def _evaluate_existing(args, config, criteria, system_prompt, user_prompt_template) -> None:
    run_dir = Path(args.evaluate_only)
    if not run_dir.is_dir():
        console.print(f"[red]Run directory not found: {run_dir}[/red]")
        sys.exit(1)

    results_raw = json.loads((run_dir / "results.json").read_text())
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
        for r in results_raw
    ]

    prompts_for_eval = _rebuild_prompts_for_eval(
        run_dir, results, system_prompt, user_prompt_template
    )

    judge_provider_name = args.judge_provider or config.provider
    judge_model = args.judge_model or config.model
    judge = create_provider(judge_provider_name, judge_model)
    judge_name = f"{judge_provider_name}/{judge_model}"

    scores = evaluate_results(
        results,
        prompts_for_eval,
        criteria,
        judge,
        judge_model_name=judge_name,
    )
    save_scores(run_dir, scores, judge_model_name=judge_name)
    show_run(run_dir)
    console.print("\n[bold green]Done.[/bold green]\n")


def _rebuild_prompts_for_eval(
    run_dir: Path,
    results: list[RunResult],
    system_prompt: str,
    user_prompt_template: str,
) -> list[PromptVariant]:
    """Rebuild per-result PromptVariant objects for evaluation.

    Tries three sources in order:
    1. assembled_prompts.json (saved by newer runs)
    2. Reconstruction from artifacts.json + state replay
    3. Fallback to the raw template (will produce inaccurate adherence scores)
    """
    assembled_path = run_dir / "assembled_prompts.json"
    if assembled_path.is_file():
        records = json.loads(assembled_path.read_text())
        return [
            PromptVariant(
                id=rec["prompt_variant_id"],
                name=f"Stateful reflection",
                system_prompt=rec.get("system_prompt", system_prompt),
                user_prompt=rec["user_prompt"],
            )
            for rec in records
        ]

    artifacts_path = run_dir / "artifacts.json"
    if artifacts_path.is_file():
        console.print(
            "[yellow]No assembled_prompts.json found — reconstructing from "
            "artifacts + state replay.[/yellow]"
        )
        artifacts = json.loads(artifacts_path.read_text())
        current_state = artifacts["initial_state"]
        prompts: list[PromptVariant] = []

        for r in results:
            assembled = user_prompt_template.format(
                profile=artifacts["profile"],
                style=artifacts["style"],
                current_state=current_state,
            )
            prompts.append(
                PromptVariant(
                    id=r.prompt_variant_id,
                    name=f"Stateful reflection ({r.image_id})",
                    system_prompt=system_prompt,
                    user_prompt=assembled,
                )
            )
            _, new_state = parse_reflection_and_state(r.raw_response)
            if new_state:
                current_state = new_state

        return prompts

    console.print(
        "[yellow]Warning: no assembled_prompts.json or artifacts.json found. "
        "Using raw template — adherence scores may be inaccurate.[/yellow]"
    )
    return [
        PromptVariant(
            id=r.prompt_variant_id,
            name="Stateful reflection",
            system_prompt=system_prompt,
            user_prompt=user_prompt_template,
        )
        for r in results
    ]


if __name__ == "__main__":
    main()
