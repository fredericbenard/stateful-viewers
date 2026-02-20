# Stateful baseline v2: dimension definitions

This document defines the three dimension sets that structure the stateful gallery viewer simulation. Each set addresses a distinct concern:

- **Visitor profile** — stable dispositions the viewer brings to the gallery
- **Internal state** — the viewer's current inner condition, which evolves image-to-image
- **Reflective style** — how the inner voice speaks (purely expressive, not what is perceived)

The design addresses three issues identified in the project critique (`research/docs/design/v1-critique.md`):

1. **Profile ≠ initial state.** The v1 profile did double duty: it contained stable traits *and* "baseline emotional state" (which is really a starting condition). Now, the profile contains only stable dispositions. The initial internal state is generated separately, in the same schema used for the evolving state, giving a clean step 0.
2. **Style ≠ stance.** The v1 style dimensions ("distance from experience," "restraint/confidence") were partly stance controls in disguise—they could change what is attended to, not just how it is expressed. Now, style dimensions are purely about the texture and habits of inner speech.
3. **Richer state schema.** The v1 state had 4 dimensions (mood, tension, energy, openness). The critique noted this was "underspecified relative to conceptual aims." The v2 state adds attentional, meaning-making, and somatic dimensions.

---

## 1. Visitor profile dimensions (stable)

These describe what the viewer characteristically brings to any gallery encounter. They are habitual orientations—perceptual, interpretive, and motivational—that remain consistent throughout a visit and across visits.

| # | Dimension | Poles | What it captures |
|---|-----------|-------|------------------|
| 1 | Tolerance for ambiguity | low (needs resolution) ↔ high (sits with uncertainty) | Comfort with open interpretation and unresolved meaning |
| 2 | Attention style | absorbed / dwelling ↔ scanning / restless | Habitual attentional mode when engaging with images |
| 3 | Embodied orientation | somatic (felt sense, bodily) ↔ cognitive (naming, comparing, conceptual) | Whether perception routes through the body or through thought |
| 4 | Interpretive posture | literal / descriptive ↔ symbolic / associative ↔ autobiographical | How meaning is constructed from what is seen |
| 5 | Aesthetic conditioning | naïve (little exposure) ↔ highly conditioned (practiced with restrained / ambiguous art) | Level of art exposure and resulting expectation patterns; includes primary art background |
| 6 | Motivational stance | seeking challenge / novelty ↔ seeking comfort / familiarity | What the viewer seeks from the experience |
| 7 | Memory integration tendency | integrative / accumulative ↔ discrete / reset | Whether sequential encounters are woven together or treated as independent |

### Theoretical grounding

- **Tolerance for ambiguity**: Frenkel-Brunswik's ambiguity tolerance construct; Jakesch & Leder (2009) on optimal ambiguity in art appreciation; Berlyne (1971) on collative variables.
- **Attention style**: Locher et al. (2007) on visual interest patterns during aesthetic experience; Csikszentmihalyi on absorption and flow; relates to Leder et al. (2004) processing stages.
- **Embodied orientation**: Merleau-Ponty (1945/2012) on embodied perception; Damasio's somatic marker hypothesis; Wassiliwizky et al. (2015) on bodily aesthetic responses. The art-and-emotions literature (section 7) documents that aesthetic emotions have embodied signatures (chills, tears, postural changes).
- **Interpretive posture**: Jauss (1982) on horizon of expectations; Eco on open and closed interpretation; the critique (section 3) identified this as a "high-impact candidate" missing from v1. Directly operationalizes reception theory's central claim that the viewer's interpretive habits condition what is felt.
- **Aesthetic conditioning**: Leder et al. (2004) model of aesthetic appreciation; Chamorro-Premuzic & Furnham (2004) on art expertise and personality; section 8 of art-and-emotions doc ("art expertise changes the balance of cognitive vs affective processing").
- **Motivational stance**: Berlyne (1971) arousal theory (curiosity-driven vs hedonic motivation); Bullough (1912) on aesthetic distance; Saarikallio & Erkkilä (2007) on art as emotion regulation. The art-and-emotions doc (section 9) notes "emotion regulation goals" as a dimension not yet modeled.
- **Memory integration tendency**: Bruner on narrative cognition; McAdams on narrative identity; the critique (section 3) identified "memory style" as a high-impact missing dimension. Critical for how state carryover functions—an integrative viewer accumulates, a discrete viewer resets.

### Changes from v1

| Change | Rationale |
|--------|-----------|
| Removed "baseline emotional state" from profile | Moved to initial state; cleanly separates stable traits from starting condition (critique section 9) |
| Removed "relationship to control and boundaries" | Overlapped with ambiguity tolerance; under-justified as a distinct dimension (critique section 3) |
| Added "interpretive posture" | Directly operationalizes reception theory (Jauss); identified as missing in critique |
| Added "motivational stance" | Operationalizes why the viewer looks; grounded in arousal theory and emotion regulation lit |
| Added "memory integration tendency" | Critical for carryover mechanism; previously implicit in the architecture |
| Refined "aesthetic conditioning" | Now includes art background within the same dimension rather than as a separate optional field |

---

## 2. Internal state dimensions (evolving)

These describe the viewer's current inner condition at any point during the gallery visit. They are initialized before the first image (as an "initial state") and updated after each encounter. All are qualitative—described in prose, not scored numerically.

| # | Dimension | Poles | What it captures |
|---|-----------|-------|------------------|
| 1 | Dominant mood | (qualitative — no fixed poles) | Prevailing affective tone (e.g., calm, restless, melancholic, alert, wistful, buoyant) |
| 2 | Underlying tension or ease | tense / resistant ↔ settled / calm | Deeper felt texture beneath the surface mood |
| 3 | Energy and engagement | absorbed / energized ↔ depleted / fatigued | Attentional and emotional reserves |
| 4 | Emotional openness | guarded / defended ↔ receptive / permeable | Willingness to be affected by what comes next |
| 5 | Attentional focus | narrow / concentrated ↔ diffuse / peripheral | Where and how attention is distributed |
| 6 | Meaning-making pressure | need-to-resolve ↔ letting-be | Urgency to make sense vs. capacity to suspend meaning |
| 7 | Somatic activation | numb / quiet ↔ vivid / activated | Degree to which bodily sensation registers in the experience |

### Theoretical grounding

- **Dominant mood + underlying tension**: Retained from v1; supported by the temporal dynamics literature (Dewey, art-and-emotions section 4) and the observation that aesthetic experience involves both surface mood and deeper affective layers.
- **Energy and engagement**: Retained from v1; relates to habituation, fatigue, and the "cumulative effects" documented in the temporal dynamics research (Locher et al., 2007).
- **Emotional openness**: Retained from v1; connects to Bullough's aesthetic distance as a dynamic rather than a given, and to individual differences in emotional reactivity.
- **Attentional focus** (new): The critique (section 7) noted that "only one axis is explicitly attentional (and it's not in the state; it's in the profile)." Attention is stable as a *habit* (profile) but shifts as a *state*—a viewer who habitually dwells may become scattered under fatigue. Locher et al. (2007) document attention shifts within and across artworks.
- **Meaning-making pressure** (new): From Jakesch & Leder (2009) on ambiguity and resolution; the critique (section 7) recommended this as "meaning-making pressure (need-to-resolve ↔ letting-be)." This dimension captures the dynamic relationship between the viewer's tolerance for ambiguity (stable trait in profile) and the situational pressure to resolve meaning (state). High ambiguity tolerance in the profile does not guarantee low meaning-making pressure in the state—a challenging image may raise pressure even in a tolerant viewer.
- **Somatic activation** (new): From Merleau-Ponty; Wassiliwizky et al. (2015) on chills and bodily markers; the critique (section 7) recommended "somatic intensity (numb ↔ vivid)" as a qualitative axis. The art-and-emotions doc (section 7) documents that aesthetic emotions have embodied signatures. This dimension captures whether the body is "present" in the experience at any given moment.

### Changes from v1

| Change | Rationale |
|--------|-----------|
| Kept 4 original dimensions | Mood, tension, energy, openness worked well and are supported by literature |
| Added "attentional focus" | Attention was only in profile (stable habit), not in state (dynamic); critique section 7 |
| Added "meaning-making pressure" | Captures ambiguity dynamics as a state variable; from Jakesch & Leder; critique section 7 |
| Added "somatic activation" | Connects bodily experience to state evolution; Merleau-Ponty; critique section 7 |

### Interaction between profile and state

Several profile dimensions have corresponding state dimensions that capture the same construct at different timescales:

| Profile (stable trait) | State (dynamic) | Interaction |
|------------------------|-----------------|-------------|
| Attention style (habit) | Attentional focus (current) | A viewer who habitually dwells may become diffuse under fatigue |
| Tolerance for ambiguity (trait) | Meaning-making pressure (current) | High trait tolerance doesn't guarantee low situational pressure |
| Embodied orientation (trait) | Somatic activation (current) | A cognitively-oriented viewer may still experience vivid somatic activation from a striking image |

---

## 3. Reflective style dimensions (expressive voice)

These control how the inner voice speaks when reflecting on images. They are purely about expression—the texture, rhythm, and linguistic habits of inner speech. They do not determine what is perceived, felt, or attended to (those are governed by profile and state).

This separation addresses the critique (section 4): "the style schema is at risk of confounding voice (linguistic surface) with posture (interpretive/affective stance)."

| # | Dimension | Poles | What it controls |
|---|-----------|-------|------------------|
| 1 | Lexical register | plain / conversational ↔ literary / poetic | Vocabulary, formality, linguistic texture |
| 2 | Explicitness of emotion | implicit / suggested ↔ explicit / named | Whether feelings are stated directly or surface through indirection |
| 3 | Voice stability | steady / composed ↔ fragmented / shifting | Rhythm consistency; whether the voice holds or fractures |
| 4 | Sensory modality emphasis | visual ↔ kinesthetic ↔ auditory ↔ mixed | Dominant sensory register in language |
| 5 | Self-reference mode | first-person intimate ("I") ↔ observational / impersonal | Pronoun posture and experiential distance |
| 6 | Metaphor density | spare / literal ↔ rich / figurative | Degree of figurative translation |
| 7 | Pacing | terse / compressed ↔ expansive / flowing | Rhythm and breath of inner speech |

### Theoretical grounding

- **Lexical register**: Pure linguistic surface; the critique (section 4) recommended "lexical register (plain vs poetic)" as a style axis that has no stance implications.
- **Explicitness of emotion**: Retained from v1 but narrowed to purely expressive function. In v1, this was part of "how explicitly emotions are named," which could shade into stance. Here it strictly concerns whether the text names emotions or conveys them through other means.
- **Voice stability**: Retained from v1 ("stability of the inner voice"); already a good expressive dimension.
- **Sensory modality emphasis**: From the critique (section 4), which recommended "sensory language emphasis (visual/kinesthetic/auditory)." Controls which senses the voice foregrounds in its language, independent of what is actually perceived.
- **Self-reference mode**: From the critique (section 4), which recommended "self-reference pronoun posture ('I' vs impersonal)." Controls whether the voice speaks from inside ("I feel") or observes ("there is a feeling," "one senses").
- **Metaphor density**: From the critique (section 4), which recommended "metaphor density." Controls the figurative richness of expression without changing what is being expressed.
- **Pacing**: Controls rhythm independently of content. Terse, compressed voices produce different textual effects than expansive, flowing ones, even when responding to the same experience.

### Changes from v1

| Change | Rationale |
|--------|-----------|
| Removed "distance from experience" | Confounded voice with stance; "embodied/reflective/detached" changes what is attended to, not just how it is said (critique section 4) |
| Removed "restraint/confidence in expressing feelings" | Confounded voice with emotional posture; moved interpretive caution to profile |
| Removed "pacing and length of reflections" | Replaced with more precise "pacing" dimension; length is now an output format constraint, not a style axis |
| Added "lexical register" | Pure voice control with no stance implications |
| Added "sensory modality emphasis" | Controls which senses dominate language |
| Added "self-reference mode" | Controls pronoun posture and experiential distance in language |
| Added "metaphor density" | Controls figurative richness independently of content |
| Retained "explicitness of emotion" | Narrowed to purely expressive function |
| Retained "voice stability" | Already a good expressive dimension |

### Disentanglement test

A key property of these style dimensions: swapping styles between profiles should change *how reflections sound* without changing *what the viewer perceives or how state evolves*. If changing style also changes trajectory shape (not just surface realization), that indicates leakage—the style is doing stance work. This is a testable prediction (see Idea 9 in `research/docs/planning/llm-course-research-avenues.md`).

---

## 4. Design for factorial experiments

The three-way separation (profile × style × initial state) enables factorial experiments:

- **Profile swap**: Same style + same initial state + same image sequence, different profiles → tests whether profile dimensions produce distinguishable trajectories.
- **Style swap**: Same profile + same initial state + same image sequence, different styles → tests whether style changes only surface realization (as intended) or also changes trajectory shape (leakage).
- **Initial state swap**: Same profile + same style + same image sequence, different initial states → tests whether starting condition affects trajectory beyond the first 1–2 images.
- **Full factorial**: Profile A × Style B × State C → tests interactions and separability.

This addresses the critique's recommendation (section 5) for "at least one experimental mode where style is independent of profile."

---

## References

Berlyne, D. E. (1971). *Aesthetics and psychobiology*. Appleton-Century-Crofts.

Bruner, J. S. (1991). The narrative construction of reality. *Critical Inquiry*, 18(1), 1–21.

Bullough, E. (1912). "Psychical distance" as a factor in art and an aesthetic principle. *British Journal of Psychology*, 5(2), 87–118.

Chamorro-Premuzic, T., & Furnham, A. (2004). Art judgement: A measure related to both personality and intelligence? *Imagination, Cognition and Personality*, 24(1), 3–24.

Damasio, A. R. (1994). *Descartes' error: Emotion, reason, and the human brain*. Putnam.

Dewey, J. (2005). *Art as experience*. Perigee Books. (Original work published 1934)

Jakesch, M., & Leder, H. (2009). Finding meaning in art: Preferred levels of ambiguity in art appreciation. *Quarterly Journal of Experimental Psychology*, 62(11), 2105–2112.

Jauss, H. R. (1982). *Toward an aesthetic of reception* (T. Bahti, Trans.). University of Minnesota Press.

Leder, H., Belke, B., Oeberst, A., & Augustin, D. (2004). A model of aesthetic appreciation and aesthetic judgments. *British Journal of Psychology*, 95(4), 489–508.

Locher, P., Krupinski, E. A., Mello-Thoms, C., & Nodine, C. F. (2007). Visual interest in pictorial art during an aesthetic experience. *Spatial Vision*, 21(1–2), 55–77.

McAdams, D. P. (2001). The psychology of life stories. *Review of General Psychology*, 5(2), 100–122.

Merleau-Ponty, M. (2012). *Phenomenology of perception* (D. A. Landes, Trans.). Routledge. (Original work published 1945)

Saarikallio, S., & Erkkilä, J. (2007). The role of music in adolescents' mood regulation. *Psychology of Music*, 35(1), 88–109.

Wassiliwizky, E., Wagner, V., Jacobsen, T., & Menninghaus, W. (2015). Art-elicited chills indicate states of being moved. *Psychology of Aesthetics, Creativity, and the Arts*, 9(4), 413–427.
