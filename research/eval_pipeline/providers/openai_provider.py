"""OpenAI vision-language model provider."""

from __future__ import annotations

import os
import time

from openai import OpenAI

from eval_pipeline.types import ProviderResponse

DEFAULT_MODEL = "gpt-4o"


class OpenAIVisionProvider:
    def __init__(self, model: str = DEFAULT_MODEL):
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not set")
        self._client = OpenAI(api_key=api_key)
        self._model = model

    @property
    def name(self) -> str:
        return "openai"

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
        data_url = f"data:{mime_type};base64,{image_base64}"
        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_prompt},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            },
        ]
        start = time.perf_counter()
        response = self._client.chat.completions.create(
            model=self._model,
            messages=messages,
            max_completion_tokens=max_tokens,
            temperature=temperature,
        )
        latency_ms = int((time.perf_counter() - start) * 1000)

        content = response.choices[0].message.content or ""
        usage = response.usage
        return ProviderResponse(
            content=content,
            prompt_tokens=usage.prompt_tokens if usage else 0,
            completion_tokens=usage.completion_tokens if usage else 0,
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
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        start = time.perf_counter()
        response = self._client.chat.completions.create(
            model=self._model,
            messages=messages,
            max_completion_tokens=max_tokens,
            temperature=temperature,
        )
        latency_ms = int((time.perf_counter() - start) * 1000)

        content = response.choices[0].message.content or ""
        usage = response.usage
        return ProviderResponse(
            content=content,
            prompt_tokens=usage.prompt_tokens if usage else 0,
            completion_tokens=usage.completion_tokens if usage else 0,
            latency_ms=latency_ms,
        )
