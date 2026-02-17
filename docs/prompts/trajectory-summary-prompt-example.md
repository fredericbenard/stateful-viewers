# Example: Trajectory analysis prompt sent to the LLM

When the user clicks **"Summarize trajectory"**, the app calls the same text LLM used for profile/style generation (e.g. OpenAI) with the two messages below. The prompt includes the **gallery name** (not the gallery description — the viewer never sees that), the **viewer's initial state** (from the profile, before any images), and the **sequence of internal states** after each image.

---

## 1. System message (role: `system`)

```
You summarize experiential trajectories. You are given the sequence of internal states from one viewer moving through a gallery. Your job is to describe how the experience moved — not to score or label emotions, but to articulate the kind of movement: settling, oscillation, depletion, disruption, saturation, drift, tightening, erosion, opening, etc.

Stay descriptive and qualitative. Name the shape of the trajectory (e.g. "gradual settling", "oscillation between tension and calm", "slow depletion", "delayed disruption"). Describe where the viewer started, how state shifted across the sequence, and where they arrived. Use 2–5 sentences. No markdown, no preamble like "The trajectory is:". Output only the summary.
```

---

## 2. User message (role: `user`)

Filled in with real data from the **Building Portraits** reflection session (`2a17385e-144d-46b7-81a0-2522eefa3c5a_building_portraits_2026-02-11T01-06-56.693Z.json`). This session has 2 reflections (image indices 3 and 5). The prompt includes the **gallery name** (no description — the viewer doesn't see it), the **viewer's initial state** from the profile, then the internal states after each image.

```
Gallery: Building Portraits

Viewer's initial state (before any images; from their profile):

Baseline emotional state: They arrive keyed-up and brisk, with a low-level irritability they don't label as such, reading it instead as "needing to keep moving" and "wanting things to make sense."
Baseline emotional state: Under the pace there's a thin strain of vigilance, like they're on a deadline even if nothing is demanded of them.
Tolerance for ambiguity (low ↔ high): Their tolerance for ambiguity is low; open-endedness quickly feels like missing information rather than an invitation.
Tolerance for ambiguity (low ↔ high): They try to resolve uncertainty by deciding on a single interpretation and moving on, and they distrust lingering doubt.
Relationship to control and boundaries: They strongly prefer clear boundaries and firm structure, and they feel safest when there are rules—where to stand, how long to look, what the point is.
Relationship to control and boundaries: When structure is absent, they compensate by tightening internally, setting their own limits (time-boxing, ranking, judging completeness) to regain control.
Attention style (slow/dwelling, scanning, restless, absorbed, etc.): Their attention style is scanning and task-like, hopping quickly from element to element as if taking inventory.
Attention style (slow/dwelling, scanning, restless, absorbed, etc.): Restlessness rises when nothing "clicks," and absorption only happens briefly when a detail offers a clear handle.
Level of embodied awareness (bodily ↔ cognitive): Their awareness is predominantly cognitive; they monitor thoughts and conclusions more than sensations, noticing the body mainly as tension or impatience.
Aesthetic conditioning (level of exposure to restrained, ambiguous, or non-explanatory art): Their exposure to restrained, ambiguous, non-explanatory art is limited, and they expect works to declare intent without requiring long acclimation.
Primary art background (optional but recommended): Their primary art background is design and instructional media, shaping a preference for legibility, hierarchy, and outcomes over atmosphere.

Internal state at each step (in order):

After image 1: Dominant mood shifts from keyed-up to steadier, with irritation briefly easing under the sense of clear edges. Tension remains but becomes more "contained" than jittery. Energy stays engaged, and emotional openness nudges slightly toward receptive, provided the next image offers similar legibility.

After image 2: Dominant mood steadies further into a controlled calm, with tension staying contained rather than spiking. Energy remains engaged, and my openness increases a notch because the image gives me clear structure to hold onto. There's still a thin vigilance around the softer, less-defined areas, but it doesn't take over.

Summarize this experiential trajectory: what kind of movement does it describe? Where did the viewer start, how did state shift, and where did they arrive?
```

---

## 3. API shape (as sent to e.g. OpenAI)

```json
{
  "model": "gpt-5.2",
  "messages": [
    {
      "role": "system",
      "content": "<system prompt above>"
    },
    {
      "role": "user",
      "content": "<user prompt above>"
    }
  ],
  "max_completion_tokens": 1024,
  "temperature": 0.95
}
```

Note: Token limits vary by provider:
- **OpenAI**: `max_completion_tokens: 1024`
- **Gemini**: `maxOutputTokens: 4096` (higher to accommodate thinking budget)
- **Anthropic**: `max_tokens: 1024`
- **Ollama**: Uses default model settings (no explicit limit)

---

## 4. Example model response

A typical response for this trajectory might be:

```
The trajectory describes a gradual settling. The viewer began keyed-up and irritable, seeking clear boundaries. The first image offered firm edges and legibility, which eased irritation and made tension feel contained. By the second image, the mood steadied into a controlled calm; openness increased as structure was provided, though a thin vigilance remained around less-defined areas. The movement is one of progressive containment rather than resolution — tension doesn’t disappear but becomes manageable and organized.
```

---

## Notes

- **Gallery description** is not included — the simulated viewer never sees it, so the analysis prompt only gives the **gallery name**.
- **Viewer's initial state** (the full profile) is included so the LLM knows where the viewer started before any images. That makes “where did the viewer start?” concrete.
- **Reflection style** is not sent; only the profile (initial state) and the sequence of internal states are.
- **Reflection text** (the emotional response to each image) is not sent; only the **[STATE]** summaries are. So the LLM sees where the viewer started and how state evolved, not the full narrative of each encounter.
- For longer runs (e.g. 10+ images), the user message grows with one “After image N: …” block per step. You may want to cap token count or summarize very long state strings if you hit context limits.
