"""Anthropic vision-language model provider."""

from __future__ import annotations

import os
import time

import anthropic

from eval_pipeline.types import ProviderResponse

DEFAULT_MODEL = "claude-sonnet-4-5-20250514"


class AnthropicVisionProvider:
    def __init__(self, model: str = DEFAULT_MODEL):
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY not set")
        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model

    @property
    def name(self) -> str:
        return "anthropic"

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
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": mime_type,
                            "data": image_base64,
                        },
                    },
                    {"type": "text", "text": user_prompt},
                ],
            },
        ]
        start = time.perf_counter()
        response = self._client.messages.create(
            model=self._model,
            system=system_prompt,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        latency_ms = int((time.perf_counter() - start) * 1000)

        content = response.content[0].text if response.content else ""
        usage = response.usage
        return ProviderResponse(
            content=content,
            prompt_tokens=usage.input_tokens if usage else 0,
            completion_tokens=usage.output_tokens if usage else 0,
            latency_ms=latency_ms,
        )

    def generate_text(
        self,
        system_prompt: str,
        user_prompt: str,
        *,
        temperature: float = 0.7,
        max_tokens: int = 1024,
    ) -> ProviderResponse:
        messages = [{"role": "user", "content": user_prompt}]
        start = time.perf_counter()
        response = self._client.messages.create(
            model=self._model,
            system=system_prompt,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        latency_ms = int((time.perf_counter() - start) * 1000)

        content = response.content[0].text if response.content else ""
        usage = response.usage
        return ProviderResponse(
            content=content,
            prompt_tokens=usage.input_tokens if usage else 0,
            completion_tokens=usage.output_tokens if usage else 0,
            latency_ms=latency_ms,
        )
