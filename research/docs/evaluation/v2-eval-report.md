# Generation & Evaluation Report — v2 Prompt Architecture

**Date:** 2026-02-20
**Status:** All 5 experiments complete (3 generation + 2 stateful reflection). Full 2×2 cross-model/cross-judge comparison across two contrasting profiles.

---

## 1. Methodology

The v2 prompt architecture decomposes the gallery simulation into four independent stages, each testable in isolation:


| Stage                        | What it produces                                           | Mode                  |
| ---------------------------- | ---------------------------------------------------------- | --------------------- |
| **Profile generation**       | Stable perceptual/interpretive dispositions (7 dimensions) | Text-only             |
| **Style generation**         | Inner-voice reflective style (7 dimensions)                | Text-only             |
| **Initial state generation** | Pre-visit internal state snapshot (7 dimensions)           | Text-only             |
| **Stateful reflection**      | Per-image reflection + updated state                       | Vision (image + text) |


### Prompt design

Each generation stage uses a base prompt that defines the 7 dimensions and their value ranges, plus a **parametric hint** that constrains 2–4 randomly selected dimensions and asks the model to resolve the rest. This replaces an earlier fixed-hint approach (7 hand-written hints) that carved narrow corridors in the dimension space.

### Evaluation

All evaluation uses LLM-as-judge with a 1–5 rubric per criterion. Each stage has its own criteria (see §3). We test two generator models (GPT-5.2, Claude Opus 4.6) and two judge models (same pair), giving a 2×2 comparison with identical input prompts (via frozen `variants.yaml`).

**Vision-grounded judging (v2).** The `image_responsiveness` criterion now uses the judge's vision capability: the actual image is sent to the judge alongside the text, and a sequence context listing prior image captions is included so the judge can verify cross-image references. All stateful reflection scores in this report use this v2 evaluation. Earlier text-only scores are preserved in §6.5 for comparison.

**Sample sizes are small:** 7 parametric variants per generation experiment, 5 images per stateful experiment. Mean differences of <0.5 should be treated as directional signals rather than robust findings.

### Run inventory


| Experiment                           | GPT-generated         | Claude-generated      | Variants per run    |
| ------------------------------------ | --------------------- | --------------------- | ------------------- |
| profile_generation                   | `2026-02-20T00-41-51` | `2026-02-20T01-29-04` | 7 parametric        |
| style_generation                     | `2026-02-20T00-44-27` | `2026-02-20T01-28-59` | 7 parametric        |
| initial_state_generation             | `2026-02-20T00-46-27` | `2026-02-20T01-28-45` | 7 parametric        |
| stateful_reflection (low-ambiguity)  | `2026-02-20T01-54-12` | `2026-02-20T02-00-06` | 5 images sequential |
| stateful_reflection (high-ambiguity) | `2026-02-20T02-20-32` | `2026-02-20T02-28-20` | 5 images sequential |


Claude generation runs reuse the exact prompts (or artifacts) from the corresponding GPT runs, ensuring controlled comparison. The two stateful runs use different artifact sets to test profile sensitivity (see §6 and §6b).

---

## 2. Criteria reference

### Profile generation


| Criterion            | What it measures                                                      |
| -------------------- | --------------------------------------------------------------------- |
| `dimension_coverage` | Are all 7 profile dimensions explicitly addressed?                    |
| `internal_coherence` | Do the dimensions form a plausible, consistent person?                |
| `stability_quality`  | Does the profile describe stable dispositions (not momentary states)? |
| `non_genericness`    | Is this a distinct individual, not an interchangeable placeholder?    |
| `narrative_quality`  | Does the prose read as naturalistic description, not a checklist?     |


### Style generation


| Criterion             | What it measures                                                             |
| --------------------- | ---------------------------------------------------------------------------- |
| `dimension_coverage`  | Are all 7 style dimensions explicitly addressed?                             |
| `pure_expressiveness` | Does the style describe *how* the voice speaks, without content or examples? |
| `internal_coherence`  | Do the dimensions form a consistent voice?                                   |
| `non_genericness`     | Is this voice distinctive, not a generic "thoughtful observer"?              |
| `specificity`         | Are the descriptions concrete and precise, not vague?                        |


### Initial state generation


| Criterion            | What it measures                                                        |
| -------------------- | ----------------------------------------------------------------------- |
| `dimension_coverage` | Are all 7 state dimensions explicitly addressed?                        |
| `snapshot_quality`   | Does it read as a momentary snapshot, not a personality trait?          |
| `internal_coherence` | Do the dimensions fit together as a plausible present moment?           |
| `non_genericness`    | Is this a particular moment, not a generic "calm/open/receptive" state? |
| `conciseness`        | Does it stay within the 3–5 sentence target?                            |


### Stateful reflection


| Criterion                 | What it measures                                          |
| ------------------------- | --------------------------------------------------------- |
| `emotional_depth`         | Does the reflection go beyond surface reaction?           |
| `image_responsiveness`    | Is the reflection clearly grounded in what is visible?    |
| `non_genericness`         | Would this reflection apply to any other image?           |
| `ambiguity_preservation`  | Does it sit with uncertainty rather than forcing closure? |
| `experiential_quality`    | Does it read as lived experience, not analysis?           |
| `state_evolution_quality` | Does the updated state show plausible, grounded change?   |
| `state_schema_coverage`   | Does the updated state address the required dimensions?   |
| `profile_adherence`       | Is the reflection consistent with the viewer profile?     |
| `style_adherence`         | Does the voice match the reflective style?                |


---

## 3. Results: Profile generation

### 3.1 Scores (mean per criterion, 7 variants each)


| Generator → Judge ↓ | dim_cov | int_coh | stab_q | non_gen | narr_q | **Mean** |
| ------------------- | ------- | ------- | ------ | ------- | ------ | -------- |
| **GPT → GPT**       | 5.0     | 5.0     | 4.9    | 3.7     | 4.0    | **4.5**  |
| **GPT → Claude**    | 5.0     | 5.0     | 4.7    | 3.1     | 3.3    | **4.2**  |
| **Claude → GPT**    | 5.0     | 5.0     | 5.0    | 4.0     | 4.6    | **4.7**  |
| **Claude → Claude** | 5.0     | 5.0     | 5.0    | 4.3     | 4.7    | **4.8**  |


### 3.2 Observations

**Ceiling effects.** `dimension_coverage` and `internal_coherence` are saturated at 5.0 across all conditions. Both models reliably produce structurally complete, coherent profiles. These criteria no longer discriminate.

**Claude generates better profiles.** On the discriminating criteria (`non_genericness`, `narrative_quality`), Claude-generated profiles score higher regardless of judge: +0.3 / +0.6 (GPT judge) and +1.2 / +1.4 (Claude judge). Claude's prose tends toward more embodied, particular language — "sits comfortably with images that refuse to resolve" vs. GPT's more template-like "very comfortable with uncertainty."

**Claude is a stricter judge — but only on GPT's output.** When judging GPT-generated profiles, Claude scores 0.3 lower overall (4.2 vs 4.5). When judging Claude-generated profiles, Claude actually scores 0.1 *higher* than GPT does (4.8 vs 4.7). This suggests Claude's strictness is calibrated: it penalizes genericness it detects, rather than applying blanket deduction.

**Non-genericness is the persistent bottleneck.** Across all conditions, `non_genericness` is the lowest-scoring criterion (3.1–4.3). The parametric hints constrain 2–4 of 7 dimensions, but the model's free resolution of remaining dimensions gravitates toward safe defaults ("moderate tolerance," "mixed attention").

### 3.3 Sample comparison (variant `parametric_000`, same hint)

**GPT-5.2:**

> They have very high tolerance for ambiguity and rarely push for a single "correct" meaning, letting questions remain open without anxiety. Their attention style is mostly absorbed and dwelling: they l...

**Claude Opus 4.6:**

> This viewer carries a deep comfort with uncertainty, readily sitting with images that refuse to resolve into single meanings, letting contradictions and open-endedness exist without pressing toward cl...

Claude's phrasing is more concrete and embodied ("refuse to resolve into single meanings," "letting contradictions exist") while GPT uses more abstract framing ("rarely push for a single correct meaning").

---

## 4. Results: Style generation

### 4.1 Scores (mean per criterion, 7 variants each)


| Generator → Judge ↓ | dim_cov | pure_exp | int_coh | non_gen | specif | **Mean** |
| ------------------- | ------- | -------- | ------- | ------- | ------ | -------- |
| **GPT → GPT**       | 5.0     | 4.0      | 5.0     | 4.3     | 4.9    | **4.6**  |
| **GPT → Claude**    | 5.0     | 3.4      | 5.0     | 4.3     | 4.7    | **4.5**  |
| **Claude → GPT**    | 5.0     | 3.9      | 5.0     | 4.1     | 4.3    | **4.5**  |
| **Claude → Claude** | 5.0     | 3.1      | 5.0     | 4.6     | 4.7    | **4.5**  |


### 4.2 Observations

**Style generation is the most stable experiment overall.** All four conditions land at 4.5–4.6. The ceiling effects on `dimension_coverage` and `internal_coherence` hold as expected.

`**pure_expressiveness` is the weakest criterion and reveals a judge split.** GPT-as-judge scores both generators at ~4.0, while Claude-as-judge is markedly stricter: 3.4 for GPT output, 3.1 for Claude output. Claude's rationales consistently flag "stance leakage" — cases where the style description prescribes *what the viewer attends to* rather than purely *how the voice speaks*. Examples: "noting light, color, and spatial arrangement" (prescribes attention), "the body is a single instrument receiving on all frequencies simultaneously" (prescribes perception). This is the sharpest judge disagreement in the generation experiments (exceeded only by `state_evolution_quality` in the stateful run — see §7.2).

**Claude-as-judge sees more non-genericness in Claude output.** Claude rates Claude-generated styles at 4.6 non-genericness (vs GPT judge's 4.1 for the same output). Meanwhile both judges agree on GPT output at 4.3. Claude recognizes the literary distinctiveness of its own style ("illuminated manuscript unscrolling in real time," "a warmth along the sternum").

**Specificity converges across judges but diverges across generators.** Claude judge (4.7) and GPT judge (4.9) are close on GPT output; Claude judge (4.7) and GPT judge (4.3) diverge on Claude output, with Claude judge being more generous to Claude's atmospheric descriptions.

---

## 5. Results: Initial state generation

### 5.1 Scores (mean per criterion, 7 variants each)


| Generator → Judge ↓ | dim_cov | snap_q | int_coh | non_gen | concise | **Mean** |
| ------------------- | ------- | ------ | ------- | ------- | ------- | -------- |
| **GPT → GPT**       | 5.0     | 5.0    | 5.0     | 3.9     | 4.0     | **4.6**  |
| **GPT → Claude**    | 5.0     | 5.0    | 5.0     | 3.7     | 4.6     | **4.7**  |
| **Claude → GPT**    | 5.0     | 4.4    | 5.0     | 4.3     | 3.1     | **4.4**  |
| **Claude → Claude** | 5.0     | 5.0    | 5.0     | 4.4     | 3.7     | **4.6**  |


### 5.2 Observations

**Claude has a conciseness problem — both judges agree.** GPT judge scores Claude output at 3.1/5, Claude judge at 3.7/5. Two of Claude's 7 states received 2/5 for conciseness from Claude judge (7 sentences vs. the 3–5 target). Claude's literary elaboration conflicts with the tight snapshot format. GPT stays within bounds (4.0–4.6 across judges).

**Claude-as-judge rehabilitates Claude's snapshot quality.** GPT judge scored Claude output at 4.4 (suggesting some states bleed into personality traits), but Claude judge gives it a perfect 5.0 — matching GPT output. This is a notable divergence: Claude judges Claude's transient framing more favorably, recognizing the situational anchors ("the afternoon left a soft residue," "carrying the weight of a long week") that GPT judge may have missed.

**Non-genericness: both judges agree Claude is more distinctive.** GPT judge: Claude 4.3 vs GPT 3.9. Claude judge: Claude 4.4 vs GPT 3.7. The extra length that hurts conciseness also carries more particular detail — "an ease born not from contentment but from having nothing left to clench against" scores 5/5 on non-genericness.

**Trade-off: richness vs. constraint adherence.** Claude produces richer, more particular states at the cost of structural discipline. This suggests a prompt-tuning opportunity: Claude may need stronger length enforcement cues (e.g., "You MUST use exactly 3–5 sentences. Longer responses will be penalized.").

---

## 6. Results: Stateful reflection (5-image sequential gallery walk)

Both GPT-5.2 and Claude Opus 4.6 walked through 5 Montreal street photographs in sequence, using the same auto-generated profile, style, and initial state. The profile has low ambiguity tolerance, scanning-to-fixating attention, and comfort-seeking motivation — a viewer who actively seeks clear takeaways.

### 6.1 Scores (mean per criterion, 5 images each)


| Criterion               | GPT→GPT  | GPT→Claude | Claude→GPT | Claude→Claude |
| ----------------------- | -------- | ---------- | ---------- | ------------- |
| emotional_depth         | 4.0      | 4.4        | 4.4        | **4.6**       |
| image_responsiveness    | **5.0**  | **5.0**    | 4.8        | **5.0**       |
| non_genericness         | 4.4      | 4.0        | **4.8**    | 4.2           |
| ambiguity_preservation  | 3.0      | 3.0        | **3.2**    | 2.8           |
| experiential_quality    | **5.0**  | 4.8        | **5.0**    | 4.6           |
| state_evolution_quality | **5.0**  | 4.0        | **5.0**    | 4.8           |
| state_schema_coverage   | **5.0**  | **5.0**    | 4.8        | **5.0**       |
| profile_adherence       | 4.6      | **5.0**    | 4.8        | **5.0**       |
| style_adherence         | **5.0**  | **5.0**    | **5.0**    | **5.0**       |
| **Overall**             | **4.56** | **4.47**   | **4.64**   | **4.56**      |


### 6.2 Observations

**Style adherence is perfect everywhere.** 5.0 across all 4 conditions. Both VLMs faithfully enact the given voice — conversational register, somatic anchors, emotion implied rather than named, moderate grounded metaphor. The prompt architecture works.

**Claude generates richer reflections.** Claude→GPT is the highest overall (4.64), edging out GPT→GPT (4.56). The clearest advantages are emotional depth (4.4 vs 4.0) and non-genericness (4.8 vs 4.4). Both generators match on experiential quality (5.0) and style adherence (5.0) when GPT judges. Image responsiveness is near-perfect for both under v2 vision-grounded evaluation (4.8 vs 5.0 — GPT is marginally higher). GPT-as-judge recognizes Claude's overall edge.

**Ambiguity preservation is the designed weak spot (2.8–3.2).** Both models correctly enact the low-ambiguity profile by resolving each image into a tidy takeaway ("modest insistence," "patching as quiet survival," "barrier with a crack," "layers of intention"). Both judges agree this is profile-correct behavior. Claude judge is slightly stricter (2.8–3.0) than GPT judge (3.0–3.2), flagging more aggressively when the viewer "explicitly states satisfaction at having settled the meaning."

**Claude-as-judge is stricter on state evolution.** The biggest judge disagreement: Claude gives GPT's state_evolution 4.0 (flagging "near-identical language to input state" and "some dimensions are only lightly touched"), while GPT gives itself 5.0 on the same output. Claude notices when state updates coast rather than genuinely evolve.

**State carryover works across the 5-image sequence.** Both models track:

- Accumulating fatigue (energy dipping across images 3–5)
- Evolving somatic register (dry plaster → cool metal → warm brick → humid sidewalk)
- Growing impatience with closed surfaces (Claude's image 3 references "standing outside a lot of doors" — though only image 3 actually shows doors; see §6.4 for analysis of this confabulation)
- Relief when the final image (Dépanneur Vilamar) breaks the pattern with legibility and color

### 6.3 Sequence evolution: GPT vs Claude


| Image                    | GPT dominant mood                      | Claude dominant mood                         |
| ------------------------ | -------------------------------------- | -------------------------------------------- |
| 1. Bernard side wall     | buoyant → hushed seriousness           | buoyant → grounded recognition               |
| 2. De La Roche side wall | hushed serious, tension up             | plain steadiness, fatigue emerging           |
| 3. Park Ave doors        | tension shifts to "where's the entry?" | mild impatience, "standing outside doors"    |
| 4. Mont-Royal side wall  | mechanical tension, dry respect        | tired steadiness, shadows almost "breathing" |
| 5. Dépanneur Vilamar     | social friction, settles on layering   | amused ease, relief at legibility            |


Claude's trajectory is more dramatically arc-shaped — building to genuine impatience at image 3, then softening through the shadow detail at image 4, and releasing at image 5. GPT's trajectory is more even-keeled, maintaining "hushed seriousness" through images 1–4 with less dramatic shift.

### 6.4 Sample comparison (image 3: Park Ave patterned metal doors)

**GPT-5.2:**

> I hit this wall of metal pattern and my first reaction is almost physical—like my eyes are trying to find a handle and my fingers come up empty. [...] I end up settling on a simple story because I need one: this is a threshold that's not for me, a place that's closed on purpose, dressed up in pattern so it can pretend it's just design.

**Claude Opus 4.6:**

> There's something almost aggressive about the repetition here, all those vertical metal slats lined up like teeth in a jaw that won't quite close. [...] But there's a faint restlessness underneath, because this is another surface, another closed-off thing, and I'm starting to feel like I've been standing outside a lot of doors today without being invited through any of them.

Both faithfully enact the profile's need for closure. Claude's version adds an accumulation reference ("standing outside a lot of doors today") that *reads* as compelling sequential awareness — but is factually inaccurate. Images 1 and 2 were bare walls, not doors; this is the first door image. The phrase "another surface, another closed-off thing" is defensible, but the leap to "a lot of doors" is narrative confabulation. In the original text-only evaluation, neither judge flagged this. After the v2 vision-grounded evaluation (§6.5), `image_responsiveness` scores are now based on the judge seeing the actual image and the sequence of prior captions.

### 6.5 Vision-grounded evaluation (v2 methodology)

The original evaluation of `image_responsiveness` was text-only: the judge never saw the image and could not verify whether visual details in the reflection actually matched the photograph. This made the criterion a proxy for *writing specificity* rather than *image grounding*.

In the v2 evaluation, two changes were made:

1. **Image passed to judge.** For `image_responsiveness` (marked `requires_image: true`), the judge receives the actual image via a vision API call.
2. **Sequence context.** Each judge prompt includes a list of prior image captions, enabling the judge to verify cross-image references.

All stateful scores in §6.1 and §6b.1 use the v2 methodology. The text-only scores from the original evaluation (now lost from the raw files — see note below) were:


| Condition                 | `image_responsiveness` (text-only, v1) | `image_responsiveness` (vision, v2) | Delta |
| ------------------------- | -------------------------------------- | ----------------------------------- | ----- |
| GPT→GPT (low-amb.)        | 4.2                                    | 5.0                                 | +0.8  |
| GPT→Claude (low-amb.)     | 4.4                                    | 5.0                                 | +0.6  |
| Claude→GPT (low-amb.)     | 4.6                                    | 4.8                                 | +0.2  |
| Claude→Claude (low-amb.)  | 4.8                                    | 5.0                                 | +0.2  |
| GPT→GPT (high-amb.)       | 4.2                                    | 5.0                                 | +0.8  |
| GPT→Claude (high-amb.)    | 4.8                                    | 5.0                                 | +0.2  |
| Claude→GPT (high-amb.)    | 4.6                                    | 4.8                                 | +0.2  |
| Claude→Claude (high-amb.) | 5.0                                    | 5.0                                 | 0.0   |


With the image visible, judges score higher on average (+0.4) because they can *confirm* that visual anchors in the reflection match the actual photograph. The text-only judge was more conservative, unable to verify specificity claims.

**Note on re-evaluation variance:** The re-evaluation also produced new scores for non-image criteria (which still use text-only judging). Small differences from the v1 numbers (±0.2) reflect LLM-as-judge run-to-run variance, not a methodology change. This is consistent with the "single evaluation pass" limitation noted in §8.

---

## 6b. Results: Contrastive stateful reflection (high-ambiguity profile)

To test whether evaluation criteria respond to profile changes, we ran the same 5 images with a contrasting artifact set:


| Artifact          | Original (§6)                                                | Contrastive (§6b)                                                        |
| ----------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| **Profile**       | Low ambiguity tolerance, scanning attention, comfort-seeking | High ambiguity tolerance, absorbed/dwelling attention, challenge-seeking |
| **Style**         | Plain conversational, emotion implied, moderate metaphor     | Literary ceremonial, archaic turns, dense structural metaphor            |
| **Initial state** | Alert, quietly buoyant, curious                              | Muted, weary, guarded hush                                               |


### 6b.1 Scores (mean per criterion, 5 images each)


| Criterion               | GPT→GPT  | GPT→Claude | Claude→GPT | Claude→Claude |
| ----------------------- | -------- | ---------- | ---------- | ------------- |
| emotional_depth         | 4.6      | **5.0**    | **5.0**    | **5.0**       |
| image_responsiveness    | **5.0**  | **5.0**    | 4.8        | **5.0**       |
| non_genericness         | **5.0**  | 4.8        | **5.0**    | **5.0**       |
| ambiguity_preservation  | 4.8      | **5.0**    | **5.0**    | **5.0**       |
| experiential_quality    | 4.8      | 4.6        | 4.8        | 4.6           |
| state_evolution_quality | 4.6      | 4.4        | **5.0**    | **5.0**       |
| state_schema_coverage   | **5.0**  | **5.0**    | **5.0**    | **5.0**       |
| profile_adherence       | **5.0**  | **5.0**    | **5.0**    | **5.0**       |
| style_adherence         | **5.0**  | **5.0**    | **5.0**    | **5.0**       |
| **Overall**             | **4.87** | **4.87**   | **4.96**   | **4.96**      |


### 6b.2 Key finding: ambiguity preservation is profile-responsive

The most important result in this study. Comparing the same criterion across profiles:


| Condition     | Low-ambiguity (§6) | High-ambiguity (§6b) | Delta    |
| ------------- | ------------------ | -------------------- | -------- |
| GPT→GPT       | 3.0                | 4.8                  | **+1.8** |
| GPT→Claude    | 3.0                | 5.0                  | **+2.0** |
| Claude→GPT    | 3.2                | 5.0                  | **+1.8** |
| Claude→Claude | 2.8                | 5.0                  | **+2.2** |


The `ambiguity_preservation` criterion is not broken — it correctly reflects what the profile demands. The low scores in §6 were profile-correct behavior (the viewer seeks closure), not a quality deficiency. This means the criterion can stay as-is; the rubric does not need to be made profile-aware.

### 6b.3 Observations

**Near-universal saturation.** 7 of 9 criteria reach a perfect 5.0 in ≥3 of 4 conditions. `non_genericness` and `profile_adherence` are perfect 5.0 everywhere. This is dramatically higher than the low-ambiguity run (overall 4.47–4.64 vs. 4.87–4.96 here).

**The high-ambiguity profile is easier for LLMs.** Both models produce literary, exploratory, unresolved prose by default. The high-ambiguity profile aligns with this natural tendency — the models aren't fighting against their grain. The low-ambiguity profile forces constraint (seek closure, use plain language, resolve each image), which is harder and reveals more differentiation. This suggests that *constraint-heavy profiles are more valuable for evaluation* because they stress-test the models.

**Experiential quality is the one criterion where both generators dip equally (4.6–4.8).** Other criteria like `image_responsiveness` (4.8) and `state_evolution_quality` (4.4) also fall below 5.0, but only for one generator. Both judges flagged the ceremonial style tipping into analytical territory. GPT judge: "the density of compositional analysis occasionally reads like an art-critical account." Claude judge: "'a small eruption of the organic into the semiotic' edges toward cultural commentary." The literary style specification encourages exactly the language that tips from lived experience into criticism — a genuine tension in the prompt design.

**State evolution improved.** Claude-as-judge no longer flags surface restatement (5.0 everywhere for Claude gen). The weary initial state gives the models a clear trajectory to evolve *from* — weariness easing into attention, guardedness opening — which produces more visible, grounded state changes than the "quietly buoyant" starting point in §6.

**No confabulation detected.** Unlike the low-ambiguity run where Claude fabricated "a lot of doors," the high-ambiguity reflections maintain accurate cross-image references. The absorbed, dwelling attention style may naturally inhibit over-generalization — the viewer re-scans rather than summarizing.

### 6b.4 Sample (image 3: Park Ave doors, GPT-5.2 high-ambiguity)

> The white doors meet me like a chant made of rectangles—not quite uniform, the vertical bars and the checkerboard blocks setting up a rhythm my eye follows without deciding to, a polite stutter: order, order, then a small misalignment that feels like a confession. [...] I lean toward that blue the way one leans toward a window left ajar in a house one is not permitted to enter.

Compare with the low-ambiguity GPT response to the same image (§6.4):

> I hit this wall of metal pattern and my first reaction is almost physical—like my eyes are trying to find a handle and my fingers come up empty. [...] I end up settling on a simple story because I need one: this is a threshold that's not for me.

The same model, same image, same VLM — completely different reflections. The profile controls whether the viewer seeks closure ("settling on a simple story") or dwells in ambiguity ("a polite stutter... a confession"). This is the strongest evidence that the prompt architecture achieves its goal: the profile meaningfully shapes the gallery experience.

---

## 7. Cross-cutting findings

### 7.1 Generator comparison (GPT-5.2 vs Claude Opus 4.6)

Aggregating across all five experiments (3 generation + 2 stateful reflection runs) and both judges:


| Dimension                       | GPT advantage                             | Claude advantage                                                          |
| ------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| Constraint adherence            | Conciseness (+0.8 avg), format compliance | —                                                                         |
| Structural coverage             | Tied (both saturate at 5.0)               | Tied                                                                      |
| Non-genericness                 | —                                         | More distinctive (+0.4 avg in generation, +0.2 in low-ambiguity stateful) |
| Narrative / snapshot quality    | —                                         | More embodied, literary prose                                             |
| Specificity (style)             | More concrete sensory anchors (GPT judge) | —                                                                         |
| Pure expressiveness (style)     | —                                         | Tied (both struggle equally)                                              |
| Image responsiveness (stateful) | Marginally higher with v2 vision scoring  | Near-tied in both profiles (GPT 5.0 vs Claude 4.9 avg; gap was +0.4 Claude in v1) |
| Experiential quality (stateful) | Tied or marginally higher (4.9 vs 4.8 avg) | —; both dip equally under ceremonial style in high-ambiguity (4.6–4.8)    |
| State evolution narrative       | More consistent state coverage            | Better accumulation meta-awareness (low-amb.); both saturate in high-amb. |


**Summary:** Claude produces richer, more distinctive content across both generation and multimodal reflection tasks. However, the contrastive run (§6b) reveals that the generator gap is **profile-dependent**: with a high-ambiguity, literary profile, both models converge toward near-perfect scores (4.8–4.96 overall). The low-ambiguity profile (§6) is more discriminating — it forces constraint that GPT handles more reliably while Claude takes more creative risk (sometimes confabulating). This suggests that *constraint-heavy profiles* are the right tool for generator comparison, while permissive profiles test the ceiling of both models.

### 7.2 Judge comparison (GPT-5.2 vs Claude Opus 4.6 as judge)

Based on the full 2×2 across all five experiments:

**Structural criteria.** Both judges agree at 5.0 on `dimension_coverage` and `internal_coherence` everywhere. On `snapshot_quality`, Claude judge gives 5.0 to both generators while GPT judge docks Claude output to 4.4. In the stateful experiment, `state_schema_coverage` converges at ~5.0 from both judges.

**Generation-stage divergences:**


| Criterion             | GPT judge tendency              | Claude judge tendency                                            |
| --------------------- | ------------------------------- | ---------------------------------------------------------------- |
| `non_genericness`     | Slightly lenient on GPT output  | Stricter on GPT, more generous to Claude                         |
| `narrative_quality`   | Scores GPT and Claude similarly | Penalizes GPT (-0.7), rewards Claude (+0.1)                      |
| `pure_expressiveness` | ~4.0 for both generators        | Markedly stricter: 3.1–3.4 (catches "stance leakage")            |
| `conciseness`         | Stricter on Claude (3.1)        | More moderate on Claude (3.7), more generous to GPT (4.6 vs 4.0) |


**Stateful-stage divergences (low-ambiguity run; see contrastive update below for §6b):**


| Criterion                 | GPT judge tendency                 | Claude judge tendency                             |
| ------------------------- | ---------------------------------- | ------------------------------------------------- |
| `state_evolution_quality` | Generous to GPT (5.0)              | Stricter on GPT (4.0) — flags surface restatement |
| `experiential_quality`    | Generous to both (5.0 / 5.0)       | Stricter on both (4.8 / 4.6)                      |
| `profile_adherence`       | Conservative (4.6 / 4.8)           | Confident (5.0 for both)                          |
| `ambiguity_preservation`  | Slightly more generous (3.0 / 3.2) | Slightly stricter (3.0 / 2.8)                     |


The `state_evolution_quality` disagreement (GPT: 5.0, Claude: 4.0 for the same GPT output) in the low-ambiguity run is the largest judge gap in the entire study. Claude's rationales flag "near-identical language to input state" and dimensions "only lightly touched" — it distinguishes genuine evolution from cosmetic restatement.

**Contrastive run update (§6b):** With the high-ambiguity profile, judge disagreement collapses. The largest gap is 0.4 on `emotional_depth` (Claude gives 5.0 vs GPT's 4.6 for GPT output — here Claude is the more generous judge). For `state_evolution_quality` specifically, the gap narrows from 1.0 (§6) to 0.2 (GPT: 4.6, Claude: 4.4 for GPT output), suggesting the weary-to-awakening trajectory is genuinely clearer and both judges can recognize it. The models aren't just scoring higher — the quality difference that created judge disagreement has largely disappeared.

**Key insight:** Claude-as-judge is not uniformly stricter — it's *more discriminating*. It penalizes GPT's genericness and surface-level state updates more aggressively, while rewarding Claude's non-genericness and both models' profile adherence more generously. This pattern holds across both generation and stateful experiments, suggesting Claude is a more calibrated evaluator for the qualitative dimensions that matter most for this research. The contrastive run confirms this: when quality is genuinely high, Claude agrees.

### 7.3 Overall means by condition


| Condition           | Profile | Style | Init. State | Stateful (low-amb.) | Stateful (high-amb.) | **Average** |
| ------------------- | ------- | ----- | ----------- | ------------------- | -------------------- | ----------- |
| **GPT → GPT**       | 4.5     | 4.6   | 4.6         | 4.56                | 4.87                 | **4.63**    |
| **GPT → Claude**    | 4.2     | 4.5   | 4.7         | 4.47                | 4.87                 | **4.55**    |
| **Claude → GPT**    | 4.7     | 4.5   | 4.4         | 4.64                | 4.96                 | **4.64**    |
| **Claude → Claude** | 4.8     | 4.5   | 4.6         | 4.56                | 4.96                 | **4.68**    |


The overall means converge around 4.5–4.7. The high-ambiguity stateful run lifts all conditions by 0.3–0.4 relative to the low-ambiguity run, confirming that permissive profiles inflate scores across the board. The *ordering* of conditions is stable: Claude→Claude consistently scores highest, GPT→Claude lowest (Claude-as-judge is harder on GPT output). The v2 vision-grounded evaluation (§6.5) raised `image_responsiveness` scores, slightly lifting the stateful overall means. The text-only generation experiments remain the most discriminating test bed.

### 7.4 Criteria that need revision

**Generation criteria:**


| Criterion             | Issue                                         | Recommendation                                                              |
| --------------------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| `dimension_coverage`  | Saturated at 5.0 in all 12 conditions         | Drop or merge with coherence                                                |
| `internal_coherence`  | Saturated at 5.0 in all 12 conditions         | Raise the bar (require tension/surprise)                                    |
| `pure_expressiveness` | GPT and Claude judges disagree sharply        | Clarify rubric: define "stance leakage" boundary explicitly                 |
| `conciseness`         | Punishes Claude disproportionately            | Consider whether 3–5 sentences is the right target, or add graduated rubric |
| `snapshot_quality`    | Judges disagree on Claude output (4.4 vs 5.0) | Clarify: what distinguishes "momentary" framing from trait-like language?   |


**Stateful criteria:**


| Criterion                 | Issue                                                                                                                                                                                            | Recommendation                                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ambiguity_preservation`  | Confounded with profile design — a low-ambiguity profile scores ~3.0, a high-ambiguity profile scores ~5.0 (§6b.2). The criterion is not broken; it correctly reflects what the profile demands. | **No rubric change needed.** The criterion functions as a profile-enactment measure. Interpretive guidance should note that low scores are expected and correct for closure-seeking profiles. |
| `state_evolution_quality` | Largest judge disagreement in the study (5.0 vs 4.0 for same output)                                                                                                                             | Clarify rubric: define what distinguishes genuine evolution from surface restatement with similar vocabulary                                                                                  |
| `image_responsiveness`    | **Addressed in v2.** Now uses vision-grounded judging (judge sees the actual image) and sequence context (prior image captions). See §6.5 for methodology and impact.                            | Monitor whether the v2 rubric catches future confabulation instances; the "a lot of doors" case occurred only in the low-ambiguity run and may be profile-dependent.                          |


### 7.5 Parametric hints vs. fixed hints

An early iteration used 7 hand-written hints that specified all 7 dimensions explicitly (e.g., "high ambiguity tolerance, absorbed attention, strongly somatic..."). These were replaced by parametric hints that randomly constrain 2–4 dimensions and let the model resolve the rest. The table below compares the two approaches using GPT-5.2 as both generator and judge:


| Experiment               | Fixed hints | Parametric | Delta |
| ------------------------ | ----------- | ---------- | ----- |
| profile_generation       | 4.5         | 4.5        | 0.0   |
| style_generation         | 4.6         | 4.6        | 0.0   |
| initial_state_generation | 4.7         | 4.6        | -0.1  |


**Overall scores are nearly identical, but the parametric approach produces more diverse outputs.** Each variant samples a different dimension subset, whereas fixed hints repeated similar category archetypes. The parametric approach is now the default for building the artifact library used in the stateful reflection experiments.

---

## 8. Limitations

- **Small sample sizes.** 7 variants per generation experiment, 5 images per stateful run. Means are suggestive, not definitive. A single outlier score (e.g., one 2/5 on conciseness) moves the mean by 0.4.
- **Two artifact sets for stateful reflection.** The stateful results now cover two profiles — low ambiguity (plain, buoyant) and high ambiguity (ceremonial, weary). The contrastive run (§6b) substantially improved generalizability, but two profiles cannot cover the full design space. More profiles (especially mid-range and edge-case combinations) are needed to establish robust baselines.
- **No human evaluation baseline.** All scores are LLM-as-judge. The judge comparison analysis (§7.2) reveals systematic biases — Claude catches surface restatement that GPT misses, while GPT is stricter on conciseness. Without human ground truth, we cannot determine which judge is more "correct."
- **Potential self-preference bias.** Both models may rate their own output more favorably. The data partially mitigates this — Claude-as-judge does not uniformly prefer Claude output (e.g., it scores Claude's conciseness lower than GPT's) — but subtle biases may remain.
- **Single evaluation pass per judge.** Each judge scores each output once. LLM-as-judge scores have known variance across runs; repeated evaluation would yield confidence intervals.

---

## 9. Pending work


| #   | Category                 | Items                                                                                                                                                  | Ref        |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| 1   | **Evaluation criteria**  | Drop/merge saturated criteria, clarify rubrics for `pure_expressiveness`, `state_evolution_quality`; `image_responsiveness` now vision-grounded (§6.5) | §7.4       |
| 2   | **Generation prompts**   | Enforce conciseness for Claude, add grounding instruction to reduce cross-image confabulation                                                          | §5.2, §6.4 |
| 3   | **Profile coverage**     | Mid-range profile, constraint-adversarial profile, longer image sequences                                                                              | §6b.3      |
| 4   | **State representation** | Test expanded format, structured deltas, factual anchor lines                                                                                          | §7.2, §6.4 |


### Evaluation criteria

- Address saturated criteria: drop or merge `dimension_coverage`, raise the bar on `internal_coherence` (see §7.4). The high-ambiguity run makes this more urgent — 7 of 9 criteria hit 5.0 in ≥3 conditions.
- Clarify `pure_expressiveness` rubric — define "stance leakage" boundary to reduce judge disagreement
- Clarify `state_evolution_quality` rubric — define what distinguishes genuine evolution from surface restatement. Note: the contrastive run showed much less judge disagreement (max gap 0.4 vs 1.0 in §6), suggesting the issue is partly quality-dependent.
- ~~Add cross-image factual accuracy to `image_responsiveness`~~ — **Done (§6.5).** Now uses vision-grounded judging + sequence context. Monitor whether v2 rubric catches future confabulation instances.

### Generation prompts

- Enforce conciseness for Claude in initial-state generation (e.g., "You MUST use exactly 3–5 sentences")
- Investigate whether cross-image factual drift can be mitigated by adding a grounding instruction to the stateful reflection prompt (e.g., "Your state references should be consistent with what you have actually seen")

### Profile coverage

Two profiles (low-ambiguity + high-ambiguity) reveal that profile choice has a dramatic effect on scores (§6b.2) and on the discriminating power of the evaluation (§6b.3). Priority experiments:

- Mid-range profile (moderate ambiguity, mixed attention style) to see if it produces intermediate scores or behaves like one extreme
- Constraint-adversarial profile (contradictory dimensions, e.g., high ambiguity tolerance + strong closure-seeking) to stress-test coherence
- Longer sequences (8+ images) to test state drift, confabulation accumulation, and whether the trajectory arc holds. Does sequence length interact with profile type? (The high-ambiguity run showed no confabulation at 5 images.)
- Is the near-perfect scoring on the high-ambiguity profile a ceiling effect that limits its evaluative value, or does it confirm the architecture works when the profile aligns with LLM tendencies?

### State representation

The current format compresses 7 dimensions into ~3–5 sentences. Coverage is near-perfect (4.8–5.0), but evolution quality shows the largest judge disagreement in §6. Three alternatives worth testing:

- **Graduated expansion (6–10 sentences):** ~1 sentence per dimension plus transitions and grounding. Tests whether more space improves evolution quality without excessive token cost.
- **Structured delta format:** Require explicit `[CHANGED]` and `[PERSISTED]` subsections, forcing the model to articulate what shifted. Could improve evolution quality without much length increase.
- **Factual anchor line:** Add a required line like "Images seen so far: [brief list]" at the end of each state update. Directly addresses cross-image confabulation without expanding the emotional state description.

These trade off against token cost (each state feeds into the next prompt — a 15-sentence state adds ~1,500 cumulative tokens over 5 images), psychological realism (compressed state may better mirror actual human awareness during a gallery visit), and confabulation risk (would a brief log of prior image descriptions reduce factual drift without making the prompt unwieldy?).