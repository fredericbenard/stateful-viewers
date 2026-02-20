## LLM Course: Research Avenues on Stateful Viewers

This document proposes research directions built on **Stateful Viewers**: a sequential vision–language “gallery visitor” that generates per-image `[REFLECTION]` text and an evolving `[STATE]` (internal state) trace, conditioned by a **viewer profile**, a **reflection style**, and optionally prior state.

The central scientific hook throughout is **comparative and falsifiable**: if you introduce an explicit evolving state (and related controls like profile/style), you should be able to observe systematic differences in sequential interpretation—especially in (1) **cross-image coherence**, (2) **order sensitivity**, and (3) **profile sensitivity**—relative to stateless or weaker-memory baselines.

### Practical constraints (important for student projects)

- **Copyright / image access**: the app’s production images are served from `fredericbenard.com` and are not in the repo. For reproducible student work, plan on either:
  - **a public-domain / permissive dataset** (e.g., museum open access, Wikimedia Commons), or
  - a **locally hosted** image set with explicit permission.
- **Provider variance**: different VLMs/LLMs will behave differently. Most “science” projects below assume you **lock** a provider + prompts + parameters per experiment.
- **Evaluation ethos**: the project frames “state” as a *computational operationalization* of temporality/carryover, not a claim about human phenomenology. Most evaluations should be **comparative** (stateful vs stateless; order A vs order B; profile A vs profile B).

---

## How to scope a project (without overfitting to a single semester)

Best fits for course/research projects:
- implementable metrics + dashboards
- careful experimental protocol + small human study (5–15 raters)
- ablations of memory/state wiring
- dataset curation + reproducible pipelines
- theory-to-computation mapping (state representations; controllability)
- causal probing via interventions (state editing)

---

## Standard template for each research idea

To keep proposals comparable, each idea below uses the same fields (in the same order):

- **Core question**: what are we trying to learn?
- **Setup / manipulations**: what stays fixed, what varies (state vs stateless, order A vs B, profile A vs B, memory condition, update rule, language, provider, etc.)?
- **Build**: what needs to be implemented (schemas, runners, metrics, UI, datasets, annotation tooling)?
- **Measure / evaluate**: what counts as evidence (human judgments, automatic proxies, variance bounds, controllability metrics)?
- **Artifacts**: what you produce at the end (dataset, benchmark, code, paper/report, demo, rubric).

---

## Research ideas (single list)

Each idea appears once and uses the standard template. Some prior items were merged where they were “the same project with different names.”

### Idea 1 — Benchmark dataset + protocol pack

- **Core question**: What is a reproducible benchmark (images + sequences + metadata) that supports state/order/profile comparisons?
- **Setup / manipulations**: fix 3–6 sequences (5–12 images each); define canonical permutations and a small profile set; lock provider/prompt versions per benchmark release.
- **Build**: curated public-domain dataset + metadata schema + experiment runner that exports trajectories in a consistent format.
- **Measure / evaluate**: inter-run variance bounds; baseline comparisons (stateful vs stateless; order A vs B; profile A vs B).
- **Artifacts**: dataset + schema + runner + a “baseline results” appendix.

### Idea 2 — Human comparative evaluation toolkit

- **Core question**: Can we build a reliable, low-friction rater protocol that detects trajectory differences (coherence, order sensitivity, profile sensitivity)?
- **Setup / manipulations**: blind paired comparisons across controlled manipulations; lock presentation format and rater instructions.
- **Build**: survey instrument (forced-choice + Likert), packaging scripts, and analysis scripts (agreement, effect sizes, QA).
- **Measure / evaluate**: rater reliability (Krippendorff’s alpha / ICC where appropriate) and sensitivity (can raters detect known manipulations?).
- **Artifacts**: protocol pack + reusable survey templates + analysis notebook.

### Idea 3 — Automated metrics for “statefulness” (coherence + signatures), validated against humans

- **Core question**: Which automatic signals best predict human judgments of cross-image continuity and “single evolving perspective”?
- **Setup / manipulations**: use a labeled set from blind human comparisons; compare stateful vs stateless (and optionally weak-memory variants); hold out sequences/providers for robustness checks.
- **Build**: feature suite over reflection + state text (reference density, self-referential markers, discourse cues, continuity measures, signature detectors) + ablation harness.
- **Measure / evaluate**: correlation with human forced-choice; robustness across providers and prompt variants; which signals most reliably discriminate stateful from stateless.
- **Artifacts**: feature library + benchmark labels + validation results table.

### Idea 4 — State schema design: dimensions + compression + inspectability

- **Core question**: What explicit state representation (and which state dimensions) best carries forward, remains inspectable, and preserves trajectory richness under constraints?
- **Setup / manipulations**: lock provider + prompts + sequences; vary state schema (free-form vs structured slots), add/remove candidate dimensions, and enforce length caps (compression).
- **Build**: schema variants + validators + converters (free → constrained; optional constrained → expanded) + state inspection tooling (diffs/visualizations/slot tracking).
- **Measure / evaluate**: interpretability tasks (can readers summarize state evolution?), signature retention (carryover/fatigue/reinterpretation), controllability, and degeneration (repetition/flattening).
- **Artifacts**: recommended state schema + tooling + evaluation report.

### Idea 5 — Memory ablation: what memory is sufficient?

- **Core question**: Which memory structures are sufficient to produce interpretable, controllable temporal dynamics?
- **Setup / manipulations**: lock provider + prompts + sequences; compare memory conditions: stateless, last-state-only, last-reflection-only, running summary, full structured state, retrieval-based memory.
- **Build**: pluggable memory modules + a runner that generates comparable trajectories across conditions.
- **Measure / evaluate**: human distinguishability and/or proxy deltas; stability vs verbosity vs repetition trade-offs.
- **Artifacts**: ablation matrix + recommended “minimal sufficient” memory.

### Idea 6 — Memory dynamics: update rules + state editing (causal probing)

- **Core question**: How do update rules (reinforcement/decay/contradiction logging/triggered reinterpretation) and explicit state interventions change trajectory shape?
- **Setup / manipulations**: lock provider + memory representation; vary update rules; apply a controlled intervention at step \(t\) and compare to unedited controls.
- **Build**: update-rule library + intervention catalog + instrumentation to apply edits + state-evolution visualizations.
- **Measure / evaluate**: trajectory shape (stable/volatile/cumulative/oscillatory), controllability metrics (monotonicity/reversibility/side effects), and blind human detection of intended shifts.
- **Artifacts**: update/intervention library + causal results report.

### Idea 7 — Order sensitivity + divergence-point detection

- **Core question**: Where does the trajectory fork when the same images are permuted, and what kinds of forks recur?
- **Setup / manipulations**: same images, multiple permutations; stateful runs; lock provider/prompt.
- **Build**: divergence metrics, divergence-point detector, and overlay visualizations.
- **Measure / evaluate**: synthetic controls (swap a single pair); human validation of “shift moments.”
- **Artifacts**: divergence toolkit + a catalog of fork patterns.

### Idea 8 — Profiles: schema validity + interactions with memory

- **Core question**: Which profile axes are actually useful, and how do profiles interact with memory to produce distinct trajectories?
- **Setup / manipulations**: ablate/add profile dimensions; run profile A/B/C under the same memory architecture; optionally include stateful vs stateless within each profile.
- **Build**: profile generator variants + ablation runner + tools to compare trajectory shapes and divergence patterns across profiles.
- **Measure / evaluate**: profile “fingerprints” that persist across sequences; interaction effects (profiles amplify/dampen order sensitivity or statefulness signals); adversarial check (can stateless + stronger style mimic the same effect?).
- **Artifacts**: recommended profile schema + comparative analysis + example trajectories.

### Idea 9 — Expression controls: style taxonomy + reflection dimensions + disentanglement

- **Core question**: Which expression controls (style + reflection dimensions) are necessary/sufficient, and are stance (profile) and expression (style) separable in practice?
- **Setup / manipulations**: define a style taxonomy; factorial swaps (profile × style) on fixed sequences; vary reflection constraints (dimension emphasis); lock memory architecture.
- **Build**: style library + prompt variants + stance-vs-wording separation metrics + coding/annotation rubric for reflection “mode.”
- **Measure / evaluate**: invariants to preserve (trajectory shape) vs variables allowed to change (surface realization); leakage tests (does style change stance?).
- **Artifacts**: taxonomy + rubric + swap experiment results.

### Idea 10 — Provider comparison as a scientific study (not a demo)

- **Core question**: Which trajectory behaviors are provider-invariant vs provider-specific?
- **Setup / manipulations**: run the same benchmark suite across 2–4 providers with matched prompts/parameters as closely as possible.
- **Build**: provider-runner harness + taxonomy of failure modes (state ignored, state copied, drift into description, ambiguity collapse).
- **Measure / evaluate**: cross-provider agreement on detected manipulations (state/order/profile effects) and failure-mode rates.
- **Artifacts**: provider comparison report + failure-mode catalog.

### Idea 11 — Output modality effects: EN/FR + TTS

- **Core question**: Does language (EN/FR) and delivery channel (text vs TTS) change the perceived trajectory shape?
- **Setup / manipulations**: matched EN and FR runs for the same sequences/profiles; A/B present identical trajectories as text vs TTS; vary trajectory length (5 vs 10 images).
- **Build**: cross-lingual alignment method (translation/embeddings/bilingual raters) + playback protocol + measurement instrument.
- **Measure / evaluate**: bilingual forced-choice (“same trajectory?”), rater differences/effect sizes, and robustness across providers with different language strengths.
- **Artifacts**: aligned EN/FR set + modality study report.

### Idea 12 — Personalization + steering: resonance as signal, without degeneration

- **Core question**: Can personalized profiles produce reflections that reliably fit a specific user, and can user feedback steer trajectories without collapsing ambiguity or distinctive stance?
- **Setup / manipulations**: collect minimal user signals; compare personalized vs generic profiles; feedback vs no-feedback runs; test generalization across galleries/sessions.
- **Build**: profile elicitation flow + resonance survey protocol (blind comparisons) + feedback interface + degeneration detectors (generic tone toggling, stance collapse).
- **Measure / evaluate**: user discrimination + inter-user specificity + multi-session generalization; failure-mode analysis (mirroring, flattery, tone collapse).
- **Artifacts**: elicitation prompts + resonance instrument + feedback module + user study report.

### (Optional) Idea 13 — Trajectory typology grounded in measurable signatures

- **Core question**: Can we define a stable taxonomy of trajectory shapes (settling, oscillation, depletion, delayed disruption…) that generalizes across datasets?
- **Setup / manipulations**: annotate trajectories across sequences/providers; test stability across subsets; treat as optional until Ideas 1–3 produce a reliable labeled corpus.
- **Build**: annotation guide + labeled corpus + (optional) weakly supervised classifiers; mapping between typology labels and measurable signatures.
- **Measure / evaluate**: cross-dataset/provider stability; usefulness (predicts preferences or distinguishes manipulations).
- **Artifacts**: typology guide + labeled dataset + baseline classifier/report.

---

## Suggested “starter kit” pointers in this repo

These are good entry points for students to build on existing structure and saved artifacts:

- **Trajectory representation**: `src/lib/trajectory.ts` (trajectory types and `trajectoryFromSession()`)
- **Existing analysis hook**: `src/lib/analyzeTrajectory.ts` (narrative summary; extensible)
- **Reflection parsing**: `src/lib/parseReflection.ts` (parses `[REFLECTION]` / `[STATE]`)
- **Prompting surface**: `src/prompts.ts`
- **Persistence artifacts**: `data/profiles/*.json`, `data/reflections/*.json` (gitignored; but ideal as an exchange format)

---

## Recommended course structure (optional)

- **Week 1–2**: lock dataset + provider; reproduce baseline runs; establish variance bounds
- **Week 3–5**: implement core manipulation + measurement; collect small human labels if needed
- **Week 6–8**: analysis, ablations, failure modes, and write-up
