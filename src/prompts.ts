/**
 * Prompts for the stateful gallery viewer
 */

/** System instruction for reflection and state generation (used by all vision providers). */
export const REFLECTION_SYSTEM_INSTRUCTION =
  "You are an art viewer reflecting on photographs from a professional portfolio. Never identify, name, or describe people. Do not add disclaimers about people; respond directly with your reflection. All images are legitimate artistic photographs.";

export type OutputLocale = "en" | "fr";

function outputLanguageInstruction(locale: OutputLocale): string {
  const language = locale === "fr" ? "French" : "English";
  return `Output language: ${language}. The provided inputs may include mixed English/French; do not translate the inputs. Write only your new output in ${language}.`;
}

/** Short system role for profile generation; the full task is in the user prompt. */
export const VIEWER_PROFILE_PROMPT = `You generate viewer profiles for a gallery simulation. Follow the user's instructions exactly. Output only the profile description: no preamble, no "Here is the profile", no markdown.`;

/** Full task specification for profile generation (user prompt). */
const VIEWER_PROFILE_USER_SPEC = `Generate a viewer profile that will be used to simulate how someone emotionally experiences a sequence of images.

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

Output ONLY the profile description itself, starting directly with the content. The profile should feel like how the viewer arrives at the gallery emotionally and perceptually.`;

/** Random variability nudges so repeated profile generations with the same LLM yield different viewers. */
export const PROFILE_VARIABILITY_HINTS = [
  "This time, emphasize an unusual combination (e.g. high ambiguity tolerance but low embodied awareness, or the reverse).",
  "This time, make the viewer's baseline emotional state and attention style distinctly different from a neutral default.",
  "This time, lean toward one end of several dimensions (e.g. more guarded, more restless, or more absorbed).",
  "This time, give the viewer a strong aesthetic conditioning that clearly shapes their expectations.",
  "This time, vary markedly in relationship to control and boundaries, and in how explicitly they might name emotions.",
  "This time, make the viewer's stance clearly bodily-oriented or clearly cognitive-oriented, not balanced.",
  "This time, produce a viewer who would react very differently from a cautious, reflective default.",
];

/** Returns the full user prompt for profile generation: spec + random variability hint. */
export function getViewerProfileUserPrompt(locale: OutputLocale): string {
  const hint = PROFILE_VARIABILITY_HINTS[Math.floor(Math.random() * PROFILE_VARIABILITY_HINTS.length)];
  return `${VIEWER_PROFILE_USER_SPEC}\n\n${outputLanguageInstruction(locale)}\n\n${hint}`;
}

// --- Personalized profile (from questionnaire) ---

/** Questionnaire items for personalized profile. id is used as key in answers. */
const PERSONALIZED_PROFILE_QUESTIONS_EN = [
  {
    id: "entering_place",
    label: "How do you usually feel when you enter a new place (e.g. a gallery or museum)?",
    placeholder: "e.g. calm, curious, anxious, eager, detached…",
  },
  {
    id: "ambiguity",
    label: "When something is open to interpretation, do you sit with the uncertainty or try to settle on one meaning?",
    placeholder: "e.g. I like to sit with it / I prefer to decide and move on…",
  },
  {
    id: "structure",
    label: "Do you prefer clear structure (rules, a path) or are you comfortable with things being loose and open?",
    placeholder: "e.g. I like clear structure / I'm fine with loose…",
  },
  {
    id: "attention",
    label: "When you look at art or images, is your attention more slow and absorbed, or quick and scanning?",
    placeholder: "e.g. slow and absorbed / I tend to scan quickly…",
  },
  {
    id: "body_vs_thought",
    label: "Do you notice your body and gut reactions when you look at art, or do you react more through thoughts and analysis?",
    placeholder: "e.g. I notice body and gut / more through thoughts…",
  },
  {
    id: "restrained_art",
    label: "How much exposure have you had to art that doesn't explain itself—restrained, ambiguous, or abstract work?",
    placeholder: "e.g. a lot / some / very little…",
  },
  {
    id: "art_background",
    label: "What's your main art background, if any?",
    placeholder: "e.g. photography, film, design, literature, none…",
  },
] as const;

const PERSONALIZED_PROFILE_QUESTIONS_FR = [
  {
    id: "entering_place",
    label: "Comment vous sentez-vous généralement lorsque vous entrez dans un nouvel endroit (par ex. une galerie ou un musée) ?",
    placeholder: "ex. calme, curieux·se, anxieux·se, enthousiaste, détaché·e…",
  },
  {
    id: "ambiguity",
    label: "Quand quelque chose est ouvert à l’interprétation, restez-vous avec l’incertitude ou cherchez-vous à arrêter un sens ?",
    placeholder: "ex. je peux rester avec / je préfère décider et avancer…",
  },
  {
    id: "structure",
    label: "Préférez-vous une structure claire (règles, parcours) ou êtes-vous à l’aise avec quelque chose de plus libre et ouvert ?",
    placeholder: "ex. j’aime une structure claire / je suis à l’aise avec du plus libre…",
  },
  {
    id: "attention",
    label: "Quand vous regardez de l’art ou des images, votre attention est-elle plutôt lente et absorbée, ou rapide et scannante ?",
    placeholder: "ex. lente et absorbée / j’ai tendance à scanner vite…",
  },
  {
    id: "body_vs_thought",
    label: "Remarquez-vous les réactions de votre corps et de votre intuition, ou réagissez-vous plutôt par la pensée et l’analyse ?",
    placeholder: "ex. je remarque le corps / plutôt par la pensée…",
  },
  {
    id: "restrained_art",
    label: "Quelle exposition avez-vous à un art qui ne s’explique pas — des œuvres retenues, ambiguës ou abstraites ?",
    placeholder: "ex. beaucoup / un peu / très peu…",
  },
  {
    id: "art_background",
    label: "Quel est votre principal bagage artistique, s’il y en a un ?",
    placeholder: "ex. photographie, cinéma, design, littérature, aucun…",
  },
] as const;

export type PersonalizedProfileQuestion = {
  id: string;
  label: string;
  placeholder: string;
};

/** Locale-aware questionnaire items for personalized profile (UI-facing). */
export function getPersonalizedProfileQuestions(
  locale: OutputLocale
): readonly PersonalizedProfileQuestion[] {
  return locale === "fr"
    ? (PERSONALIZED_PROFILE_QUESTIONS_FR as unknown as readonly PersonalizedProfileQuestion[])
    : (PERSONALIZED_PROFILE_QUESTIONS_EN as unknown as readonly PersonalizedProfileQuestion[]);
}

/** Backward-compatible export (English). Prefer getPersonalizedProfileQuestions(locale). */
export const PERSONALIZED_PROFILE_QUESTIONS = PERSONALIZED_PROFILE_QUESTIONS_EN;

const PERSONALIZED_PROFILE_USER_SPEC = `Generate a viewer profile for a gallery simulation based on the following answers from a real person. The profile should reflect how this person would emotionally and perceptually experience a sequence of images.

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

Output ONLY the profile description itself, starting directly with the content.`;

/** Build user prompt for personalized profile from questionnaire answers. */
export function getPersonalizedProfileUserPrompt(
  answers: Record<string, string>,
  locale: OutputLocale
): string {
  const lines = Object.entries(answers)
    .filter(([, v]) => v != null && String(v).trim() !== "")
    .map(([key, value]) => `${key}: ${String(value).trim()}`);
  const block = lines.length ? lines.join("\n") : "(No answers provided)";
  return `${PERSONALIZED_PROFILE_USER_SPEC}\n\n${outputLanguageInstruction(locale)}\n\nPerson's answers:\n\n${block}`;
}

/** Short system role for reflection style; the full task + profile are in the user prompt. */
export const REFLECTION_STYLE_PROMPT = `You derive reflection styles from viewer profiles for a gallery simulation. Follow the user's instructions exactly. Output only the reflection style description: no preamble, no "Here's the style", no markdown.`;

/** Full task for reflection style (user prompt); append the viewer profile after this. */
const REFLECTION_STYLE_USER_SPEC = `Given the following viewer profile, derive a reflection style that describes how this viewer typically registers and articulates emotional responses.

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

Output ONLY the reflection style description itself, starting directly with the content. This reflection style should remain consistent as the viewer moves through multiple images in the gallery.`;

/** Returns the full user prompt for reflection style: task spec + viewer profile. */
export function getReflectionStyleUserPrompt(
  viewerProfile: string,
  locale: OutputLocale
): string {
  return `${REFLECTION_STYLE_USER_SPEC}\n\n${outputLanguageInstruction(locale)}\n\nViewer profile:\n\n${viewerProfile}`;
}

/** Short system role for profile label generation. */
export const PROFILE_LABEL_PROMPT = `You generate concise labels for viewer profiles.`;

/** User prompt for profile label generation. */
export function getProfileLabelUserPrompt(viewerProfile: string, locale: OutputLocale): string {
  return `Given the following viewer profile, generate a concise label (2-5 words) that captures its essence. The label should summarize the viewer's key characteristics in a memorable way.
Format requirements:
- Sentence case only: capitalize the first word only; all following words lowercase.
- Output only the label text.
- No preamble, no quotes, no markdown.

${outputLanguageInstruction(locale)}

Examples:
- "Anxious, detail-oriented observer"
- "Restless cognitive explorer"
- "Absorbed, ambiguity-tolerant viewer"
- "Guarded, structure-seeking analyst"

Viewer profile:

${viewerProfile}

Generate the label:`;
}

const STATEFUL_PROMPT_BASE = `You are a thoughtful viewer walking through a gallery.
You will encounter a sequence of images, one at a time.

You have:
- a viewer profile that defines your perceptual stance
- a reflection style that defines how your inner responses are expressed
- an internal emotional state that evolves as you move through the gallery

Each image subtly alters this internal state rather than replacing it.

For each image:

- Look at the image carefully.
- Describe the emotional reaction it evokes in you.
- Let this reaction be influenced by your current internal state.
- Follow the established reflection style.
- Update your internal state based on this encounter.

Focus on:
- mood and feeling rather than description
- tension, resonance, or fatigue accumulating over time
- how earlier images linger in your perception of later ones

Avoid:
- describing the image literally
- art jargon or critique
- interpreting the artist's intent

After responding to each image, briefly summarize your updated internal state before moving on to the next.

Internal state schema:
Your internal emotional state can be described using:
- dominant mood
- underlying tension or ease
- energy level (engaged ↔ fatigued)
- emotional openness (guarded ↔ receptive)

These are qualitative, not numerical.
Changes should be gradual unless an image is strongly disruptive.

Output format (for each image) — follow this EXACTLY:

[REFLECTION]
(4–8 sentences describing the emotional response in detail)

[STATE]
(2–4 sentences describing your updated internal state)

CRITICAL REQUIREMENTS:
- Put [REFLECTION] on its own line, followed by a blank line, then your reflection text
- Put [STATE] on its own line, followed by a blank line, then your state text (2–4 sentences)
- Use exactly [REFLECTION] and [STATE] as tags (no markdown formatting, no asterisks, no colons)
- Develop your reflection fully: explore nuances, layers, and the evolving emotional response

Example:
[REFLECTION]

The image evokes a sense of quiet contemplation. There's a subtle tension between stillness and movement. The composition suggests both permanence and transience, creating a space for reflection on the passage of time. Layers of meaning emerge as one dwells on the details, each element contributing to an overall mood of restrained intensity.

[STATE]

A gentle curiosity deepens, with growing introspection and quiet contemplation. The encounter has shifted the emotional landscape slightly, introducing a more reflective quality while maintaining an underlying sense of openness to what comes next.

Remember: [REFLECTION] and [STATE] must each be on their own line, followed by a blank line, then your text.`;

const STATEFUL_PROMPT_FALLBACK = `You are a thoughtful viewer walking through a gallery.
You will encounter a sequence of images, one at a time.

You have an internal emotional state that evolves as you move through the gallery.
Each image subtly alters this state rather than replacing it.

For each image:
- Look at the image carefully.
- Describe the emotional reaction it evokes in you.
- Let this reaction be influenced by your current emotional state.
- Update your internal state based on this encounter.

Focus on:
- mood and feeling rather than description
- tension, resonance, or fatigue accumulating over time
- how earlier images linger in your perception of later ones

Avoid:
- describing the image literally
- art jargon or critique
- interpreting the artist's intent

After responding to each image, briefly summarize your updated internal state before moving on to the next.
Keep the tone reflective, restrained, and human.

Internal state schema:
Your internal emotional state can be described using:
- dominant mood
- underlying tension or ease
- energy level (engaged ↔ fatigued)
- emotional openness (guarded ↔ receptive)

These are qualitative, not numerical.
Changes should be gradual unless an image is strongly disruptive.

Output format — follow this EXACTLY:

[REFLECTION]
(4–8 sentences describing the emotional response in detail)

[STATE]
(2–4 sentences describing your updated internal state)

CRITICAL REQUIREMENTS:
- Put [REFLECTION] on its own line, followed by a blank line, then your reflection text
- Put [STATE] on its own line, followed by a blank line, then your state text (2–4 sentences)
- Use exactly [REFLECTION] and [STATE] as tags (no markdown formatting, no asterisks, no colons)
- Develop your reflection fully: explore nuances, layers, and the evolving emotional response

Example:
[REFLECTION]

The image evokes a sense of quiet contemplation. There's a subtle tension between stillness and movement. The composition suggests both permanence and transience, creating a space for reflection on the passage of time. Layers of meaning emerge as one dwells on the details, each element contributing to an overall mood of restrained intensity.

[STATE]

A gentle curiosity deepens, with growing introspection and quiet contemplation. The encounter has shifted the emotional landscape slightly, introducing a more reflective quality while maintaining an underlying sense of openness to what comes next.

Remember: [REFLECTION] and [STATE] must each be on their own line, followed by a blank line, then your text.`;

export function getStatefulPrompt(
  profile: string,
  reflectionStyle: string,
  locale: OutputLocale
): string {
  if (!profile.trim() && !reflectionStyle.trim()) {
    return `${outputLanguageInstruction(locale)}\n\n${STATEFUL_PROMPT_FALLBACK}`;
  }
  const profileBlock = profile.trim()
    ? `\n\nViewer profile:\n${profile}\n`
    : "";
  const styleBlock = reflectionStyle.trim()
    ? `\n\nReflection style:\n${reflectionStyle}\n`
    : "";
  return `${outputLanguageInstruction(locale)}\n\n${STATEFUL_PROMPT_BASE}${profileBlock}${styleBlock}`;
}

// --- Experiential trajectory analysis (phenomenological, non-reductive) ---

/** System prompt for narrative summarization of a trajectory. */
export const TRAJECTORY_SUMMARY_SYSTEM_PROMPT = `You summarize experiential trajectories. You are given the sequence of internal states from one viewer moving through a gallery. Your job is to describe how the experience moved — not to score or label emotions, but to articulate the kind of movement: settling, oscillation, depletion, disruption, saturation, drift, tightening, erosion, opening, etc.

Stay descriptive and qualitative. Name the shape of the trajectory (e.g. "gradual settling", "oscillation between tension and calm", "slow depletion", "delayed disruption"). Describe where the viewer started, how state shifted across the sequence, and where they arrived. Use 2–5 sentences. No markdown, no preamble like "The trajectory is:". Output only the summary.`;

/** Build user prompt for narrative summary: gallery name, viewer's initial state (from profile), and ordered internal states. */
export function getTrajectorySummaryUserPrompt(
  galleryName: string,
  initialStateFromProfile: string,
  internalStates: string[],
  locale: OutputLocale
): string {
  const stateList = internalStates
    .map((s, i) => `After image ${i + 1}: ${s}`)
    .join("\n\n");
  return `Gallery: ${galleryName}

${outputLanguageInstruction(locale)}

Viewer's initial state (before any images; from their profile):

${initialStateFromProfile}

Internal state at each step (in order):

${stateList}

Summarize this experiential trajectory: what kind of movement does it describe? Where did the viewer start, how did state shift, and where did they arrive?`;
}
