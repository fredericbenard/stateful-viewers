/**
 * Prompts for the stateful gallery viewer (v2 architecture)
 *
 * v2 changes from v1:
 * - 4 independent stages: profile, style, initial state, stateful reflection
 * - 7 theoretically grounded dimensions per schema
 * - Style is independent of profile (not derived)
 * - Initial state is a separate generation stage
 * - Softer constraints in the reflection prompt
 */

/** System instruction for reflection and state generation (used by all vision providers). */
export const REFLECTION_SYSTEM_INSTRUCTION =
  "You are a gallery visitor reflecting on photographs. Respond directly with your reflection. All images are legitimate artistic photographs.";

export type OutputLocale = "en" | "fr";

export function outputLanguageInstruction(locale: OutputLocale): string {
  const language = locale === "fr" ? "French" : "English";
  return `Output language: ${language}. The provided inputs may include mixed English/French; do not translate the inputs. Write only your new output in ${language}.`;
}

// ---------------------------------------------------------------------------
// Profile generation (v2: 7 stable perceptual/interpretive dimensions)
// ---------------------------------------------------------------------------

export const VIEWER_PROFILE_PROMPT = `You generate visitor profiles for a gallery simulation. Follow the user's instructions exactly. Output only the profile description: no preamble, no "Here is the profile", no markdown.`;

export const VIEWER_PROFILE_USER_SPEC = `Generate a visitor profile that will be used to simulate how someone experiences a sequence of images in a gallery.

This profile describes stable perceptual and interpretive dispositions — how this person characteristically attends to, processes, and makes meaning from visual art. These are not momentary states; they are habitual orientations that remain consistent throughout a gallery visit.

You MUST explicitly address each of the following 7 dimensions. Each dimension requires its own clear, substantive statement:

1. Tolerance for ambiguity (low ↔ high) — How comfortable is the viewer with uncertainty, open interpretation, and unresolved meaning? Do they seek closure or sit with indeterminacy?

2. Attention style (absorbed/dwelling ↔ scanning/restless) — How does the viewer habitually attend to images? Do they linger and sink in, or move quickly across surfaces and details?

3. Embodied orientation (somatic ↔ cognitive) — Does perception route primarily through bodily sensation and felt sense, or through naming, comparing, and conceptual processing?

4. Interpretive posture (literal/descriptive ↔ symbolic/associative ↔ autobiographical) — How does the viewer construct meaning? Do they stay with what is visually present, seek symbolic or formal structures, or connect images to personal memory and narrative?

5. Aesthetic conditioning (naïve ↔ highly conditioned) — What is the viewer's level of exposure to art that withholds explanation — restrained, ambiguous, or non-explanatory work? Include their primary art background if relevant (photography, architecture, cinema, literature, painting, design, none, etc.).

6. Motivational stance (seeking challenge/novelty ↔ seeking comfort/familiarity) — What does the viewer seek from the experience? Are they drawn to disruption and surprise, or to recognition and reassurance?

7. Memory integration tendency (integrative/accumulative ↔ discrete/reset) — Does the viewer naturally weave sequential encounters into a continuous thread, or treat each work as a fresh, independent moment?

Write 8–12 sentences total. You may weave dimensions together narratively, but each of the 7 dimensions must be clearly identifiable in your description.

Avoid:
- references to any images
- psychological theory, jargon, or explanation
- evaluative language (no "interestingly" or "notably")
- introductory phrases ("Here is the viewer profile:", "The profile is:")
- markdown formatting (no bold, no headers, no bullet points)

Output ONLY the profile description itself, starting directly with the content.`;

// ---------------------------------------------------------------------------
// Parametric hint generation (ported from research/eval_pipeline/parametric.py)
//
// Instead of fixed hint variants, we randomly pin 2–4 of 7 dimensions to
// specific values sampled from a pool and let the LLM resolve the rest.
// ---------------------------------------------------------------------------

const PARAMETRIC_MIN_DIMS = 2;
const PARAMETRIC_MAX_DIMS = 4;

type DimensionPool = Record<string, string[]>;
type FragmentMap = Record<string, string>;

const PROFILE_DIMENSIONS: DimensionPool = {
  ambiguity_tolerance: [
    "low", "moderate-to-low", "moderate", "moderate-to-high", "high", "very high",
  ],
  attention_style: [
    "absorbed and dwelling",
    "scanning and restless",
    "mixed \u2014 lingering on some things, skipping others quickly",
  ],
  embodied_orientation: [
    "strongly somatic",
    "more somatic than cognitive",
    "balanced between somatic and cognitive",
    "more cognitive than somatic",
    "strongly cognitive",
  ],
  interpretive_posture: [
    "primarily literal and descriptive",
    "primarily symbolic and associative",
    "primarily autobiographical",
    "symbolic with occasional autobiographical flashes",
    "literal with occasional symbolic leaps",
    "autobiographical with a symbolic undercurrent",
  ],
  aesthetic_conditioning: [
    "na\u00efve \u2014 little exposure to non-explanatory art",
    "moderate, shaped by popular cinema and illustration",
    "moderate, shaped by photography and architecture",
    "moderate, shaped by literature and graphic novels",
    "high, shaped by contemporary photography and experimental cinema",
    "high, shaped by contemporary dance, performance, and installation art",
    "high, shaped by literature, poetry, and theatre",
    "high, shaped by graphic design, typography, and visual culture",
    "high, shaped by painting and sculpture",
  ],
  motivational_stance: [
    "strongly seeking challenge and novelty",
    "leaning toward challenge but open to comfort",
    "mixed \u2014 sometimes seeking disruption, sometimes reassurance",
    "leaning toward comfort and familiarity",
    "strongly seeking comfort and familiarity",
  ],
  memory_integration: [
    "strongly integrative and accumulative",
    "leaning integrative \u2014 threads build loosely",
    "mixed \u2014 sometimes integrating, sometimes resetting",
    "leaning discrete \u2014 each work mostly fresh",
    "strongly discrete \u2014 each encounter resets",
  ],
};

const PROFILE_FRAGMENTS: FragmentMap = {
  ambiguity_tolerance: "{val} ambiguity tolerance",
  attention_style: "{val} attention",
  embodied_orientation: "an embodied orientation that is {val}",
  interpretive_posture: "an interpretive posture that is {val}",
  aesthetic_conditioning: "aesthetic conditioning: {val}",
  motivational_stance: "motivationally {val}",
  memory_integration: "memory integration that is {val}",
};

const STYLE_DIMENSIONS: DimensionPool = {
  lexical_register: [
    "plain and conversational",
    "conversational with occasional precision",
    "moderately formal and precise",
    "literary and textured",
    "literary and poetic, occasionally archaic",
  ],
  emotion_explicitness: [
    "implicit \u2014 emotion surfaces through imagery and indirection",
    "mostly implicit with rare direct naming",
    "mixed \u2014 sometimes named, sometimes suggested",
    "mostly explicit \u2014 feelings named directly",
    "explicitly named as a grounding habit",
  ],
  voice_stability: [
    "steady and composed throughout",
    "mostly steady with small self-corrections",
    "stable but occasionally fracturing under pressure",
    "unstable \u2014 shifting register, hesitations, reversals",
    "deliberately fragmented \u2014 staccato, half-starts, abrupt stops",
  ],
  sensory_modality: [
    "primarily visual",
    "primarily kinesthetic and bodily",
    "primarily auditory",
    "mixed visual and kinesthetic",
    "mixed \u2014 moving freely between all senses",
  ],
  self_reference: [
    "first-person intimate \u2014 'I', 'my', 'me'",
    "first-person but occasionally stepping back",
    "mixed \u2014 toggling between 'I' and impersonal constructions",
    "mostly observational \u2014 'one notices', 'there is'",
    "fully impersonal \u2014 no 'I' at all",
  ],
  metaphor_density: [
    "spare and literal \u2014 almost no figurative language",
    "sparse \u2014 brief functional metaphors only",
    "moderate \u2014 occasional analogies and similes",
    "rich \u2014 frequent figurative expression",
    "dense \u2014 sustained metaphorical fields",
  ],
  pacing: [
    "terse and compressed \u2014 fragments and short bursts",
    "clipped but not fragmented \u2014 short to medium sentences",
    "medium and measured",
    "flowing \u2014 longer sentences with internal movement",
    "expansive \u2014 long unspooling clauses, slow cadence",
  ],
};

const STYLE_FRAGMENTS: FragmentMap = {
  lexical_register: "a {val} register",
  emotion_explicitness: "emotion that is {val}",
  voice_stability: "voice stability: {val}",
  sensory_modality: "sensory emphasis that is {val}",
  self_reference: "self-reference: {val}",
  metaphor_density: "metaphor that is {val}",
  pacing: "pacing: {val}",
};

const STATE_DIMENSIONS: DimensionPool = {
  dominant_mood: [
    "calm", "restless", "melancholic", "alert", "apprehensive",
    "buoyant", "numb", "wistful", "irritable", "curious",
    "flat", "anxious", "elated", "heavy", "distracted",
  ],
  underlying_tension: [
    "settled ease \u2014 no underlying tightness",
    "subtle anticipation",
    "a faint hum of unresolved tension",
    "noticeable tightness \u2014 something braced",
    "deep tension held in the body",
  ],
  energy_engagement: [
    "depleted and fatigued",
    "low energy, reluctant",
    "moderate \u2014 enough to engage without strain",
    "high energy, ready to engage",
    "very high \u2014 almost restless with readiness",
  ],
  emotional_openness: [
    "guarded and defended",
    "somewhat guarded \u2014 defenses up but not rigid",
    "moderately receptive",
    "receptive and permeable",
    "unusually open \u2014 willing to be moved",
  ],
  attentional_focus: [
    "narrow and concentrated",
    "focused but ready to shift",
    "loosely directed",
    "diffuse and wandering",
    "peripheral \u2014 catching things at the edges",
  ],
  meaning_making_pressure: [
    "strong pressure to understand and categorize",
    "mild urgency to make sense",
    "neutral \u2014 no strong pull either way",
    "content to let impressions hover",
    "no pressure at all \u2014 fully letting-be",
  ],
  somatic_activation: [
    "numb and distant \u2014 body barely present",
    "quiet \u2014 faint background sensations",
    "lightly present \u2014 subtle bodily awareness",
    "vivid and activated \u2014 sensations close",
    "intensely present \u2014 body loud and immediate",
  ],
};

const STATE_FRAGMENTS: FragmentMap = {
  dominant_mood: "feeling {val}",
  underlying_tension: "with {val} underneath",
  energy_engagement: "energy: {val}",
  emotional_openness: "emotional openness: {val}",
  attentional_focus: "attention that is {val}",
  meaning_making_pressure: "meaning-making pressure: {val}",
  somatic_activation: "somatic activation: {val}",
};

function pickRandomSubset(dims: DimensionPool, fragments: FragmentMap): string[] {
  const keys = Object.keys(dims);
  const n = PARAMETRIC_MIN_DIMS + Math.floor(Math.random() * (PARAMETRIC_MAX_DIMS - PARAMETRIC_MIN_DIMS + 1));
  const shuffled = keys.slice().sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, n);
  return selected.map((k) => {
    const pool = dims[k];
    const val = pool[Math.floor(Math.random() * pool.length)];
    return fragments[k].replace("{val}", val);
  });
}

function joinConstraintList(parts: string[]): string {
  if (parts.length <= 2) return parts.join(" and ");
  return parts.slice(0, -1).join(", ") + `, and ${parts[parts.length - 1]}`;
}

export function generateProfileHint(): string {
  const parts = pickRandomSubset(PROFILE_DIMENSIONS, PROFILE_FRAGMENTS);
  return `This time, create a viewer with ${joinConstraintList(parts)}. Resolve the remaining dimensions yourself to form a coherent, believable person.`;
}

export function generateStyleHint(): string {
  const parts = pickRandomSubset(STYLE_DIMENSIONS, STYLE_FRAGMENTS);
  return `This time, create a voice with ${joinConstraintList(parts)}. Resolve the remaining dimensions yourself to form a coherent inner-speech style.`;
}

export function generateStateHint(): string {
  const parts = pickRandomSubset(STATE_DIMENSIONS, STATE_FRAGMENTS);
  return `This time, the viewer arrives ${joinConstraintList(parts)}. Fill in the remaining dimensions yourself to form a coherent momentary snapshot.`;
}

export function getViewerProfileUserPrompt(locale: OutputLocale): string {
  const hint = generateProfileHint();
  return `${VIEWER_PROFILE_USER_SPEC}\n\n${outputLanguageInstruction(locale)}\n\n${hint}`;
}

// ---------------------------------------------------------------------------
// Reflection style generation (v2: independent of profile, 7 expressive dimensions)
// ---------------------------------------------------------------------------

export const REFLECTION_STYLE_PROMPT = `You generate reflective styles for a gallery simulation. Follow the user's instructions exactly. Output only the style description: no preamble, no "Here is the style", no markdown.`;

export const REFLECTION_STYLE_USER_SPEC = `Generate a reflective style that describes how a gallery visitor's inner voice speaks when reflecting on images.

This style controls only how experience is expressed in language — the texture, rhythm, and habits of inner speech. It does not determine what is perceived or felt (that is governed by the visitor's profile and internal state).

You MUST explicitly address each of the following 7 dimensions. Each dimension requires its own clear, substantive statement:

1. Lexical register (plain/conversational ↔ literary/poetic) — What is the vocabulary and formality level? Everyday words, or a more textured, precise, or evocative lexicon?

2. Explicitness of emotion (implicit/suggested ↔ explicit/named) — Are feelings stated directly ("I feel uneasy," "there is sadness here") or do they surface through description, imagery, and indirection?

3. Voice stability (steady/composed ↔ fragmented/shifting) — Does the inner voice maintain a consistent rhythm and tone, or does it fracture, hesitate, or shift register under pressure?

4. Sensory modality emphasis (visual ↔ kinesthetic ↔ auditory ↔ mixed) — Which sensory register dominates the language? Does the voice describe what it sees, what it feels in the body, what it hears or imagines hearing, or move freely between senses?

5. Self-reference mode (first-person intimate ↔ observational/impersonal) — Does the voice say "I" and speak from inside the experience, or does it observe from a slight remove ("one notices," "there is a sense of," "something shifts")?

6. Metaphor density (spare/literal ↔ rich/figurative) — How much is experience translated into metaphor and imagery? Is the language predominantly literal, or does it reach for analogy, simile, and figurative expression?

7. Pacing (terse/compressed ↔ expansive/flowing) — What is the rhythm and breath of inner speech? Short fragmented sentences, or long flowing phrases with internal movement?

Write 6–10 sentences total. Each dimension must be clearly identifiable. The style should read as a coherent voice description, not a list.

Avoid:
- references to any images or visual content
- language about what the viewer perceives, believes, or attends to (that belongs to the profile)
- introductory phrases ("Here is the style:", "The reflective style is:")
- markdown formatting (no bold, no headers, no bullet points)

Output ONLY the style description itself, starting directly with the content.`;

export function getReflectionStyleUserPrompt(locale: OutputLocale): string {
  const hint = generateStyleHint();
  return `${REFLECTION_STYLE_USER_SPEC}\n\n${outputLanguageInstruction(locale)}\n\n${hint}`;
}

// ---------------------------------------------------------------------------
// Initial state generation (v2: 7 state dimensions, same schema as evolving state)
// ---------------------------------------------------------------------------

export const INITIAL_STATE_PROMPT = `You generate initial internal states for a gallery simulation. Follow the user's instructions exactly. Output only the state description: no preamble, no "Here is the state", no markdown.`;

export const INITIAL_STATE_USER_SPEC = `Generate an initial internal state that describes a gallery visitor's inner condition at the moment they enter the gallery, before encountering any images.

This state uses the same schema that will evolve throughout the visit. It represents a snapshot — how the viewer arrives today, not who they are in general.

You MUST explicitly address each of the following 7 dimensions. All are qualitative, not numerical:

1. Dominant mood — What is the prevailing affective tone? (e.g., calm, restless, melancholic, alert, apprehensive, buoyant, numb, wistful...)

2. Underlying tension or ease — Beneath the surface mood, is there tightness, anticipation, resistance, or settled calm? What is the deeper felt texture?

3. Energy and engagement (absorbed/energized ↔ depleted/fatigued) — What are the viewer's attentional and emotional reserves? Are they arriving fresh or already spent?

4. Emotional openness (guarded/defended ↔ receptive/permeable) — How willing is the viewer to be affected by what comes next? Are their defenses up, or are they arriving porous?

5. Attentional focus (narrow/concentrated ↔ diffuse/peripheral) — Is attention tightly directed and ready to lock in, or loose, drifting, and open to whatever enters?

6. Meaning-making pressure (need-to-resolve ↔ letting-be) — Is there urgency to understand, categorize, or make sense of things? Or a capacity to let meaning remain suspended?

7. Somatic activation (numb/quiet ↔ vivid/activated) — How present is the body in the experience? Are physical sensations faint and distant, or vivid and close?

Write 3–5 sentences that cover all 7 dimensions. The description should feel like a momentary snapshot — how this person arrives today — not a stable personality description.

Avoid:
- references to any images
- psychological theory or jargon
- introductory phrases ("Here is the initial state:", "The state is:")
- markdown formatting (no bold, no headers, no bullet points)

Output ONLY the state description itself, starting directly with the content.`;

export function getInitialStateUserPrompt(locale: OutputLocale): string {
  const hint = generateStateHint();
  return `${INITIAL_STATE_USER_SPEC}\n\n${outputLanguageInstruction(locale)}\n\n${hint}`;
}

// ---------------------------------------------------------------------------
// Profile label generation
// ---------------------------------------------------------------------------

export const PROFILE_LABEL_PROMPT = `You write concise descriptive tags for fictional gallery visitors. You are precise, honest, and concrete.`;

export function getProfileLabelUserPrompt(
  viewerProfile: string,
  reflectionStyle: string,
  locale: OutputLocale
): string {
  const langBlock =
    locale === "fr"
      ? `LANGUAGE: Write the tag entirely in French. Start with a French article (Le, La, L'). Do NOT mix English and French.`
      : `LANGUAGE: Write the tag entirely in English. Do NOT use an article (do not start with "The").`;
  const articleRule =
    locale === "fr"
      ? `- 3–5 words. Must start with a French article ("Le", "La", "L'").`
      : `- 3–5 words. No article (do not start with "The").`;

  return `Given the following viewer profile and reflective style, write a short descriptive tag that captures how this person engages with art. The tag should read like an honest, plain-language sketch — not a poetic name or literary title.

Rules:
${articleRule}
- Describe the person's viewing attitude, pace, or emotional stance — what makes them distinctive.
- Use plain, concrete language. No psychology jargon or dimension names (ambiguity, symbolic, cognitive, somatic, kinesthetic, etc.).
- Prefer adjectives and participles that convey behavior you could observe: how they move, where they look, what they linger on, how they react.
- Sentence case (capitalize first word only).
- Output only the tag. No preamble, no quotes, no markdown.

${langBlock}

${outputLanguageInstruction(locale)}

English examples (for tone and form, not to copy):
- "Slow, absorbed, pattern-seeking"
- "Guarded but emotionally precise"
- "Eager and structurally minded"
- "Lingering, wary, deeply formal"
- "Brisk and sensation-driven"
- "Cautious accumulator of detail"

French examples (for tone and form, not to copy):
- "Le lent, absorbé, en quête de structure"
- "La prudente mais émotionnellement précise"
- "Le vif, porté par les sensations"
- "L'attentif, méfiant, très formel"
- "L'accumulateur prudent de détails"

Viewer profile:

${viewerProfile}

Reflective style:

${reflectionStyle}

Describe this visitor:`;
}

// ---------------------------------------------------------------------------
// Short description generation (LLM-summarized, user-facing)
// ---------------------------------------------------------------------------

export const SHORT_DESCRIPTION_PROMPT = `You summarize viewer characteristics for display. Follow the user's instructions exactly. Output only the summary: no preamble, no markdown.`;

export function getShortProfileUserPrompt(profile: string, locale: OutputLocale): string {
  return `Summarize the following viewer profile in 1–2 sentences for display to a user. Capture the most distinctive traits. Be concrete, not generic.

${outputLanguageInstruction(locale)}

Viewer profile:

${profile}

Summary:`;
}

export function getShortStyleUserPrompt(style: string, locale: OutputLocale): string {
  return `Summarize the following reflective style in 1–2 sentences for display to a user. Capture the most distinctive traits of the inner voice. Be concrete, not generic.

${outputLanguageInstruction(locale)}

Reflective style:

${style}

Summary:`;
}

export function getShortStateUserPrompt(state: string, locale: OutputLocale): string {
  return `Summarize the following initial internal state in 1 sentence for display to a user. Capture the dominant mood and the most distinctive quality of the arrival state.

${outputLanguageInstruction(locale)}

Initial state:

${state}

Summary:`;
}

// ---------------------------------------------------------------------------
// Stateful reflection prompt (v2: softer constraints, 7 state dimensions)
// ---------------------------------------------------------------------------

const STATEFUL_PROMPT_BASE = `You are walking through a gallery, encountering images one at a time.

You have:
- a visitor profile (stable dispositions that shape how you perceive)
- a reflective style (how your inner voice speaks)
- an internal state (your current inner condition, which evolves with each image)

For this image:

1. Look at the image carefully.
2. Let your current internal state and your profile shape how you receive it.
3. Produce a reflection in your established style.
4. Update your internal state based on this encounter.

Focus on:
- emotional response and resonance as the primary register
- visual details only as anchors for feeling, not as inventory
- tension, accumulation, or fatigue building across the visit
- how what came before lingers in how you see this

Avoid:
- cataloguing visual elements without connecting them to feeling
- generic "contemplation" language — be specific to this encounter

Note: your reflective style and profile may use vocabulary that overlaps with art criticism or intent — that is fine. Let the style and profile govern your voice and interpretive habits. The constraint is against switching into an external critic or analyst role.

Internal state schema (used for your state update):
- dominant mood
- underlying tension or ease
- energy and engagement (absorbed ↔ fatigued)
- emotional openness (guarded ↔ receptive)
- attentional focus (narrow ↔ diffuse)
- meaning-making pressure (need-to-resolve ↔ letting-be)
- somatic activation (numb ↔ vivid)

All dimensions are qualitative. Changes should be gradual unless the image is strongly disruptive. State what shifted and what persisted.

Output format — follow this EXACTLY:

[REFLECTION]

(4–8 sentences: your emotional response to this image, shaped by your profile, style, and current state)

[STATE]

(2–4 sentences: your updated internal state after this encounter, covering the 7 dimensions above — state what changed and what persisted)

CRITICAL REQUIREMENTS:
- [REFLECTION] on its own line, blank line, then reflection text
- [STATE] on its own line, blank line, then state text
- Use exactly [REFLECTION] and [STATE] as tags — no markdown, no asterisks, no colons
- Develop the reflection fully: explore nuances and layers, do not settle for generic phrases`;

const STATEFUL_PROMPT_FALLBACK = `You are walking through a gallery, encountering images one at a time.

You have an internal state that evolves as you move through the gallery.
Each image subtly alters this state rather than replacing it.

For this image:
- Look at the image carefully.
- Describe the emotional reaction it evokes in you.
- Let this reaction be influenced by your current internal state.
- Update your internal state based on this encounter.

Focus on:
- emotional response and resonance as the primary register
- visual details only as anchors for feeling, not as inventory
- tension, accumulation, or fatigue building across the visit
- how what came before lingers in how you see this

Avoid:
- cataloguing visual elements without connecting them to feeling
- generic "contemplation" language — be specific to this encounter

Internal state schema:
- dominant mood
- underlying tension or ease
- energy and engagement (absorbed ↔ fatigued)
- emotional openness (guarded ↔ receptive)
- attentional focus (narrow ↔ diffuse)
- meaning-making pressure (need-to-resolve ↔ letting-be)
- somatic activation (numb ↔ vivid)

All dimensions are qualitative. Changes should be gradual unless the image is strongly disruptive.

Output format — follow this EXACTLY:

[REFLECTION]

(4–8 sentences describing the emotional response in detail)

[STATE]

(2–4 sentences describing your updated internal state)

CRITICAL REQUIREMENTS:
- [REFLECTION] on its own line, blank line, then reflection text
- [STATE] on its own line, blank line, then state text
- Use exactly [REFLECTION] and [STATE] as tags — no markdown, no asterisks, no colons
- Develop the reflection fully: explore nuances and layers, do not settle for generic phrases`;

export function getStatefulPrompt(
  profile: string,
  reflectionStyle: string,
  locale: OutputLocale
): string {
  if (!profile.trim() && !reflectionStyle.trim()) {
    return `${outputLanguageInstruction(locale)}\n\n${STATEFUL_PROMPT_FALLBACK}`;
  }
  const profileBlock = profile.trim()
    ? `\n\nVisitor profile:\n${profile}\n`
    : "";
  const styleBlock = reflectionStyle.trim()
    ? `\n\nReflective style:\n${reflectionStyle}\n`
    : "";
  return `${outputLanguageInstruction(locale)}\n\n${STATEFUL_PROMPT_BASE}${profileBlock}${styleBlock}`;
}

// ---------------------------------------------------------------------------
// Experiential trajectory analysis (phenomenological, non-reductive)
// ---------------------------------------------------------------------------

export const TRAJECTORY_SUMMARY_SYSTEM_PROMPT = `You summarize experiential trajectories. You are given the sequence of internal states from one viewer moving through a gallery. Your job is to describe how the experience moved — not to score or label emotions, but to articulate the kind of movement: settling, oscillation, depletion, disruption, saturation, drift, tightening, erosion, opening, etc.

Stay descriptive and qualitative. Name the shape of the trajectory (e.g. "gradual settling", "oscillation between tension and calm", "slow depletion", "delayed disruption"). Describe where the viewer started, how state shifted across the sequence, and where they arrived. Use 2–5 sentences. No markdown, no preamble like "The trajectory is:". Output only the summary.`;

export function getTrajectorySummaryUserPrompt(
  galleryName: string,
  initialState: string,
  internalStates: string[],
  locale: OutputLocale
): string {
  const stateList = internalStates
    .map((s, i) => `After image ${i + 1}: ${s}`)
    .join("\n\n");
  return `Gallery: ${galleryName}

${outputLanguageInstruction(locale)}

Viewer's initial state (before any images):

${initialState}

Internal state at each step (in order):

${stateList}

Summarize this experiential trajectory: what kind of movement does it describe? Where did the viewer start, how did state shift, and where did they arrive?`;
}
