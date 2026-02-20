"""Generate short evocative labels for profile / style / initial-state artifacts."""

from __future__ import annotations

from eval_pipeline.providers.base import VisionProvider

LABEL_SYSTEM_PROMPT = """\
You generate ultra-short labels (2–4 words) that evoke the essence of a text.
Respond with ONLY the label — no quotes, no explanation, no punctuation at the end.
Use lowercase. Be evocative, not literal."""

_TYPE_GUIDANCE = {
    "profile": "This is a gallery visitor profile describing how someone perceives and interprets art.",
    "style": "This is a reflective inner-voice style describing how someone's internal monologue sounds.",
    "initial_state": "This is a momentary internal state describing how someone feels arriving at a gallery.",
}


def generate_label(
    artifact_text: str,
    artifact_type: str,
    provider: VisionProvider,
    *,
    temperature: float = 0.7,
    max_tokens: int = 24,
) -> str:
    """Return a 2–4 word label for the given artifact."""
    guidance = _TYPE_GUIDANCE.get(artifact_type, "")
    user_prompt = (
        f"{guidance}\n\n"
        f"Summarize the following in 2–4 evocative words:\n\n"
        f"{artifact_text}"
    )

    resp = provider.generate_text(
        system_prompt=LABEL_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return resp.content.strip().strip('"').strip("'").rstrip(".")
