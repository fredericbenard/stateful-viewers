# Example: Profile generation prompt sent to the LLM

When the user clicks **"Generate viewer profile"**, the app calls the text LLM (e.g. OpenAI, Ollama) with two messages. The **system** message sets the role; the **user** message contains the full task specification plus a **random variability hint** so repeated generations yield different kinds of viewers.

---

## 1. System message (role: `system`)

```
You generate viewer profiles for a gallery simulation. Follow the user's instructions exactly. Output only the profile description: no preamble, no "Here is the profile", no markdown.
```

---

## 2. User message (role: `user`)

The user message is the **task spec** (fixed) plus **one randomly chosen hint** from a list. Example with one possible hint:

```
Generate a viewer profile that will be used to simulate how someone emotionally experiences a sequence of images.

This profile describes a temporary inner stance — a mode of attention and perception — not a fixed personality.

You MUST explicitly address each of the following dimensions. Do not skip or combine dimensions—each one requires its own clear statement:

1. Baseline emotional state (before seeing any images) — What is the viewer's emotional starting point? State this explicitly.

2. Tolerance for ambiguity (low ↔ high) — How comfortable is the viewer with uncertainty and open interpretation? State this explicitly.

3. Relationship to control and boundaries — How does the viewer relate to structure, limits, and control? State this explicitly.

4. Attention style (slow/dwelling, scanning, restless, absorbed, etc.) — How does the viewer attend to images? State this explicitly.

5. Level of embodied awareness (bodily ↔ cognitive) — What is the balance between bodily intuition and cognitive reflection? State this explicitly.

6. Aesthetic conditioning (level of exposure to restrained, ambiguous, or non-explanatory art) — What is the viewer's background with art that doesn't explain itself? State this explicitly.

7. Primary art background (optional but recommended) — What art background shapes this conditioning? (e.g. photography, architecture, painting, cinema, literature, design, mixed, none)

Describe the profile in plain language, ensuring you explicitly address each of the 6 required dimensions (and optionally the 7th). Aim for 8–12 sentences total, with each dimension receiving substantive coverage. You may weave them together narratively, but each dimension must be clearly identifiable in your description.

Avoid:
- references to any images
- psychological theory or explanation
- evaluative language
- introductory phrases like "Here is the viewer profile:" or "The profile is:"
- markdown formatting (no bold, no headers)

Output ONLY the profile description itself, starting directly with the content. The profile should feel like how the viewer arrives at the gallery emotionally and perceptually.

This time, emphasize an unusual combination (e.g. high ambiguity tolerance but low embodied awareness, or the reverse).
```

The last line is one of the **variability hints**. The full list (one is picked at random each time) is:

- "This time, emphasize an unusual combination (e.g. high ambiguity tolerance but low embodied awareness, or the reverse)."
- "This time, make the viewer's baseline emotional state and attention style distinctly different from a neutral default."
- "This time, lean toward one end of several dimensions (e.g. more guarded, more restless, or more absorbed)."
- "This time, give the viewer a strong aesthetic conditioning that clearly shapes their expectations."
- "This time, vary markedly in relationship to control and boundaries, and in how explicitly they might name emotions."
- "This time, make the viewer's stance clearly bodily-oriented or clearly cognitive-oriented, not balanced."
- "This time, produce a viewer who would react very differently from a cautious, reflective default."

---

## 3. API shape (as sent to e.g. OpenAI)

```json
{
  "model": "gpt-5.2",
  "messages": [
    { "role": "system", "content": "<system prompt above>" },
    { "role": "user", "content": "<user prompt above>" }
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

## 4. Example model output

A possible response for the hint above (unusual combination: high ambiguity tolerance, low embodied awareness):

```
Baseline emotional state: mentally energized and slightly detached, arriving with a cool, alert curiosity rather than warmth or anxiety.
Tolerance for ambiguity: high; the viewer is comfortable not resolving meaning and can let unanswered questions stay open without urgency.
Relationship to control and boundaries: relatively high need for structure; they like clear framing, rules, and limits, and they feel most at ease when the experience has an implicit order they can track.
Attention style: absorbed but analytical; they lock onto details, patterns, and internal relationships, staying with one thing for a long time while building a quiet map of how it might fit together.
Level of embodied awareness: low; bodily signals register faintly and late, with perception routed primarily through naming, comparing, and conceptual sorting rather than felt sensation.
Aesthetic conditioning: high exposure to restrained, ambiguous, non-explanatory work; they're practiced at withholding conclusions and reading subtle shifts without needing a statement of intent.
Primary art background: design and conceptual photography, with habits of critique, sequencing, and formal analysis shaping how they look.
They tend to translate what they see into categories—composition, rhythm, constraint, deviation—before noticing mood, temperature, or physical resonance.
When something resists interpretation, they experience it as a productive puzzle rather than a threat, but they still prefer that the puzzle has boundaries.
If the experience becomes too diffuse or purely visceral, they instinctively restore distance by tightening attention, searching for the governing logic that makes the uncertainty feel held.
```

---

## Notes

- **No image** is sent; the profile is generated before any gallery or image is selected.
- The **variability hint** is the only part that changes between calls; the rest of the user message is fixed. That keeps outputs varied without changing the dimensions the profile must cover.
- Source: `src/prompts.ts` (`VIEWER_PROFILE_PROMPT`, `VIEWER_PROFILE_USER_SPEC`, `PROFILE_VARIABILITY_HINTS`, `getViewerProfileUserPrompt()`).
