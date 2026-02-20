"""Core data types for the evaluation pipeline."""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


# ---------------------------------------------------------------------------
# Prompt & image inputs
# ---------------------------------------------------------------------------

@dataclass
class PromptVariant:
    """A named prompt variant used in an experiment."""

    id: str
    name: str
    system_prompt: str
    user_prompt: str
    judge_context: str = ""

    def to_dict(self) -> dict[str, Any]:
        d = {
            "id": self.id,
            "name": self.name,
            "system_prompt": self.system_prompt,
            "user_prompt": self.user_prompt,
        }
        if self.judge_context:
            d["judge_context"] = self.judge_context
        return d


@dataclass
class ImageInput:
    """An image to send to the model, either as a URL or a local file path."""

    id: str
    source: str  # URL or local file path
    caption: str | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {"id": self.id, "source": self.source}
        if self.caption is not None:
            d["caption"] = self.caption
        return d


# ---------------------------------------------------------------------------
# Experiment configuration
# ---------------------------------------------------------------------------

@dataclass
class ExperimentConfig:
    """Top-level configuration for an experiment run."""

    experiment_id: str
    provider: str  # "openai" | "anthropic" | "gemini"
    model: str
    temperature: float = 0.7
    max_tokens: int = 2048
    images: list[ImageInput] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "experiment_id": self.experiment_id,
            "provider": self.provider,
            "model": self.model,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "images": [img.to_dict() for img in self.images],
        }


# ---------------------------------------------------------------------------
# Run results
# ---------------------------------------------------------------------------

@dataclass
class TokenUsage:
    prompt_tokens: int = 0
    completion_tokens: int = 0

    def to_dict(self) -> dict[str, int]:
        return {
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
        }


@dataclass
class RunResult:
    """The output of a single (prompt_variant, image) call."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    prompt_variant_id: str = ""
    image_id: str = ""
    provider: str = ""
    model: str = ""
    raw_response: str = ""
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    latency_ms: int = 0
    token_usage: TokenUsage = field(default_factory=TokenUsage)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "prompt_variant_id": self.prompt_variant_id,
            "image_id": self.image_id,
            "provider": self.provider,
            "model": self.model,
            "raw_response": self.raw_response,
            "timestamp": self.timestamp,
            "latency_ms": self.latency_ms,
            "token_usage": self.token_usage.to_dict(),
        }


# ---------------------------------------------------------------------------
# Evaluation
# ---------------------------------------------------------------------------

@dataclass
class EvalCriterion:
    """A criterion against which a response is evaluated."""

    id: str
    name: str
    description: str
    scoring_prompt: str  # instructs the judge LLM how to score this criterion
    requires_image: bool = False

    def to_dict(self) -> dict[str, Any]:
        d = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "scoring_prompt": self.scoring_prompt,
        }
        if self.requires_image:
            d["requires_image"] = True
        return d


@dataclass
class EvalScore:
    """A single evaluation score for one (run_result, criterion) pair."""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    run_result_id: str = ""
    criterion_id: str = ""
    score: int = 0  # 1-5
    rationale: str = ""
    judge_model: str = ""
    source: str = "llm"  # "llm" or "human"

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "run_result_id": self.run_result_id,
            "criterion_id": self.criterion_id,
            "score": self.score,
            "rationale": self.rationale,
            "judge_model": self.judge_model,
            "source": self.source,
        }


# ---------------------------------------------------------------------------
# Provider response (returned by each provider implementation)
# ---------------------------------------------------------------------------

@dataclass
class ProviderResponse:
    """Raw response from a vision-language model provider."""

    content: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    latency_ms: int = 0
