# Example: Personalized profile generation prompt sent to the LLM

When the user clicks **"New profile → Personalized"**, the app asks a short questionnaire, then calls the text LLM with two messages:

- the same **system** role used for profile generation
- a **user** message containing the personalized task spec + the user's answers

---

## 1. System message (role: `system`)

```
You generate viewer profiles for a gallery simulation. Follow the user's instructions exactly. Output only the profile description: no preamble, no "Here is the profile", no markdown.
```

---

## 2. User message (role: `user`)

The user message is fixed instructions followed by an answers block built from the questionnaire.

```
Generate a viewer profile for a gallery simulation based on the following answers from a real person. The profile should reflect how this person would emotionally and perceptually experience a sequence of images.

You MUST explicitly address each of the following dimensions, using the person's answers to inform your description. Do not skip or combine dimensions—each one requires its own clear statement:

1. Baseline emotional state (before seeing any images) — Use their answer about entering a new place. State this explicitly.

2. Tolerance for ambiguity (low ↔ high) — Use their answer about open interpretation. State this explicitly.

3. Relationship to control and boundaries — Use their answer about structure vs loose. State this explicitly.

4. Attention style (slow/dwelling, scanning, restless, absorbed, etc.) — Use their answer about how they look at art. State this explicitly.

5. Level of embodied awareness (bodily ↔ cognitive) — Use their answer about body/gut vs thoughts. State this explicitly.

6. Aesthetic conditioning (level of exposure to restrained, ambiguous, or non-explanatory art) — Use their answer about exposure. State this explicitly.

7. Primary art background — Use their answer about art background. State this explicitly.

Describe the profile in plain language, ensuring you explicitly address each dimension and that the profile clearly reflects this person's answers. Aim for 8–12 sentences total.

Avoid:
- references to any images
- psychological theory or explanation
- evaluative language
- introductory phrases like "Here is the viewer profile:" or "The profile is:"
- markdown formatting (no bold, no headers)

Output ONLY the profile description itself, starting directly with the content.

Person's answers:

entering_place: I usually enter quietly and scan the room before I settle.
ambiguity: I can sit with uncertainty for a while, but I still look for anchors.
structure: I like some structure, but not rigid rules.
attention: I start broad, then dwell on a few details.
body_vs_thought: Mostly thoughts first, then body sensations arrive later.
restrained_art: Moderate exposure; I often visit galleries with abstract work.
art_background: Photography and literature.
```

If no answers are available, the app sends:

```
Person's answers:

(No answers provided)
```

---

## 3. Questionnaire keys used in the answers block

These keys come directly from `PERSONALIZED_PROFILE_QUESTIONS`:

- `entering_place`
- `ambiguity`
- `structure`
- `attention`
- `body_vs_thought`
- `restrained_art`
- `art_background`

---

## 4. API shape (as sent to e.g. OpenAI)

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
- **Gemini**: `maxOutputTokens: 4096`
- **Anthropic**: `max_tokens: 1024`
- **Ollama**: Uses default model settings

---

## Notes

- This personalized prompt replaces the random variability hint approach used in the non-personalized profile flow.
- The model is still constrained to output only the profile body text (no wrappers).
- Source: `src/prompts.ts` (`VIEWER_PROFILE_PROMPT`, `PERSONALIZED_PROFILE_QUESTIONS`, `PERSONALIZED_PROFILE_USER_SPEC`, `getPersonalizedProfileUserPrompt(answers)`).
