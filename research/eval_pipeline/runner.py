"""Experiment runner: iterate prompt variants x images, call the provider, collect results."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Sequence

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, TimeElapsedColumn

from eval_pipeline.image_utils import load_image_as_base64
from eval_pipeline.providers.base import VisionProvider
from eval_pipeline.types import (
    ExperimentConfig,
    ImageInput,
    PromptVariant,
    RunResult,
    TokenUsage,
)

console = Console()


def run_experiment(
    config: ExperimentConfig,
    prompts: Sequence[PromptVariant],
    images: Sequence[ImageInput],
    provider: VisionProvider,
) -> list[RunResult]:
    """Execute all (prompt_variant x image) combinations and return results.

    If no images are configured, runs in text-only mode: each variant is
    called once via ``provider.generate_text()`` with no image.
    """

    variants = list(prompts)

    if not variants:
        console.print("[red]No prompt variants found.[/red]")
        return []

    text_only = not images
    if text_only:
        return _run_text_only(config, variants, provider)
    return _run_with_images(config, variants, images, provider)


def _run_text_only(
    config: ExperimentConfig,
    variants: list[PromptVariant],
    provider: VisionProvider,
) -> list[RunResult]:
    """Run each variant as a text-only call (no image)."""

    total = len(variants)
    results: list[RunResult] = []

    console.print(
        f"\nRunning [bold]{config.experiment_id}[/bold] (text-only): "
        f"{total} prompt variant(s)\n"
        f"Provider: [cyan]{config.provider}[/cyan]  Model: [cyan]{config.model}[/cyan]\n"
    )

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        TimeElapsedColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("Running...", total=total)

        for variant in variants:
            progress.update(task, description=f"[{variant.id}]")

            resp = provider.generate_text(
                system_prompt=variant.system_prompt,
                user_prompt=variant.user_prompt,
                temperature=config.temperature,
                max_tokens=config.max_tokens,
            )

            result = RunResult(
                prompt_variant_id=variant.id,
                image_id="",
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

    console.print(f"\n[green]Completed {len(results)} run(s).[/green]\n")
    return results


def _run_with_images(
    config: ExperimentConfig,
    variants: list[PromptVariant],
    images: Sequence[ImageInput],
    provider: VisionProvider,
) -> list[RunResult]:
    """Run each (variant x image) combination with the vision model."""

    total = len(variants) * len(images)
    results: list[RunResult] = []

    console.print(
        f"\nRunning [bold]{config.experiment_id}[/bold]: "
        f"{len(variants)} prompt variant(s) x {len(images)} image(s) = {total} call(s)\n"
        f"Provider: [cyan]{config.provider}[/cyan]  Model: [cyan]{config.model}[/cyan]\n"
    )

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        TimeElapsedColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("Running...", total=total)

        for image in images:
            image_b64, mime_type = load_image_as_base64(image.source)

            for variant in variants:
                progress.update(
                    task,
                    description=f"[{variant.id}] x [{image.id}]",
                )

                user_prompt = variant.user_prompt
                if image.caption:
                    user_prompt = f'{user_prompt}\n\nThe image caption: "{image.caption}"'

                resp = provider.generate(
                    system_prompt=variant.system_prompt,
                    user_prompt=user_prompt,
                    image_base64=image_b64,
                    mime_type=mime_type,
                    temperature=config.temperature,
                    max_tokens=config.max_tokens,
                )

                result = RunResult(
                    prompt_variant_id=variant.id,
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

    console.print(f"\n[green]Completed {len(results)} run(s).[/green]\n")
    return results


def save_run(
    output_dir: Path,
    config: ExperimentConfig,
    prompts: Sequence[PromptVariant],
    results: list[RunResult],
) -> Path:
    """Save config, prompts, and results to a timestamped output directory.

    Returns the path to the created run directory.
    """
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%S")
    run_dir = output_dir / config.experiment_id / timestamp
    run_dir.mkdir(parents=True, exist_ok=True)

    (run_dir / "config.json").write_text(
        json.dumps(config.to_dict(), indent=2, ensure_ascii=False) + "\n"
    )
    (run_dir / "prompts.json").write_text(
        json.dumps([p.to_dict() for p in prompts], indent=2, ensure_ascii=False) + "\n"
    )
    (run_dir / "results.json").write_text(
        json.dumps([r.to_dict() for r in results], indent=2, ensure_ascii=False) + "\n"
    )

    console.print(f"Results saved to [bold]{run_dir}[/bold]")
    return run_dir
