"""Parametric hint generation for profile, style, and initial state experiments.

Instead of 7 fixed hint variants that carve narrow corridors in the dimension
space, parametric generation randomly selects a *subset* of dimensions to
constrain (2–4 out of 7) and leaves the rest for the model to resolve
creatively.  This produces more diverse, coherent outputs than pinning all
dimensions while still covering more of the space than fixed hints.
"""

from __future__ import annotations

import random
from pathlib import Path

import yaml

from eval_pipeline.types import PromptVariant

MIN_DIMS = 2
MAX_DIMS = 4

# ---------------------------------------------------------------------------
# Dimension value pools
# ---------------------------------------------------------------------------

PROFILE_DIMENSIONS: dict[str, list] = {
    "ambiguity_tolerance": [
        "low", "moderate-to-low", "moderate", "moderate-to-high", "high", "very high",
    ],
    "attention_style": [
        "absorbed and dwelling",
        "scanning and restless",
        "mixed — lingering on some things, skipping others quickly",
    ],
    "embodied_orientation": [
        "strongly somatic",
        "more somatic than cognitive",
        "balanced between somatic and cognitive",
        "more cognitive than somatic",
        "strongly cognitive",
    ],
    "interpretive_posture": [
        "primarily literal and descriptive",
        "primarily symbolic and associative",
        "primarily autobiographical",
        "symbolic with occasional autobiographical flashes",
        "literal with occasional symbolic leaps",
        "autobiographical with a symbolic undercurrent",
    ],
    "aesthetic_conditioning": [
        "naïve — little exposure to non-explanatory art",
        "moderate, shaped by popular cinema and illustration",
        "moderate, shaped by photography and architecture",
        "moderate, shaped by literature and graphic novels",
        "high, shaped by contemporary photography and experimental cinema",
        "high, shaped by contemporary dance, performance, and installation art",
        "high, shaped by literature, poetry, and theatre",
        "high, shaped by graphic design, typography, and visual culture",
        "high, shaped by painting and sculpture",
    ],
    "motivational_stance": [
        "strongly seeking challenge and novelty",
        "leaning toward challenge but open to comfort",
        "mixed — sometimes seeking disruption, sometimes reassurance",
        "leaning toward comfort and familiarity",
        "strongly seeking comfort and familiarity",
    ],
    "memory_integration": [
        "strongly integrative and accumulative",
        "leaning integrative — threads build loosely",
        "mixed — sometimes integrating, sometimes resetting",
        "leaning discrete — each work mostly fresh",
        "strongly discrete — each encounter resets",
    ],
}

STYLE_DIMENSIONS: dict[str, list[str]] = {
    "lexical_register": [
        "plain and conversational",
        "conversational with occasional precision",
        "moderately formal and precise",
        "literary and textured",
        "literary and poetic, occasionally archaic",
    ],
    "emotion_explicitness": [
        "implicit — emotion surfaces through imagery and indirection",
        "mostly implicit with rare direct naming",
        "mixed — sometimes named, sometimes suggested",
        "mostly explicit — feelings named directly",
        "explicitly named as a grounding habit",
    ],
    "voice_stability": [
        "steady and composed throughout",
        "mostly steady with small self-corrections",
        "stable but occasionally fracturing under pressure",
        "unstable — shifting register, hesitations, reversals",
        "deliberately fragmented — staccato, half-starts, abrupt stops",
    ],
    "sensory_modality": [
        "primarily visual",
        "primarily kinesthetic and bodily",
        "primarily auditory",
        "mixed visual and kinesthetic",
        "mixed — moving freely between all senses",
    ],
    "self_reference": [
        "first-person intimate — 'I', 'my', 'me'",
        "first-person but occasionally stepping back",
        "mixed — toggling between 'I' and impersonal constructions",
        "mostly observational — 'one notices', 'there is'",
        "fully impersonal — no 'I' at all",
    ],
    "metaphor_density": [
        "spare and literal — almost no figurative language",
        "sparse — brief functional metaphors only",
        "moderate — occasional analogies and similes",
        "rich — frequent figurative expression",
        "dense — sustained metaphorical fields",
    ],
    "pacing": [
        "terse and compressed — fragments and short bursts",
        "clipped but not fragmented — short to medium sentences",
        "medium and measured",
        "flowing — longer sentences with internal movement",
        "expansive — long unspooling clauses, slow cadence",
    ],
}

STATE_DIMENSIONS: dict[str, list[str]] = {
    "dominant_mood": [
        "calm", "restless", "melancholic", "alert", "apprehensive",
        "buoyant", "numb", "wistful", "irritable", "curious",
        "flat", "anxious", "elated", "heavy", "distracted",
    ],
    "underlying_tension": [
        "settled ease — no underlying tightness",
        "subtle anticipation",
        "a faint hum of unresolved tension",
        "noticeable tightness — something braced",
        "deep tension held in the body",
    ],
    "energy_engagement": [
        "depleted and fatigued",
        "low energy, reluctant",
        "moderate — enough to engage without strain",
        "high energy, ready to engage",
        "very high — almost restless with readiness",
    ],
    "emotional_openness": [
        "guarded and defended",
        "somewhat guarded — defenses up but not rigid",
        "moderately receptive",
        "receptive and permeable",
        "unusually open — willing to be moved",
    ],
    "attentional_focus": [
        "narrow and concentrated",
        "focused but ready to shift",
        "loosely directed",
        "diffuse and wandering",
        "peripheral — catching things at the edges",
    ],
    "meaning_making_pressure": [
        "strong pressure to understand and categorize",
        "mild urgency to make sense",
        "neutral — no strong pull either way",
        "content to let impressions hover",
        "no pressure at all — fully letting-be",
    ],
    "somatic_activation": [
        "numb and distant — body barely present",
        "quiet — faint background sensations",
        "lightly present — subtle bodily awareness",
        "vivid and activated — sensations close",
        "intensely present — body loud and immediate",
    ],
}


# ---------------------------------------------------------------------------
# Hint construction — each pins a random subset of dimensions (2–4 of 7)
# ---------------------------------------------------------------------------

_PROFILE_FRAGMENTS: dict[str, str] = {
    "ambiguity_tolerance": "{val} ambiguity tolerance",
    "attention_style": "{val} attention",
    "embodied_orientation": "an embodied orientation that is {val}",
    "interpretive_posture": "an interpretive posture that is {val}",
    "aesthetic_conditioning": "aesthetic conditioning: {val}",
    "motivational_stance": "motivationally {val}",
    "memory_integration": "memory integration that is {val}",
}

_STYLE_FRAGMENTS: dict[str, str] = {
    "lexical_register": "a {val} register",
    "emotion_explicitness": "emotion that is {val}",
    "voice_stability": "voice stability: {val}",
    "sensory_modality": "sensory emphasis that is {val}",
    "self_reference": "self-reference: {val}",
    "metaphor_density": "metaphor that is {val}",
    "pacing": "pacing: {val}",
}

_STATE_FRAGMENTS: dict[str, str] = {
    "dominant_mood": "feeling {val}",
    "underlying_tension": "with {val} underneath",
    "energy_engagement": "energy: {val}",
    "emotional_openness": "emotional openness: {val}",
    "attentional_focus": "attention that is {val}",
    "meaning_making_pressure": "meaning-making pressure: {val}",
    "somatic_activation": "somatic activation: {val}",
}


def _pick_subset(
    dimensions: dict[str, list],
    fragments: dict[str, str],
) -> tuple[list[str], dict[str, str]]:
    """Select MIN_DIMS–MAX_DIMS dimensions, sample a value for each.

    Returns (list_of_fragment_strings, {dim_key: chosen_value}).
    """
    n = random.randint(MIN_DIMS, MAX_DIMS)
    keys = random.sample(list(dimensions.keys()), n)
    chosen: dict[str, str] = {}
    parts: list[str] = []
    for k in keys:
        val = random.choice(dimensions[k])
        chosen[k] = val
        parts.append(fragments[k].format(val=val))
    return parts, chosen


def _make_label(chosen: dict[str, str]) -> str:
    """Build a short, filesystem-safe label from chosen dimension values."""
    tokens = []
    for val in chosen.values():
        word = val.split()[0].split("-")[0].split(",")[0]
        tokens.append(word[:4].lower())
    return "_".join(tokens)


def _sample_profile_hint() -> tuple[str, str]:
    """Return (hint_text, short_label) for a profile variant."""
    parts, chosen = _pick_subset(PROFILE_DIMENSIONS, _PROFILE_FRAGMENTS)
    constraint_list = ", ".join(parts[:-1]) + f", and {parts[-1]}" if len(parts) > 2 else " and ".join(parts)
    hint = (
        f"This time, create a viewer with {constraint_list}. "
        f"Resolve the remaining dimensions yourself to form a coherent, "
        f"believable person."
    )
    return hint, _make_label(chosen)


def _sample_style_hint() -> tuple[str, str]:
    """Return (hint_text, short_label) for a style variant."""
    parts, chosen = _pick_subset(STYLE_DIMENSIONS, _STYLE_FRAGMENTS)
    constraint_list = ", ".join(parts[:-1]) + f", and {parts[-1]}" if len(parts) > 2 else " and ".join(parts)
    hint = (
        f"This time, create a voice with {constraint_list}. "
        f"Resolve the remaining dimensions yourself to form a coherent "
        f"inner-speech style."
    )
    return hint, _make_label(chosen)


def _sample_state_hint() -> tuple[str, str]:
    """Return (hint_text, short_label) for an initial state variant."""
    parts, chosen = _pick_subset(STATE_DIMENSIONS, _STATE_FRAGMENTS)
    constraint_list = ", ".join(parts[:-1]) + f", and {parts[-1]}" if len(parts) > 2 else " and ".join(parts)
    hint = (
        f"This time, the viewer arrives {constraint_list}. "
        f"Fill in the remaining dimensions yourself to form a coherent "
        f"momentary snapshot."
    )
    return hint, _make_label(chosen)


_HINT_GENERATORS = {
    "profile_generation": _sample_profile_hint,
    "style_generation": _sample_style_hint,
    "initial_state_generation": _sample_state_hint,
}


# ---------------------------------------------------------------------------
# Base prompt extraction
# ---------------------------------------------------------------------------

def _extract_base_prompt(prompts_yaml_path: Path) -> tuple[str, str]:
    """Extract (system_prompt, base_user_prompt) from a prompts.yaml."""
    raw = yaml.safe_load(prompts_yaml_path.read_text())

    system_prompt = raw.get("_system_prompt", "").strip()

    base_user_prompt = raw.get("_base_user_prompt", "").strip()
    if not base_user_prompt:
        raise ValueError(
            f"No _base_user_prompt found in {prompts_yaml_path}. "
            f"Add a _base_user_prompt field with the base user prompt text."
        )

    return system_prompt, base_user_prompt


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_parametric_variants(
    experiment_id: str,
    n: int,
    experiments_dir: Path,
) -> list[PromptVariant]:
    """Generate *n* parametric variants with randomly sampled dimension values.

    Each variant gets a unique id of the form ``parametric_001_<label>``.
    """
    generator = _HINT_GENERATORS.get(experiment_id)
    if not generator:
        raise ValueError(
            f"No parametric generator for experiment '{experiment_id}'. "
            f"Available: {sorted(_HINT_GENERATORS.keys())}"
        )

    prompts_path = experiments_dir / experiment_id / "prompts.yaml"
    system_prompt, base_user_prompt = _extract_base_prompt(prompts_path)

    variants: list[PromptVariant] = []
    seen_ids: set[str] = set()

    for i in range(n):
        hint, label = generator()
        variant_id = f"parametric_{i:03d}_{label}"
        while variant_id in seen_ids:
            hint, label = generator()
            variant_id = f"parametric_{i:03d}_{label}"
        seen_ids.add(variant_id)

        variants.append(
            PromptVariant(
                id=variant_id,
                name=f"Parametric #{i + 1}",
                system_prompt=system_prompt,
                user_prompt=f"{base_user_prompt}\n\n{hint}",
            )
        )

    return variants
