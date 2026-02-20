# Project critique: research + artistic assessment (so far)

This document critiques **Stateful Viewers** as it currently exists in the repository, based on:

- `README.md` (conceptual framing, pipeline, references)
- the in-app About content (`src/content/about.ts`)

It aims to do two things at once:

1. **Research critique**: Treat the system as a set of modelling commitments that should be theoretically motivated and/or empirically probed.
2. **Artistic critique**: Treat the system as an artwork about mediation, reception, and “manufactured interiority,” and ask what experiences it produces for a viewer of the webapp.

Throughout, I assume the thesis stance already stated in your research docs: this is **not** a claim to model real human phenomenology, but a computational operationalization of temporal carryover that should be testable in comparative experiments.

---

## 1) What the project currently commits to (explicitly)

### The pipeline (as implemented and documented)

The project defines a specific causal/functional story:

- **(A) Viewer profile** (text-only LLM, generated before any images)
  - Required dimensions: baseline emotional state; tolerance for ambiguity; relationship to control/boundaries; attention style; embodied awareness; aesthetic conditioning; optionally primary art background.
- **(B) Reflection style** (text-only LLM, derived *from* the profile)
  - Dimensions: explicitness of emotions; voice stability; distance from experience; pacing/length; restraint/confidence.
- **(C) Stateful reflection per image** (vision-language model; repeated over a sequence)
  - Inputs: the image, the profile, the style, and (from image 2 onward) the **previous internal state**.
  - Outputs: a `[REFLECTION]` block and a `[STATE]` block.
- **(D) Trajectory summary** (text-only LLM)
  - Summarizes the sequence of states as an “experiential trajectory,” qualitatively (settling/oscillation/depletion/etc.), without numeric scoring.

This is coherent as a “minimal” stateful architecture: a stable stance + stable expression + evolving internal state.

### The internal state schema (as currently framed)

The app constrains the evolving state to four qualitative axes (phrased in prose, not slots):

- dominant mood
- underlying tension or ease
- energy level (engaged ↔ fatigued)
- emotional openness (guarded ↔ receptive)

### A major meta-choice: “qualitative, not numerical”

Across profile, style, and state, the system explicitly refuses:

- numeric affect scores (valence/arousal)
- categorical emotion labels as the primary representation

This is not neutral: it’s a philosophical and aesthetic choice as much as a technical one.

---

## 2) Research critique: theory-to-schema mapping is currently under-justified

The README/About cite reception theory, phenomenology, aesthetic psychology, inner speech, narrative psychology, Dewey/Tomkins. Those are plausible anchors, but the mapping from “thinkers” → “dimensions” is still mostly asserted rather than argued.

### Why this matters

Without a tighter mapping, the system risks reading (to reviewers) as:

- a compelling demo with scholarly references attached, rather than
- a research instrument that operationalizes specific theoretical constructs and can be probed under controlled manipulations.

You can absolutely keep the qualitative ethos and still strengthen the mapping by being explicit about:

- what each chosen dimension is intended to *stand in for* (construct definition),
- what counts as evidence that the dimension is doing work (behavioral signature),
- what alternative dimensions were rejected (and why).

---

## 3) Critique of the **viewer profile dimensions**

### Are these “the best” dimensions?

They are defensible, but they look like a pragmatic bundle rather than a principled minimal set.

- **Strength**: They span affect (baseline), cognition/interpretation (ambiguity tolerance), control orientation, attentional mode, embodiment, and art exposure. That is a good coverage of levers likely to change sequential perception in a gallery.
- **Weakness**: Several are broad and overlapping; some theoretically central reception-theory notions are only indirectly represented.

### Basis for selecting them (as currently evidenced in-repo)

Based on the prompt docs, selection appears to be guided by:

- interpretability to lay readers,
- steerability for language models,
- plausibility as “stateful” levers across sequences,
- a desire to avoid clinical/diagnostic framing.

That’s valid, but it’s not yet a *research justification*. It’s a design justification.

### What might be missing (high-impact candidates)

If you want closer alignment with reception theory / situated viewing, consider adding or experimenting with dimensions like:

- **Horizon / expectation of meaning** (Jauss-like): does the viewer expect “a point,” accept opacity, seek narrative, seek formalism?
- **Interpretive posture**: suspicious vs charitable; symbolic vs literal; autobiographical vs impersonal reading.
- **Motivational stance**: curiosity vs obligation; seeking consolation vs seeking challenge; novelty seeking vs familiarity seeking.
- **Social situation**: alone vs accompanied; observed vs private; “performing sophistication” vs honest response.
- **Temporal constraint**: time pressure vs leisure (often strongly shapes attention and openness).
- **Value sensitivity**: attraction/repulsion triggers, moral salience, taboo sensitivity (especially relevant given photographic subject matter).
- **Memory style**: tendency to integrate across time vs treat each work as discrete; rumination vs reset.

Not all belong in the “core” schema, but they are good candidates for ablation experiments.

### A research-friendly way to justify (and not overfit) the profile schema

Treat profile dimensions as hypotheses about controllable levers:

- **Construct**: define it plainly.
- **Mechanism claim**: what it should change in sequential reflections.
- **Signature**: what to look for in output (human ratings or proxies).
- **Failure mode**: what “cosmetic only” looks like.

This lets you keep the current dimensions while acknowledging that they are provisional.

---

## 4) Critique of the **reflection style dimensions**

### Are these “the best” dimensions?

They are good “surface realization” controls: how text sounds, not what is seen. That matches your stated intention (“stable expressive voice across images”).

But they’re also *partly stance* controls in disguise:

- “distance from experience” and “restraint/confidence” are not merely expressive; they can change what is attended to and what is permitted to be felt.

So the style schema is at risk of confounding:

- **voice** (linguistic surface)
- with **posture** (interpretive/affective stance)

### What might be missing (if you want better disentanglement)

Consider adding style axes that are more purely expressive, e.g.:

- **lexical register** (plain vs poetic)
- **metaphor density**
- **sensory language emphasis** (visual/kinesthetic/auditory)
- **degree of uncertainty markers** (“maybe,” “as if,” questions)
- **self-reference pronoun posture** (“I” vs impersonal)

These can help you keep “style” as style, while leaving “stance” in the profile/state.

---

## 5) Why derive reflection style from the profile?

### Plausible theoretical basis (but currently implicit)

Deriving style from profile can be argued as:

- **Inner speech is shaped by stance** (Vygotsky): how one talks to oneself is not independent of one’s habitual orientation.
- **Narrative identity / meaning-making** (Bruner): the “telling” is part of the experiencing; expression and interpretation co-constitute.
- **Phenomenological reduction / attitude** (Husserl): a shift in attitude changes not only what appears but how it is articulated.

So “profile → style” is defensible as a modelling of *coherence*.

### The research problem: derivation reduces degrees of freedom, but introduces confounds

If style is derived from profile, then when you observe differences between profiles you cannot easily tell whether divergence is driven by:

- stance differences (profile),
- expression differences (style),
- or their interaction.

This is fine for an artwork (coherence matters more than identifiability), but it is a problem for causal claims.

### Alternatives worth considering (as experimental conditions)

- **Factorial independence**: generate profile and style independently; then run swaps (Profile A × Style B).
- **Style library**: a fixed set of curated styles; the profile only sets stance.
- **User-selected style**: keep profile generated, but let the user choose expression constraints (tight control over confounds).
- **Two-level style**: (1) stable voice constraints (purely linguistic), (2) stance constraints (kept with profile/state).

Even if you keep derivation for the main app, implementing one of these as an “experiment mode” would strengthen the research program.

---

## 6) Critique of the **reflection + updated state prompt**

### The prompt is clear, but it creates predictable failure modes

Your stateful prompt does several good things:

- enforces structured output (`[REFLECTION]`, `[STATE]`) for parsing,
- emphasizes temporality and carryover,
- discourages literal description and art-critique voice,
- defines a state schema.

However, it also predictably invites:

- **state copying**: the model repeats previous state with minor adjectives.
- **post-hoc rationalization**: the reflection and the update become a tidy narrative, even when the image might “break” coherence.
- **generic phenomenology**: “quiet tension,” “subtle unease,” “held ambiguity” as safe defaults, especially given the “avoid description” constraint.

### Constraint interactions and internal tensions (important)

There are a few “crossed wires” between goals that are worth naming explicitly because they affect both output quality and interpretability:

- **No literal description vs image-responsiveness**: If the model is strongly discouraged from describing what it sees, it has fewer “anchors,” and may fall back to generic mood language. This increases the risk that state evolution is driven more by internal textual momentum than by the image.
- **“Avoid art jargon or critique” vs style language**: Derived styles can naturally drift into critique-like vocabulary (“composition,” “rhythm,” “constraint”). That can directly conflict with the reflection prompt’s avoidance list, producing inconsistent constraint enforcement across runs and providers.
- **“Don’t interpret artist intent” vs reception**: Reception theory doesn’t require intent-guessing, but many viewers *do* narrate intent as part of meaning-making. Banning it may simplify outputs (good for control) while also narrowing what “reception” can look like (aesthetic cost).

### The vision safety instruction is also a modelling choice

The vision system instruction (“Never identify, name, or describe people”) is doing more than safety:

- It becomes a **curatorial rule** about what kind of looking is allowed.
- It can be especially constraining for portraiture or figure-based work, where “what is present” is often inseparable from affect.

Research implication: if outputs become more generic under this constraint, it may mask differences between stateful vs stateless or between profiles, because the model is prevented from using salient visual specifics as a driver.

Artistic implication: the viewer is pushed toward atmosphere and abstraction, which may be exactly the intended aesthetic—but it should be treated as part of the authored work, not a neutral compliance detail.

### “Did you try other prompts?” and “how to assess a prompt is good?”

In-repo, the prompt docs show one canonical prompt per function; they don’t document prompt iteration history or comparative evaluation.

For research credibility, you don’t need infinite prompt search, but you do need:

- a *versioned* prompt set (v1, v2, …),
- a few explicit alternatives (even if rejected),
- and an evaluation protocol tied to your thesis hypotheses.

### What is a “good reflection” if it’s not measurable?

You can’t measure “a good reflection” in the abstract, but you can measure properties that your project already claims to value:

- **Cross-image coherence**: does it feel like one evolving viewer?
- **Order sensitivity**: do permutations yield meaningful differences?
- **Profile sensitivity**: does the same sequence diverge under different profiles?
- **Non-degeneracy**: does language avoid flattening into templates across steps?
- **Constraint adherence**: does it avoid literal description while still being image-responsive?
- **Disruption handling**: can the system register rupture without collapsing into incoherence or clichés?

These can be evaluated with blind human comparisons (as your research docs already propose) plus some lightweight automatic signals.

### Concrete prompt tweaks to consider (not as “better,” but as testable variants)

- **Delta-state requirement**: ask the model to explicitly state what changed (e.g. “energy decreased; openness increased”), in prose or in a tiny structured line, to reduce “everything shifts a bit” drift.
- **Compression budget**: enforce a hard length limit for `[STATE]` to keep it as a state, not a second reflection.
- **Occasional reset permission**: allow the model to declare “no meaningful change” to avoid forced evolution.
- **Two-stage generation** (even within one model call): have it write `[STATE]` first (from previous state + image), then `[REFLECTION]` shaped by that updated state, to avoid retrofitting.

The point is not to perfect prompting; it’s to turn prompt choices into ablatable variables.

---

## 7) Critique of the internal state dimensions (and the “qualitative state” choice)

### Are the state dimensions “right”?

They are plausible and readable. They also resemble a “minimal mood model” that tends to work well with LLMs.

But they may be underspecified relative to your conceptual aims (“attention, memory, affect, carryover”):

- Only one axis is explicitly attentional (and it’s not in the state; it’s in the profile).
- “Memory” is implemented as passing forward state text, not represented as a dimension.

If you want state to carry more than mood drift, consider experimenting with additions like:

- **attentional breadth** (narrow ↔ wide)
- **meaning-making pressure** (need-to-resolve ↔ letting-be)
- **self-boundary permeability** (protected ↔ porous)
- **somatic intensity** (numb ↔ vivid) as a qualitative axis

### Why keep state qualitative? Advantages and disadvantages

- **Advantages**
  - avoids false precision and “scientific-looking” numbers with weak validity,
  - aligns with phenomenological description,
  - is legible to humans reading session histories,
  - is flexible across languages (EN/FR) without strict calibration.
- **Disadvantages**
  - hard to aggregate, compare, or statistically analyze without extra coding,
  - easier for models to drift into generic phrasing,
  - harder to enforce consistency across time steps and across providers,
  - invites “narrative smoothing” (everything becomes coherent even when it shouldn’t).

A productive compromise for research is **hybrid state**:

- keep qualitative prose for the artwork/UI,
- but also maintain a small structured spine (slots or ordinal bins with labels) for analysis and controllability.

---

## 8) “Why not just pass reflection history instead of evolving state?”

This is a core architectural question and a good critique.

### What an evolving state buys you (in principle)

- **Compression**: a summary of carryover rather than an ever-growing context window.
- **Explicit manipulability**: you can intervene (edit state) and test causal effects.
- **A theoretical gesture**: “experience has a shape” that is not identical to a transcript.

### What passing history buys you

- **Groundedness**: the model can reference concrete prior language rather than a distilled abstraction.
- **Reduced summary distortion**: state summaries can omit “why” and overfit to the schema.
- **Less temptation to template**: history contains richer variation than 2–4 sentences of state.

### A research-forward approach

Don’t decide philosophically—treat it as an ablation matrix (your `research/llm-course-research-avenues.md` already sketches this):

- stateless
- last-state-only (current)
- last-reflection-only
- running summary (reflection summary + state)
- full reflection history (cap at N)
- retrieval memory (selective recall of earlier moments)

Then measure human distinguishability, degeneration rates, and controllability.

---

## 9) A key modelling entanglement: profile vs initial internal state

You noticed an important issue: on the first image, there is no “current internal state” passed; the only “starting condition” is the **profile** (which includes baseline emotional state, etc.).

That means the profile is currently doing double duty:

- stable traits/posture (intended),
- plus “initial state” (implicitly).

### Should profile be split into profile + initial state?

As a research instrument: **yes, probably**, because it clarifies what is allowed to evolve.

One clean design:

- **Profile** = relatively stable stance parameters (attention style, ambiguity tolerance, control orientation, aesthetic conditioning, etc.).
- **Initial state** = the starting point *in the same schema used for evolving state* (mood/tension/energy/openness + any added axes).

This also makes trajectory analysis cleaner: you always have step 0 in the same representational space as steps 1..T.

### How to generate initial state

Options (all testable):

- derive a `STATE0` from the profile via a second prompt (“map profile → initial state schema”),
- include `[STATE0]` as an additional block during profile generation,
- hand-author a small set of initial states and assign them experimentally (stronger control).

---

## 10) Do internal states evolve as you see images in a gallery?

### The research reality

There is plenty of research suggesting that sequential exposure affects:

- attention and habituation,
- contrast/priming,
- fatigue and satiation,
- shifting interpretive frames.

But “internal state” is a modelling metaphor here. The burden is not to prove it is psychologically real in exactly your schema; it is to show that:

- the state variable produces systematic, interpretable effects,
- and those effects are not trivially emulated by superficial stylistic continuity.

### What would make the model *more informed* by research (without overclaiming)

- incorporate constructs like habituation/novelty seeking, attentional narrowing, or interpretive commitment as explicit axes,
- and test whether these axes improve controllability and reduce degeneration.

---

## 11) Epistemic status: can we “believe” outputs, or is it entertainment?

Right now, the project is strongest as:

- an **art/research prototype** that demonstrates an architecture and a felt experience.

To become credible as research, it needs (and your existing research docs already point this way):

- locked datasets and protocols,
- ablations (state vs history vs none; profile/style factorial),
- human rater studies with reliability checks,
- and clear reporting of failure modes.

Until then, the correct stance is:

- **don’t treat outputs as evidence about humans**,
- do treat outputs as evidence about what *this generative system* does under your constraints.

That’s still meaningful, but it must be framed as such.

---

## 12) Artistic critique: what the work is doing (as an artwork)

### The app positions the viewer as the medium

In many gallery-web contexts, the image is primary and the text is secondary. Here, the evolving interior monologue becomes the primary artwork:

- the photographs become catalysts,
- the “viewer” becomes the authored object.

This flips the usual hierarchy and raises a strong question: **who is the subject of the exhibition—photographs, or reception?**

### Aesthetic effects the system tends to produce

Given the constraints (“avoid literal description,” “focus on mood,” stable style, and short state updates), the system tends to create:

- **slow, atmospheric affect** (lingering, tonally coherent),
- **a sense of continuity** (“one mind walking”),
- **a smoothing of discontinuities** (rupture is possible but often narrativized),
- **an aura of seriousness** (phenomenological voice, low humor, low sociability).

This can be beautiful, but it also risks homogeneity—different profiles may still converge into a “Stateful Viewers voice.”

### The “no people description” rule reads like an aesthetic constraint

In the current system, the prohibition on identifying/naming/describing people doesn’t just reduce risk; it shapes the poetics:

- it refuses biography and social reading,
- it forces the system to produce affect without “who/what is there,”
- it can make the reflections feel like they occur *near* the image rather than *with* it.

This can intensify the sense of “manufactured interiority” (a mind that speaks without grounding), which is conceptually strong—but also increases the risk of genericness.

### The “About” framing as part of the artwork

The About text explicitly claims a “missing layer” in GenAI: interpretive posture carried forward as evolving internal state. As art, that claim functions like a manifesto:

- it invites the user to interpret the app’s outputs as *posture*, not facts;
- it primes the user to listen for continuity and accumulation;
- it also risks over-authorizing the system with academic references unless the app foregrounds its speculative status.

### What emotions does it try to create in the user of the webapp?

The project seems oriented toward:

- intimacy-without-biography (an interior voice that is not a person),
- calm attentional absorption,
- curiosity about drift (“who am I becoming as I look?”),
- mild uncanniness (a machine performing “lived experience”).

An artistic risk is that the voice can become a generalized “tasteful sensitivity,” which may reduce friction and ethical discomfort—especially important given photographic content that may carry charge.

### Audio (TTS / voice-over) as exhibition design

The text-to-speech and walk-through modes can function like an audio guide for an imaginary visitor. That is not merely a feature:

- it externalizes inner speech (private becomes public),
- it turns “state drift” into something you can *hear* as duration and pacing,
- it potentially shifts the app from “reading” to “listening,” which changes what counts as convincing or affecting.

This is an artistic lever worth treating intentionally (voice selection, rate, and whether the voice remains stable across a session).

### Questions the artwork raises (strong ones)

- If reception is simulated, is the simulation itself a new artwork?
- Does the system manufacture sincerity, or reveal sincerity as a textual effect?
- What does it mean to have “memory” without biography?
- When the viewer is generated, who is responsible for the affect produced—artist, model, or user?
- Is continuity a virtue, or a constraint that suppresses rupture (and therefore truth)?

---

## 13) Actionable recommendations (research + art), phrased as next moves

### Strengthen the research basis without losing the artwork

- **Version prompts** and document 2–3 alternative variants per stage (profile/style/reflection/state) as ablations.
- **Split profile vs initial state** so “what evolves” is structurally clear.
- **Add one experimental mode** where style is independent of profile (factorial swap), to test disentanglement.
- **Define “good reflection” operationally** via your thesis hypotheses (coherence/order/profile sensitivity + non-degeneracy), then build a small rater protocol.

### Improve inspectability and controllability

- Keep `[STATE]` short and enforce a delta-like phrasing (even in prose).
- Consider a hybrid state spine (tiny slots) for analysis, while keeping prose for the UI experience.

### Deepen the artistic side (optional directions)

- Make “rupture” a first-class aesthetic event (not just “strongly disruptive” in prompt text): design for moments where continuity breaks.
- Consider exposing the state evolution visually as part of the artwork (a trace, not a metric): a poetics of drift.
- Curate profile archetypes as an artistic palette (not only random generation): “voices” as exhibition design.

---

## Appendix: primary source pointers in this repo

- Conceptual framing + references: `README.md`, `src/content/about.ts`
- Prompting surface: `src/prompts.ts`
- Research program scaffolding: `research/llm-course-research-avenues.md`, `research/thesis-defense-plan.md`

