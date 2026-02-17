# Example: Profile label generation prompt sent to the LLM

After a **viewer profile** and **reflection style** are generated, the app immediately calls the same text LLM to generate a concise **label** (2-5 words) that summarizes the profile. The label is used in the UI to identify profiles when loading saved ones. It is sent as the **system** message (short role) and **user** message (task spec + example labels + the profile text).

---

## 1. System message (role: `system`)

```
You generate concise labels for viewer profiles.
```

---

## 2. User message (role: `user`)

The user message is the **task spec** with **example labels** followed by **"Viewer profile:"** and the **full profile text** that was just generated. Example filled with a profile:

```
Given the following viewer profile, generate a concise label (2-5 words) that captures its essence. The label should summarize the viewer's key characteristics in a memorable way.
Format requirements:
- Sentence case only: capitalize the first word only; all following words lowercase.
- Output only the label text.
- No preamble, no quotes, no markdown.

Examples:
- "Anxious, detail-oriented observer"
- "Restless cognitive explorer"
- "Absorbed, ambiguity-tolerant viewer"
- "Guarded, structure-seeking analyst"

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

Generate the label:
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

Note: Token limits vary by provider. Label generation uses the same `generateText()` function as profile and reflection style generation:
- **OpenAI**: `max_completion_tokens: 1024`
- **Gemini**: `maxOutputTokens: 4096` (higher to accommodate thinking budget)
- **Anthropic**: `max_tokens: 1024`
- **Ollama**: Uses default model settings (no explicit limit)

Note: While labels are short (2-5 words), the API uses the same token limits as other text generation tasks. The models naturally stop after generating the label.

---

## 4. Example model output

A possible response for the profile above:

```
Analytical, structure-seeking observer
```

After cleaning (removes quotes, markdown, etc.), this becomes:

```
Analytical, structure-seeking observer
```

---

## 5. Response processing

The raw label response is cleaned to:
- Remove surrounding quotes (`"label"` → `label`)
- Remove markdown formatting
- Remove introductory phrases
- Trim whitespace

The cleaned label is stored in the profile JSON as:
- `label`: The cleaned label (used in UI)
- `rawLabel`: The original response from the LLM (for reference)

---

## Notes

- **Input**: the profile text only (no images, no gallery, no reflection style).
- **Output**: a concise 2-5 word label that captures the essence of the viewer profile.
- **Timing**: Generated immediately after profile and reflection style generation, as the third step in the viewer creation process.
- **Usage**: Labels are displayed in the profile selector UI to help identify saved profiles. If a label is missing, profiles can be identified by their UUID.
- **Backward compatibility**: Profiles without labels still work; the UI falls back to showing the UUID.
- **Script support**: The `scripts/add-profile-labels.ts` script can generate labels for existing profiles that are missing them.
- Source: `src/prompts.ts` (`PROFILE_LABEL_PROMPT`, `getProfileLabelUserPrompt(viewerProfile)`).
