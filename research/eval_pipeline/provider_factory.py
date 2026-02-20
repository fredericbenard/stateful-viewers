"""Instantiate a VisionProvider by name."""

from __future__ import annotations

from eval_pipeline.providers.anthropic_provider import AnthropicVisionProvider
from eval_pipeline.providers.base import VisionProvider
from eval_pipeline.providers.gemini_provider import GeminiVisionProvider
from eval_pipeline.providers.openai_provider import OpenAIVisionProvider

DEFAULT_MODELS: dict[str, str] = {
    "openai": "gpt-5.2",
    "anthropic": "claude-opus-4-6",
    "gemini": "gemini-2.5-pro-preview-05-06",
}


def create_provider(name: str, model: str | None = None) -> VisionProvider:
    """Create a provider instance by name (openai, anthropic, gemini)."""
    resolved_model = model or DEFAULT_MODELS.get(name, "")

    if name == "openai":
        return OpenAIVisionProvider(model=resolved_model)
    if name == "anthropic":
        return AnthropicVisionProvider(model=resolved_model)
    if name == "gemini":
        return GeminiVisionProvider(model=resolved_model)

    raise ValueError(
        f"Unknown provider: {name!r}. Choose from: openai, anthropic, gemini."
    )
