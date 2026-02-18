"""Google Gemini vision-language model provider."""

from __future__ import annotations

import base64
import os
import time

from google import genai
from google.genai import types as genai_types

from eval_pipeline.types import ProviderResponse

DEFAULT_MODEL = "gemini-2.5-pro-preview-05-06"


class GeminiVisionProvider:
    def __init__(self, model: str = DEFAULT_MODEL):
        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY not set")
        self._client = genai.Client(api_key=api_key)
        self._model = model

    @property
    def name(self) -> str:
        return "gemini"

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
        image_bytes = base64.b64decode(image_base64)
        image_part = genai_types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
        text_part = genai_types.Part.from_text(text=user_prompt)

        config = genai_types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=temperature,
            max_output_tokens=max_tokens,
        )

        start = time.perf_counter()
        response = self._client.models.generate_content(
            model=self._model,
            contents=[image_part, text_part],
            config=config,
        )
        latency_ms = int((time.perf_counter() - start) * 1000)

        content = response.text or ""
        usage = response.usage_metadata
        return ProviderResponse(
            content=content,
            prompt_tokens=usage.prompt_token_count if usage else 0,
            completion_tokens=usage.candidates_token_count if usage else 0,
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
        config = genai_types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=temperature,
            max_output_tokens=max_tokens,
        )

        start = time.perf_counter()
        response = self._client.models.generate_content(
            model=self._model,
            contents=user_prompt,
            config=config,
        )
        latency_ms = int((time.perf_counter() - start) * 1000)

        content = response.text or ""
        usage = response.usage_metadata
        return ProviderResponse(
            content=content,
            prompt_tokens=usage.prompt_token_count if usage else 0,
            completion_tokens=usage.candidates_token_count if usage else 0,
            latency_ms=latency_ms,
        )
