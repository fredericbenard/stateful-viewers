"""Load experiment configuration, prompts, and criteria from YAML files."""

from __future__ import annotations

from pathlib import Path

import yaml

from eval_pipeline.types import EvalCriterion, ExperimentConfig, ImageInput, PromptVariant

EXPERIMENTS_DIR = Path(__file__).resolve().parent.parent / "experiments"


def load_experiment(
    experiment_id: str,
    *,
    provider_override: str | None = None,
    model_override: str | None = None,
) -> tuple[ExperimentConfig, list[PromptVariant], list[EvalCriterion]]:
    """Load config, prompts, and criteria for an experiment.

    Prefers ``variants.yaml`` over ``prompts.yaml`` when both exist — frozen
    variants take priority over the base template.

    Returns (config, prompts, criteria).
    """
    exp_dir = EXPERIMENTS_DIR / experiment_id
    if not exp_dir.is_dir():
        raise FileNotFoundError(f"Experiment directory not found: {exp_dir}")

    config = _load_config(exp_dir / "config.yaml")

    variants_path = exp_dir / "variants.yaml"
    if variants_path.is_file():
        prompts = _load_prompts(variants_path)
    else:
        prompts = _load_prompts(exp_dir / "prompts.yaml")

    criteria = _load_criteria(exp_dir / "criteria.yaml")

    if provider_override:
        config.provider = provider_override
    if model_override:
        config.model = model_override

    return config, prompts, criteria


def _load_config(path: Path) -> ExperimentConfig:
    raw = yaml.safe_load(path.read_text())
    images = [
        ImageInput(
            id=img["id"],
            source=img["source"],
            caption=img.get("caption"),
        )
        for img in raw.get("images", [])
    ]
    return ExperimentConfig(
        experiment_id=raw["experiment_id"],
        provider=raw.get("provider", "openai"),
        model=raw.get("model", "gpt-4o"),
        temperature=raw.get("temperature", 0.7),
        max_tokens=raw.get("max_tokens", 2048),
        images=images,
    )


def _load_prompts(path: Path) -> list[PromptVariant]:
    raw = yaml.safe_load(path.read_text())
    return [
        PromptVariant(
            id=v["id"],
            name=v["name"],
            system_prompt=v["system_prompt"].strip(),
            user_prompt=v["user_prompt"].strip(),
        )
        for v in raw.get("variants", [])
    ]


def _load_criteria(path: Path) -> list[EvalCriterion]:
    raw = yaml.safe_load(path.read_text())
    return [
        EvalCriterion(
            id=c["id"],
            name=c["name"],
            description=c["description"].strip(),
            scoring_prompt=c["scoring_prompt"].strip(),
            requires_image=c.get("requires_image", False),
        )
        for c in raw.get("criteria", [])
    ]
