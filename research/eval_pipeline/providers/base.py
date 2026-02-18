"""Abstract base for vision-language model providers."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from eval_pipeline.types import ProviderResponse


@runtime_checkable
class VisionProvider(Protocol):
    """Protocol that every provider must satisfy."""

    @property
    def name(self) -> str: ...

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        image_base64: str,
        mime_type: str,
        *,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> ProviderResponse:
        """Send a prompt + image to the model and return the response."""
        ...

    def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        temperature: float = 0.7,
        max_tokens: int = 1024,
    ) -> ProviderResponse:
        """Text-only generation (used by the evaluator / judge)."""
        ...
