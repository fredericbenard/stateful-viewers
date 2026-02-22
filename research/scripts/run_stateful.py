#!/usr/bin/env python3
"""Run a stateful gallery walk: load or generate profile/style/state, then
reflect on each image sequentially with state carryover.

Usage examples:

  # Run with frozen artifacts:
  python scripts/run_stateful.py stateful_reflection_low_ambiguity --evaluate
  python scripts/run_stateful.py stateful_reflection_high_ambiguity --evaluate

  # Override provider/model:
  python scripts/run_stateful.py stateful_reflection_low_ambiguity -p anthropic -m claude-opus-4-6 --evaluate

  # Show results from a previous run:
  python scripts/run_stateful.py stateful_reflection_low_ambiguity --show output/stateful_reflection_low_ambiguity/2026-02-.../

  # Evaluate an existing run:
  python scripts/run_stateful.py stateful_reflection_low_ambiguity --evaluate-only output/stateful_reflection_low_ambiguity/2026-02-.../
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

_RESEARCH_DIR = Path(__file__).resolve().parent.parent
if str(_RESEARCH_DIR) not in sys.path:
    sys.path.insert(0, str(_RESEARCH_DIR))

from dotenv import load_dotenv
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
from rich.table import Table

import yaml

from eval_pipeline.image_utils import load_image_as_base64
from eval_pipeline.provider_factory import create_provider
from eval_pipeline.providers.base import VisionProvider
from eval_pipeline.types import (
    EvalCriterion,
    ExperimentConfig,
    ImageInput,
    PromptVariant,
    RunResult,
    TokenUsage,
)
from eval_pipeline.evaluator import evaluate_results, save_scores, scaffold_human_ratings
from eval_pipeline.manifest import save_manifest

console = Console()

OUTPUT_DIR = _RESEARCH_DIR / "output"
EXPERIMENTS_DIR = _RESEARCH_DIR / "experiments"


# ---------------------------------------------------------------------------
# Parsing [REFLECTION] and [STATE] from model output
# ---------------------------------------------------------------------------

def parse_reflection_and_state(text: str) -> tuple[str, str]:
    """Extract reflection and state text from a [REFLECTION]...[STATE]... response."""
    # Keep parsing tolerant and aligned with the app's parser (`src/lib/parseReflection.ts`):
    # - accept optional markdown bold **[STATE]**
    # - accept optional colon ([STATE]: ...)
    # - accept tag and content on same line or next line
    # - case-insensitive
    raw = text.strip()

    reflection_match = re.search(
        r"\*{0,2}\[REFLECTION\]\*{0,2}\s*:?\s*\n?([\s\S]*?)(?=\n\s*\*{0,2}\[STATE\]\*{0,2}|$)",
        raw,
        re.IGNORECASE,
    )
    state_match = re.search(
        r"\*{0,2}\[STATE\]\*{0,2}\s*:?\s*\n?([\s\S]*?)$",
        raw,
        re.IGNORECASE | re.MULTILINE,
    )

    if reflection_match and state_match:
        return reflection_match.group(1).strip(), state_match.group(1).strip()

    # Common legacy drift (seen with smaller/local models):
    #   Reflection: ...  /  State: ...
    legacy_reflection = re.search(
        r"Reflection:\s*\n?([\s\S]*?)(?=\n\s*State:|$)",
        raw,
        re.IGNORECASE,
    )
    legacy_state = re.search(
        r"State:\s*\n?([\s\S]*?)$",
        raw,
        re.IGNORECASE | re.MULTILINE,
    )
    if legacy_reflection and legacy_state:
        return legacy_reflection.group(1).strip(), legacy_state.group(1).strip()

    # Older fallback used elsewhere in the app.
    old_reaction = re.search(
        r"Reaction:\s*\n([\s\S]*?)(?=\n\s*Internal state|$)",
        raw,
        re.IGNORECASE,
    )
    old_state = re.search(
        r"Internal state after this image:\s*\n([\s\S]*?)$",
        raw,
        re.IGNORECASE | re.MULTILINE,
    )
    reflection = old_reaction.group(1).strip() if old_reaction else raw
    state = old_state.group(1).strip() if old_state else ""
    return reflection, state


# ---------------------------------------------------------------------------
# Sequential gallery walk
# ---------------------------------------------------------------------------

def run_gallery_walk(
    config: ExperimentConfig,
    images: list[ImageInput],
    variant_id: str,
    system_prompt: str,
    user_prompt_template: str,
    profile: str,
    style: str,
    initial_state: str,
    provider: VisionProvider,
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
                prompt_variant_id=f"{variant_id}/{image.id}",
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
# Evaluation helpers: sequence context + image map
# ---------------------------------------------------------------------------

def _build_sequence_context(images: list[ImageInput], current_index: int) -> str:
    """Build a factual summary of images shown before the current one."""
    if current_index == 0:
        return ""
    lines = ["Images shown before the current one:"]
    for i in range(current_index):
        img = images[i]
        caption = img.caption or img.id
        lines.append(f"  {i + 1}. {img.id}: \"{caption}\"")
    current = images[current_index]
    caption = current.caption or current.id
    lines.append(f"Current image ({current_index + 1} of {len(images)}):")
    lines.append(f"  {current_index + 1}. {current.id}: \"{caption}\"")
    return "\n".join(lines)


def _build_prompts_for_eval(
    results: list[RunResult],
    assembled_prompts: list[str],
    system_prompt: str,
    images: list[ImageInput],
    assembled_prompt_records: list[dict] | None = None,
) -> list[PromptVariant]:
    """Build PromptVariant objects with sequence context for the judge."""
    image_index = {img.id: i for i, img in enumerate(images)}
    prompts: list[PromptVariant] = []
    records = assembled_prompt_records
    if records is not None and len(records) != len(results):
        records = None

    for i, (result, assembled_prompt) in enumerate(zip(results, assembled_prompts)):
        img_idx = image_index.get(result.image_id, 0)
        sys_prompt = system_prompt
        if records is not None:
            sys_prompt = records[i].get("system_prompt", system_prompt)
        prompts.append(PromptVariant(
            id=result.prompt_variant_id,
            name=f"Stateful reflection ({result.image_id})",
            system_prompt=sys_prompt,
            user_prompt=assembled_prompt,
            judge_context=_build_sequence_context(images, img_idx),
        ))
    return prompts


def _build_image_map(images: list[ImageInput]) -> dict[str, tuple[str, str]]:
    """Load all images and return a map of image_id → (base64, mime_type)."""
    image_map: dict[str, tuple[str, str]] = {}
    for img in images:
        try:
            b64, mime = load_image_as_base64(img.source)
            image_map[img.id] = (b64, mime)
        except Exception as e:
            console.print(f"  [yellow]Warning: could not load image {img.id}: {e}[/yellow]")
    return image_map


# ---------------------------------------------------------------------------
# Save / show
# ---------------------------------------------------------------------------

def save_run(
    config: ExperimentConfig,
    results: list[RunResult],
    artifacts: dict[str, str],
    assembled_prompts: list[str] | None = None,
    system_prompt: str = "",
    assembled_prompt_records: list[dict] | None = None,
) -> Path:
    """Save results, artifacts, and assembled prompts to a timestamped output directory."""
    # Include microseconds to prevent collisions when multiple runs start within
    # the same second (directories are created with exist_ok=True).
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S-%f")
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

    prompt_records: list[dict] | None = None
    if assembled_prompt_records is not None:
        prompt_records = assembled_prompt_records
    elif assembled_prompts is not None:
        prompt_records = [
            {
                "result_id": r.id,
                "prompt_variant_id": r.prompt_variant_id,
                "system_prompt": system_prompt,
                "user_prompt": p,
            }
            for r, p in zip(results, assembled_prompts)
        ]

    if prompt_records is not None:
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
        console.print(f"\n[bold]Responses ({len(results_raw)} run(s)):[/bold]\n")
        for i, r in enumerate(results_raw):
            reflection, state = parse_reflection_and_state(r["raw_response"])
            console.print(
                f"[bold cyan]{r.get('prompt_variant_id','?')}[/bold cyan] "
                f"[dim]({r.get('image_id','?')})[/dim]"
            )
            console.print(f"[dim]({r['latency_ms']}ms, {r.get('token_usage', {}).get('completion_tokens', '?')} tokens)[/dim]")
            console.print(f"\n{reflection}\n")
            console.print(f"[dim]State: {state}[/dim]\n")

    scores_path = run_dir / "scores.json"
    if scores_path.is_file():
        scores_raw = json.loads(scores_path.read_text())
        criterion_ids = sorted({s["criterion_id"] for s in scores_raw})
        table = Table(title="Evaluation Scores", show_lines=True)
        table.add_column("Variant", style="bold")
        table.add_column("Image", style="dim")
        for cid in criterion_ids:
            table.add_column(cid, justify="center")

        results_list = json.loads(results_path.read_text())
        result_map = {
            r["id"]: (r.get("prompt_variant_id", "?"), r.get("image_id", "?"))
            for r in results_list
        }
        group_scores: dict[tuple[str, str], dict[str, list[int]]] = {}
        for s in scores_raw:
            group = result_map.get(s["run_result_id"], ("?", "?"))
            group_scores.setdefault(group, {}).setdefault(s["criterion_id"], []).append(s["score"])

        for (variant_id, img_id) in sorted(group_scores.keys()):
            row = [variant_id, img_id]
            for cid in criterion_ids:
                vals = group_scores[(variant_id, img_id)].get(cid, [])
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

def _load_artifacts_from_experiment(exp_dir: Path) -> dict[str, str] | None:
    """Load frozen artifacts from an experiment's artifacts/ directory.

    Returns ``{profile, style, initial_state}`` if all three files exist,
    ``None`` otherwise.
    """
    artifacts_dir = exp_dir / "artifacts"
    if not artifacts_dir.is_dir():
        return None
    result = {}
    for key, fname in (("profile", "profile.txt"), ("style", "style.txt"), ("initial_state", "initial_state.txt")):
        p = artifacts_dir / fname
        if not p.is_file():
            return None
        result[key] = p.read_text().strip()
    return result


def main() -> None:
    load_dotenv(_RESEARCH_DIR / ".env")

    parser = argparse.ArgumentParser(
        description="Run a stateful gallery walk experiment.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "experiment",
        help="Experiment directory name under experiments/ (e.g. stateful_reflection_low_ambiguity).",
    )
    parser.add_argument("--provider", "-p", default=None, help="Override provider.")
    parser.add_argument("--model", "-m", default=None, help="Override model.")
    parser.add_argument("--evaluate", action="store_true", help="Evaluate after running.")
    parser.add_argument("--evaluate-only", metavar="RUN_DIR", default=None, help="Evaluate an existing run.")
    parser.add_argument("--judge-provider", default=None, help="Provider for judge LLM.")
    parser.add_argument("--judge-model", default=None, help="Model for judge LLM.")
    parser.add_argument("--show", metavar="RUN_DIR", default=None, help="Show results from existing run.")

    args = parser.parse_args()

    if args.show:
        show_run(Path(args.show))
        return

    experiment_name = args.experiment
    exp_dir = EXPERIMENTS_DIR / experiment_name
    if not exp_dir.is_dir():
        console.print(f"[red]Experiment directory not found: {exp_dir}[/red]")
        sys.exit(1)

    config_raw = yaml.safe_load((exp_dir / "config.yaml").read_text())

    config = ExperimentConfig(
        experiment_id=config_raw.get("experiment_id", experiment_name),
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
            requires_image=c.get("requires_image", False),
        )
        for c in criteria_raw.get("criteria", [])
    ]

    if args.evaluate_only:
        _evaluate_existing(args, config, criteria, system_prompt, user_prompt_template)
        return

    provider = create_provider(config.provider, config.model)

    console.print("\n[bold]Loading artifacts...[/bold]")

    frozen = _load_artifacts_from_experiment(exp_dir)
    if not frozen:
        console.print(
            f"[red]No artifacts/ directory found in {exp_dir.name}/. "
            f"Use freeze_artifacts.py to create one.[/red]"
        )
        sys.exit(1)

    profile = frozen["profile"]
    style = frozen["style"]
    initial_state = frozen["initial_state"]
    console.print(
        f"  Loaded from [cyan]{exp_dir.name}/artifacts/[/cyan] "
        f"(profile: {len(profile)} chars, style: {len(style)} chars, "
        f"state: {len(initial_state)} chars)"
    )

    variants_path = exp_dir / "variants.yaml"
    variants: list[dict] = []
    if variants_path.is_file():
        variants_raw = yaml.safe_load(variants_path.read_text()) or {}
        for v in variants_raw.get("variants", []):
            variants.append({
                "id": v["id"],
                "name": v.get("name", v["id"]),
                "system_prompt": (v.get("system_prompt") or system_prompt).strip(),
                "user_prompt_template": (v.get("user_prompt_template") or user_prompt_template).strip(),
            })
        if not variants:
            console.print(f"[red]variants.yaml present but no variants found in {exp_dir.name}.[/red]")
            sys.exit(1)
    else:
        variants = [{
            "id": "base",
            "name": "Base",
            "system_prompt": system_prompt,
            "user_prompt_template": user_prompt_template,
        }]

    all_results: list[RunResult] = []
    all_assembled_prompts: list[str] = []
    assembled_prompt_records: list[dict] = []

    for v in variants:
        console.print(f"[bold]Variant:[/bold] {v['id']} — {v['name']}")
        results, assembled_prompts = run_gallery_walk(
            config=config,
            images=config.images,
            variant_id=v["id"],
            system_prompt=v["system_prompt"],
            user_prompt_template=v["user_prompt_template"],
            profile=profile,
            style=style,
            initial_state=initial_state,
            provider=provider,
        )
        all_results.extend(results)
        all_assembled_prompts.extend(assembled_prompts)
        assembled_prompt_records.extend([
            {
                "result_id": r.id,
                "prompt_variant_id": r.prompt_variant_id,
                "system_prompt": v["system_prompt"],
                "user_prompt": p,
            }
            for r, p in zip(results, assembled_prompts)
        ])

    if not all_results:
        console.print("[red]No results generated.[/red]")
        sys.exit(1)

    artifacts = {
        "profile": profile,
        "style": style,
        "initial_state": initial_state,
    }
    run_dir = save_run(
        config,
        all_results,
        artifacts,
        assembled_prompts=all_assembled_prompts,
        system_prompt=system_prompt,
        assembled_prompt_records=assembled_prompt_records,
    )
    save_manifest(run_dir)

    prompts_for_eval = _build_prompts_for_eval(
        all_results,
        all_assembled_prompts,
        system_prompt,
        config.images,
        assembled_prompt_records=assembled_prompt_records,
    )
    scaffold_human_ratings(run_dir, all_results, criteria)

    if args.evaluate:
        judge_provider_name = args.judge_provider or config.provider
        judge_model = args.judge_model or config.model
        judge = create_provider(judge_provider_name, judge_model)
        judge_name = f"{judge_provider_name}/{judge_model}"

        image_map = _build_image_map(config.images)

        scores, judge_prompts = evaluate_results(
            all_results,
            prompts_for_eval,
            criteria,
            judge,
            judge_model_name=judge_name,
            image_map=image_map,
        )
        save_scores(run_dir, scores, judge_model_name=judge_name, judge_prompts=judge_prompts)

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
        run_dir, results, system_prompt, user_prompt_template, config.images,
    )

    judge_provider_name = args.judge_provider or config.provider
    judge_model = args.judge_model or config.model
    judge = create_provider(judge_provider_name, judge_model)
    judge_name = f"{judge_provider_name}/{judge_model}"

    image_map = _build_image_map(config.images)

    scores, judge_prompts = evaluate_results(
        results,
        prompts_for_eval,
        criteria,
        judge,
        judge_model_name=judge_name,
        image_map=image_map,
    )
    save_scores(run_dir, scores, judge_model_name=judge_name, judge_prompts=judge_prompts)
    show_run(run_dir)
    console.print("\n[bold green]Done.[/bold green]\n")


def _rebuild_prompts_for_eval(
    run_dir: Path,
    results: list[RunResult],
    system_prompt: str,
    user_prompt_template: str,
    images: list[ImageInput] | None = None,
) -> list[PromptVariant]:
    """Rebuild per-result PromptVariant objects for evaluation.

    Tries three sources in order:
    1. assembled_prompts.json (saved by newer runs)
    2. Reconstruction from artifacts.json + state replay
    3. Fallback to the raw template (will produce inaccurate adherence scores)

    When *images* is provided, each variant gets a ``judge_context`` with
    the sequence of images shown up to that point.
    """
    image_index = {img.id: i for i, img in enumerate(images)} if images else {}

    def _add_context(variant: PromptVariant, image_id: str) -> PromptVariant:
        if images and image_id in image_index:
            variant.judge_context = _build_sequence_context(
                images, image_index[image_id],
            )
        return variant

    assembled_path = run_dir / "assembled_prompts.json"
    if assembled_path.is_file():
        records = json.loads(assembled_path.read_text())
        result_map = {r.prompt_variant_id: r.image_id for r in results}
        return [
            _add_context(
                PromptVariant(
                    id=rec["prompt_variant_id"],
                    name="Stateful reflection",
                    system_prompt=rec.get("system_prompt", system_prompt),
                    user_prompt=rec["user_prompt"],
                ),
                result_map.get(rec["prompt_variant_id"], ""),
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
            prompts.append(_add_context(
                PromptVariant(
                    id=r.prompt_variant_id,
                    name=f"Stateful reflection ({r.image_id})",
                    system_prompt=system_prompt,
                    user_prompt=assembled,
                ),
                r.image_id,
            ))
            _, new_state = parse_reflection_and_state(r.raw_response)
            if new_state:
                current_state = new_state

        return prompts

    console.print(
        "[yellow]Warning: no assembled_prompts.json or artifacts.json found. "
        "Using raw template — adherence scores may be inaccurate.[/yellow]"
    )
    return [
        _add_context(
            PromptVariant(
                id=r.prompt_variant_id,
                name="Stateful reflection",
                system_prompt=system_prompt,
                user_prompt=user_prompt_template,
            ),
            r.image_id,
        )
        for r in results
    ]


if __name__ == "__main__":
    main()
