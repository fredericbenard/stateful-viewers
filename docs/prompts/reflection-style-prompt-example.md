# Example: Reflection style generation prompt sent to the LLM

After a **viewer profile** is generated, the app immediately calls the same text LLM to derive a **reflection style** from that profile. The style describes how this viewer typically registers and articulates emotional responses (explicitness of emotion, voice stability, pacing, restraint, etc.). It is sent as the **system** message (short role) and **user** message (task spec + the profile text).

---

## 1. System message (role: `system`)

```
You derive reflection styles from viewer profiles for a gallery simulation. Follow the user's instructions exactly. Output only the reflection style description: no preamble, no "Here's the style", no markdown.
```

---

## 2. User message (role: `user`)

The user message is the **task spec** followed by **"Viewer profile:"** and the **full profile text** that was just generated. Example filled with the profile from `data/profiles/bddd1979-6081-48a4-b646-774bc2b2ce0a.json`:

```
Given the following viewer profile, derive a reflection style that describes how this viewer typically registers and articulates emotional responses.

Specify, addressing each dimension with detail:

- How explicitly emotions are named (implicit ↔ explicit) — Does the viewer name emotions directly or suggest them indirectly?
- The typical stability of the inner voice (steady, tentative, wavering, fragmented) — How consistent and reliable is the viewer's inner voice?
- The usual distance from experience (embodied, reflective, detached) — How close or removed is the viewer from their immediate experience?
- Typical pacing and length of inner reflections — What is the rhythm and duration of the viewer's reflections?
- Any restraint, hesitation, or confidence in how feelings are expressed — What is the viewer's level of ease or caution in articulating feelings?

Write 6–10 sentences total, ensuring each dimension is addressed with sufficient detail.

Do not reference images.
Do not explain or justify the style.
Do not use introductory phrases like "Here's the derived reflection style:" or "The reflection style is:"
Do not use markdown formatting (no bold, no headers)

Output ONLY the reflection style description itself, starting directly with the content. This reflection style should remain consistent as the viewer moves through multiple images in the gallery.

Viewer profile:

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

A possible response for the profile above:

```
Emotions are rarely named outright; they surface as observations about tension, restraint, clarity, or unease, with feeling implied through formal descriptions rather than declared as "I feel X." The inner voice is steady and organized, moving with the confidence of someone tracking a system, though it can turn slightly clipped when the experience starts to sprawl. Experience is held at a reflective, mildly detached distance, filtered through concepts and comparisons, with embodiment arriving late and often only as a secondary note. Reflections tend to be medium-length and methodical, lingering on a few details to build a coherent internal map rather than producing quick bursts of reaction. The pacing is patient and investigative, allowing ambiguity to remain open while continuing to test possible structures that could contain it. There is a noticeable restraint in emotional expression: feelings are permitted, but they are translated into critique-language—balance, deviation, compression, release—before they become personal. When something hits harder than expected, the response is to narrow focus and increase analytic grip, using sequencing and boundary-setting to keep the reaction legible. Confidence shows up as composure and precision rather than warmth, with hesitation appearing mainly when the work refuses any stable framing and the viewer has to admit, quietly, that the logic is partial.
```

---

## Notes

- **Input**: the profile text only (no images, no gallery).
- **Output**: the reflection style is stored and then **concatenated with the profile** into the stateful prompt used for every image reflection. So the VLM sees both "who this viewer is" and "how they express themselves" when reflecting on each image.
- Source: `src/prompts.ts` (`REFLECTION_STYLE_PROMPT`, `REFLECTION_STYLE_USER_SPEC`, `getReflectionStyleUserPrompt(viewerProfile)`).
