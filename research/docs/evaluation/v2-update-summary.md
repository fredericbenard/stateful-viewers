# v2 Update Summary — What We've Accomplished

**Date:** 2026-02-20

---

## What the critique identified

The project critique raised several structural concerns about the v1 system:

1. **Profile did double duty** — stable traits and initial emotional state were entangled in a single object.
2. **Style confounded voice with stance** — dimensions like "distance from experience" and "restraint/confidence" changed what was attended to, not just how the voice spoke.
3. **Underspecified state schema** — only 4 dimensions (mood, tension, energy, openness), with no attentional, meaning-making, or somatic axes.
4. **Theory-to-schema mapping was under-justified** — dimensions were pragmatically chosen but not systematically grounded.
5. **No evaluation protocol** — no versioned prompts, no comparative evaluation, no way to operationally define "good reflection."
6. **No factorial capability** — style was derived from profile, preventing clean disentanglement experiments.

---

## What the v2 architecture addresses

The dimensions doc and the eval pipeline directly respond to every major critique point:

- **Clean separation into 4 independent stages** (profile, style, initial state, stateful reflection), each testable in isolation. This resolves the profile-as-initial-state entanglement and enables factorial experiments.
- **7 theoretically grounded dimensions per schema**, with explicit construct definitions, literature citations (Frenkel-Brunswik, Jakesch & Leder, Merleau-Ponty, Jauss, Berlyne, etc.), and documented changes from v1. The critique's "high-impact candidates" (interpretive posture, motivational stance, memory integration tendency, meaning-making pressure, somatic activation, attentional focus) were all incorporated.
- **Style disentangled from stance** — the new style dimensions (lexical register, metaphor density, sensory modality emphasis, self-reference mode, pacing) are purely expressive. The critique's specific recommendations are directly reflected.
- **Parametric hint generation** — replaces 7 fixed hints with random 2–4 dimension sampling, producing more diverse outputs while maintaining quality.

---

## What the eval results demonstrate

Five experiments were completed with a full 2×2 cross-model/cross-judge matrix (GPT-5.2 and Claude Opus 4.6 as both generator and evaluator):

### 1. The generation stages work reliably

Overall means of 4.2–4.8 across conditions for profiles, styles, and initial states. Structural criteria (dimension coverage, internal coherence) are saturated at 5.0 — both models reliably produce complete, coherent artifacts. The discriminating criteria are non-genericness (persistent bottleneck at 3.1–4.4) and format compliance (Claude's conciseness problem in initial state generation).

### 2. The stateful reflection architecture achieves its core goal

Style adherence is perfect (5.0 everywhere). Image responsiveness is near-perfect under v2 vision-grounded evaluation. State carryover works across 5-image sequences — both models track accumulating fatigue, evolving somatic register, and arc-shaped emotional trajectories.

### 3. Profiles meaningfully shape the gallery experience

The contrastive run (low-ambiguity vs high-ambiguity profile, same images) produced the study's most important result. Ambiguity preservation scores swing from 2.8–3.2 (low-ambiguity profile correctly seeks closure) to 4.8–5.0 (high-ambiguity profile correctly sits with uncertainty) — a delta of +1.8 to +2.2. The same model, same image, same VLM produces completely different reflections depending on profile. This is direct evidence that the prompt architecture controls what the critique called "profile sensitivity."

### 4. Constraint-heavy profiles are more evaluatively valuable

The high-ambiguity profile aligns with LLMs' natural tendencies and produces near-universal saturation (7 of 9 criteria at 5.0). The low-ambiguity profile forces constraint that reveals real differentiation between generators and between judges. This is a methodological insight for future experiments.

### 5. Vision-grounded judging works

The v2 evaluation (judge sees the actual image + sequence context) addresses the critique's concern about image-responsiveness being a proxy for writing specificity. Scores went up (+0.4 avg) because judges could confirm visual anchors, and the methodology is now in place to catch confabulation.

### 6. The judge comparison reveals calibration differences

Claude-as-judge is more discriminating (not uniformly stricter) — it catches surface restatement in state evolution, flags stance leakage in style, and penalizes genericness. GPT-as-judge is stricter on format compliance. Neither is "correct" without human ground truth, but the cross-judge design surfaces these biases rather than hiding them.

---

## What remains open

The eval report is honest about limitations: small sample sizes (7 variants, 5 images), only two profile types tested, no human evaluation baseline, and several criteria that need revision (saturated ones should be dropped/merged, rubrics for `pure_expressiveness` and `state_evolution_quality` need clarification). The pending work section maps directly to the critique's remaining recommendations — more profile coverage, state representation experiments, and prompt enforcement for Claude's verbosity.

---

## Bottom line

The update moves the project from what the critique characterized as "a compelling demo with scholarly references attached" substantially toward "a research instrument that operationalizes specific theoretical constructs and can be probed under controlled manipulations." The 4-stage decomposition, theoretically grounded dimension sets, parametric generation, full cross-model/cross-judge evaluation, and the contrastive profile experiment collectively demonstrate that the architecture has real controllability — not just stylistic continuity but genuine profile-driven divergence in how a simulated viewer experiences a sequence of images.
