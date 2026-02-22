"""Ollama vision-language model provider (local LLaVA, etc.)."""

from __future__ import annotations

import os
import time
from typing import Any

import httpx

from eval_pipeline.types import ProviderResponse

DEFAULT_BASE_URL = "http://localhost:11434"
DEFAULT_MODEL = "llava:7b"


class OllamaVisionProvider:
    """VisionProvider implementation backed by a local Ollama server.

    Environment:
      - OLLAMA_BASE_URL: base URL for Ollama (default: http://localhost:11434)
    """

    def __init__(self, model: str = DEFAULT_MODEL, *, base_url: str | None = None):
        self._base_url = (base_url or os.environ.get("OLLAMA_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
        self._model = model

    @property
    def name(self) -> str:
        return "ollama"

    def _post_chat(self, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self._base_url}/api/chat"
        with httpx.Client(timeout=180.0) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            if not isinstance(data, dict):
                raise ValueError("Unexpected Ollama response shape (expected JSON object).")
            return data

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
        # Ollama's chat API accepts base64 image strings (no data URL).
        _ = mime_type  # not used by Ollama; kept for API compatibility
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt, "images": [image_base64]},
            ],
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }
        start = time.perf_counter()
        data = self._post_chat(payload)
        latency_ms = int((time.perf_counter() - start) * 1000)

        msg = data.get("message") if isinstance(data, dict) else None
        content = ""
        if isinstance(msg, dict):
            content = str(msg.get("content") or "")

        return ProviderResponse(
            content=content,
            prompt_tokens=int(data.get("prompt_eval_count") or 0),
            completion_tokens=int(data.get("eval_count") or 0),
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
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }
        start = time.perf_counter()
        data = self._post_chat(payload)
        latency_ms = int((time.perf_counter() - start) * 1000)

        msg = data.get("message") if isinstance(data, dict) else None
        content = ""
        if isinstance(msg, dict):
            content = str(msg.get("content") or "")

        return ProviderResponse(
            content=content,
            prompt_tokens=int(data.get("prompt_eval_count") or 0),
            completion_tokens=int(data.get("eval_count") or 0),
            latency_ms=latency_ms,
        )

