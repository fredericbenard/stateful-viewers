# Thesis Defense Plan

**Core Thesis Claim:**  
Aesthetic experience across images is meaningfully shaped by evolving internal state, and modeling that state produces measurably different trajectories than stateless inference.

**Experimental Framing:**  
This is not a model of real human phenomenology. It is a computational operationalization of phenomenological structures (temporality, carryover, situatedness). The contribution is: (1) a system that makes these structures explicit and manipulable, and (2) evidence (via controlled experiments) that the structures produce distinct trajectory behaviors.

**What We're Studying:**  
Given a fixed generative system, does adding an explicit evolving state variable produce systematic, interpretable, and controllable differences in sequential interpretations—compared to a stateless control?

---

## 🔴 Core Thesis: Falsifiable Hypotheses

**These must be defined and operationalized before any other work.**

### H1: Stateful trajectories show greater cross-image coherence than stateless baselines.

**Falsification criteria:**
- ✅ **Proves H1:** Human raters can reliably distinguish stateful from stateless trajectories in blind comparison
- ❌ **Disproves H1:** Raters cannot distinguish them, or automated metrics show no systematic difference

**Operationalization:**
- Measure semantic drift magnitude across steps
- Measure narrative continuity (references to prior images)
- Measure self-referential carryover ("after the last piece...", "I'm still stuck on...")
- Human raters judge coherence across sequence (blind comparison)

### H2: Image order significantly alters trajectory structure under stateful modeling.

**Falsification criteria:**
- ✅ **Proves H2:** Same images in different orders produce measurably different trajectories (order-dependent patterns)
- ❌ **Disproves H2:** Order changes produce no systematic differences → state is shallow

**Operationalization:**
- Compare trajectories for same image set in Order A→B→C vs C→B→A
- Measure divergence points
- Identify priming/contrast effects, fatigue dynamics

### H3: Viewer profiles induce systematic trajectory divergence.

**Falsification criteria:**
- ✅ **Proves H3:** Different profiles produce systematically different trajectories for same images
- ❌ **Disproves H3:** Profiles produce no systematic divergence → profiles are cosmetic

**Operationalization:**
- Same images, different profiles
- Measure divergence points and convergence patterns
- Compare trajectory shapes across profiles

---

## 🎯 Minimal Experimental Core (3-Experiment Proof Package)

**For the next 4 weeks: Do nothing except this core.**

### Experiment 1: Stateless vs Stateful

**Design:**
- Fixed image sequence (locked dataset)
- Same profile
- Multiple runs (reproducibility)
- Blind rating

**Manipulation:**
- Condition A: Stateless (no memory)
- Condition B: Stateful (full internal state)

**Measures:**
- Coherence across sequence
- Referential carryover (explicit links to prior images)
- Narrative continuity
- Emotional evolution

**Success criterion:** Raters can reliably distinguish stateful from stateless trajectories. If not → fundamental rethink needed.

**Behavioral signatures to measure:**
- Carryover references: explicit linkage to prior images
- Priming/contrast effects: later interpretations shift due to earlier ones
- Fatigue/satiation dynamics: attention narrows or flattens across steps
- Commitment/consistency: system maintains a stance unless disrupted
- Reinterpretation: later images cause re-framing of earlier impressions

### Experiment 2: Order Sensitivity

**Design:**
- Same images
- Two orderings (A→B→C vs C→B→A)
- Stateful model only

**Hypothesis:** Order affects trajectory structure.

**Measures:**
- Trajectory divergence points
- Order-dependent patterns (contrast effects, priming, fatigue)
- Semantic similarity between trajectories

**Success criterion:** Order produces measurably different trajectories. If order does not matter → state is shallow.

### Experiment 3: Profile Divergence

**Design:**
- Same images
- Different profiles (2-3 distinct profiles)
- Stateful model

**Hypothesis:** Trajectories diverge meaningfully across profiles.

**Measures:**
- Divergence points
- Convergence patterns
- Trajectory shape differences

**Success criterion:** Profiles create systematic divergence. If profiles don't affect trajectories → profiles are cosmetic.

---

## 📊 Operationalized Evaluation Metrics

### Constructs to Measure

1. **Sequential coherence** (continuity across steps)
   - Human ratings: "Which trajectory shows stronger cross-image continuity?"
   - Automated: Reference density, self-referential phrases, semantic similarity between consecutive reflections

2. **Order sensitivity** (trajectory changes when order changes)
   - Human ratings: "Do these trajectories feel like different experiences?"
   - Automated: Semantic distance between Order A vs Order B trajectories

3. **Profile sensitivity** (trajectory changes when profile changes)
   - Human ratings: "Do these trajectories reflect different viewer orientations?"
   - Automated: Divergence metrics, trajectory shape comparison

4. **State interpretability** (reader can summarize evolving state)
   - Human task: Summarize the evolving state from trajectory
   - Automated: Consistency of state summaries across raters

5. **Non-reductiveness / ambiguity preservation** (doesn't collapse to one-liners)
   - Human ratings: "Which trajectory better preserves ambiguity?"
   - Automated: Sentence length, qualifier density, fragmentation patterns

### Evaluation Protocol

**Human Comparative Evaluation (Blind):**
- Show raters two trajectories for same sequence:
  - A: stateful
  - B: stateless
- Ask them to rate (Likert or forced-choice):
  - Which shows stronger cross-image continuity?
  - Which feels more like a single evolving perspective?
  - Which better preserves ambiguity?
  - Which is more internally consistent without being repetitive?

**Automated Proxies:**
- Reference density (mentions of prior images)
- Self-referential phrases ("after...", "still...", "now...")
- Semantic similarity between consecutive reflections
- Variance across reruns (stability bounds)

---

## 🔧 System Lock-Down (Before Experiments)

**Lock these before running core experiments:**

- [ ] **Lock one model** (choose: Gemini, Claude, GPT-4V, or LLaVA)
- [ ] **Lock one state structure** (full internal state, not variations)
- [ ] **Lock one gallery dataset** (fixed image sequences for all experiments)
- [ ] **Lock prompts** (no changes during experimental runs)
- [ ] **Lock parameters** (temperature, sampling, etc.)

**Rationale:** You cannot test whether state matters if you're simultaneously changing models, prompts, and architectures.

---

## ✅ Pre-Experiment Setup

### Fixed Dataset

- [ ] **Select validation image sequences**
  - Choose 2-3 fixed sequences (5-10 images each)
  - These will be used for all core experiments
  - Document selection rationale

### Reproducibility Baseline

- [ ] **Establish variance bounds**
  - Run multiple trials with same parameters
  - Measure variance in outputs
  - Document stochasticity vs. deterministic patterns
  - Establish baseline for expected variation
  - **Critical:** Do this before experiments to understand system variance

### Evaluation Protocol Design

- [ ] **Design human evaluation protocol**
  - Create blind comparison materials
  - Design rating scales/questions
  - Recruit raters (3-5 minimum)
  - Establish inter-rater reliability measures

- [ ] **Design automated metrics**
  - Implement reference density measurement
  - Implement semantic similarity measurement
  - Implement divergence metrics
  - Validate metrics against human judgments

### Documentation

- [ ] **Document current system**
  - Current prompt architecture
  - Current state structure
  - Current model and parameters
  - Create examples of current behavior

---

## 🟡 Core Experiments (Execute After Setup)

### Experiment 1: Stateless vs Stateful

- [ ] **Run stateless baseline**
  - Fixed image sequence
  - No memory/state
  - Multiple runs (5-10)
  - Document outputs

- [ ] **Run stateful condition**
  - Same image sequence
  - Same profile
  - Full internal state
  - Multiple runs (5-10)
  - Document outputs

- [ ] **Blind human evaluation**
  - Prepare comparison materials
  - Conduct blind ratings
  - Analyze inter-rater reliability
  - Document results

- [ ] **Automated analysis**
  - Calculate reference density
  - Calculate semantic similarity
  - Measure carryover effects
  - Compare metrics between conditions

- [ ] **Analysis & interpretation**
  - Can raters distinguish conditions?
  - Do automated metrics show differences?
  - Document behavioral signatures
  - **Critical decision point:** If no clear difference → fundamental rethink

### Experiment 2: Order Sensitivity

- [ ] **Run Order A→B→C**
  - Stateful model
  - Multiple runs
  - Document trajectory

- [ ] **Run Order C→B→A**
  - Same images, different order
  - Same profile
  - Multiple runs
  - Document trajectory

- [ ] **Compare trajectories**
  - Measure divergence points
  - Identify order-dependent patterns
  - Calculate semantic distance
  - Document findings

- [ ] **Analysis**
  - Does order matter?
  - What patterns emerge?
  - **Critical:** If order doesn't matter → state is shallow

### Experiment 3: Profile Divergence

- [ ] **Generate 2-3 distinct profiles**
  - Document profile characteristics
  - Ensure clear differences

- [ ] **Run same images with Profile A**
  - Stateful model
  - Multiple runs
  - Document trajectory

- [ ] **Run same images with Profile B**
  - Stateful model
  - Multiple runs
  - Document trajectory

- [ ] **Run same images with Profile C** (if using 3)
  - Stateful model
  - Multiple runs
  - Document trajectory

- [ ] **Compare trajectories**
  - Measure divergence points
  - Compare trajectory shapes
  - Document convergence patterns

- [ ] **Analysis**
  - Do profiles create systematic divergence?
  - **Critical:** If profiles don't affect trajectories → profiles are cosmetic

---

## 🟢 Post-Proof Extensions (Only After Core Validated)

**These are elegant but decorative if core experiments fail.**

### Memory Architecture Ablation

- [ ] **Compare memory structures** (only if H1 proven)
  - Test: Last reflection only
  - Test: Full updated internal state
  - Compare to stateless baseline
  - Document differences

### Trajectory Analysis Extensions

- [ ] **Transition detection** (only if core validated)
  - Identify qualitative shifts
  - Detect transitions from language change
  - Implement detection algorithm

- [ ] **Comparative overlays** (only if core validated)
  - Same gallery / different profiles
  - Same profile / different orderings
  - Visualize comparative trajectories

- [ ] **Linguistic drift analysis** (only if core validated)
  - Measure sentence length changes
  - Track fragmentation patterns
  - Analyze qualifier usage evolution

- [ ] **Trajectory typology** (only if core validated)
  - Classify trajectory shapes
  - Create taxonomy of patterns

### Model Comparison (Exploratory)

- [ ] **Test different VLMs** (exploratory, not validation)
  - Compare behavior across models
  - Document differences
  - **Note:** This is exploratory, not part of core proof

---

## 🔵 Expert Validation (Structured, Not Anecdotal)

**Do this only after core experiments show clear results.**

### Structured Expert Evaluation Protocol

- [ ] **Design blind comparison study**
  - Prepare stateful vs stateless trajectories
  - Prepare order comparison materials
  - Prepare profile comparison materials

- [ ] **Recruit domain experts**
  - Art curators
  - Phenomenologists (if available)
  - Aesthetic theorists

- [ ] **Structured questions** (not "is this meaningful?")
  - Which trajectory better captures cumulative experience? (forced choice)
  - Why? (open-ended, coded)
  - Which shows stronger temporal continuity?
  - Which preserves ambiguity better?

- [ ] **Code and analyze responses**
  - Quantitative: forced-choice results
  - Qualitative: coded open-ended responses
  - Document findings

**Critical:** Expert validation must be structured comparison, not philosophical commentary.

---

## 📚 Reference: Project Positioning

### Core Contribution (Narrowed Scope)

**Primary focus:** Computational phenomenology of aesthetic experience

**What this is:**
- Operationalizing temporality of experience (not content interpretation)
- Modeling experience as unfolding structure
- Making phenomenological structures explicit and manipulable

**What this is NOT:**
- Model of real human phenomenology (no ground truth claim)
- Affective computing (not emotion classification)
- Pure philosophy (computational operationalization)
- Art history (not content interpretation)

### Behavioral Signatures of Meaningful State

These are what we measure to validate that state matters:

1. **Carryover references:** Explicit linkage to prior images ("after the last piece...", "I'm still stuck on...")
2. **Priming/contrast effects:** Later interpretations shift due to earlier ones (order dependence)
3. **Fatigue/satiation dynamics:** Attention narrows or flattens across steps
4. **Commitment/consistency:** System maintains a stance unless disrupted
5. **Reinterpretation:** Later images cause re-framing of earlier impressions

### Scientific Output (Even Without Human Ground Truth)

- Reproducible experimental testbed for sequential interpretation
- Ablation results showing which memory structures matter
- Evidence of order effects as behavioral marker of temporality
- Validated evaluation protocol (human comparative ratings + variance bounds)
- Trajectory analysis methods that make behaviors inspectable

### Thesis-Safe Framing

**Short version:**  
"I'm not measuring human aesthetic experience; I'm measuring whether explicit state produces systematic, interpretable temporal dynamics in a sequential generative viewer, under controlled manipulations."

**Long version:**  
This project introduces a computationally stateful model of aesthetic experience that operationalizes phenomenological temporality, reception theory, and affective evolution within a recursive vision-language system. Through controlled experiments, we demonstrate that explicit evolving state produces measurably different trajectory behaviors compared to stateless baselines, validating the computational operationalization of temporal experience structures.

---

## ⚠️ Critical Warnings

### The Real Danger

You are extremely good at building conceptual architectures. The danger is you build an extraordinary cathedral and forget to test whether gravity works.

**Gravity = Does state meaningfully change trajectory structure?**

**Prove that. Everything else can wait.**

### What Success Looks Like

✅ **Success:** Core experiments show clear, measurable differences. Raters can distinguish conditions. Automated metrics align with human judgments. Order and profile effects are systematic.

❌ **Failure:** No clear differences between conditions. Raters cannot distinguish. Extensions become decorative analysis of a system that doesn't work.

### Timeline Reality Check

**Next 4 weeks:** Do nothing except core experiments. No new features. No extensions. No typologies. Prove the core.

**After core validated:** Then consider extensions, model comparisons, trajectory analysis.

**If core fails:** Fundamental rethink needed. Extensions won't save a system that doesn't demonstrate its core claim.

---

## 📋 Missing Items (Address Before Experiments)

### Literature Review

- [ ] **Review computational approaches to aesthetic experience**
- [ ] **Review phenomenological computational modeling**
- [ ] **Review stateful agent architectures**
- [ ] **Review evaluation methods for generative systems**
- [ ] **Identify gaps your work addresses**

### Research Questions (Beyond Hypotheses)

- [ ] **Define broader research questions**
  - What are you trying to prove or demonstrate?
  - What would constitute success?
  - What would constitute failure?
  - How does this contribute to the field?

### Data Collection Protocol

- [ ] **Define data collection standards**
  - How many trajectories per condition?
  - How many runs per trajectory?
  - What image sets will you use?
  - How will you document and archive runs?
  - What metadata will you capture?

### Analysis Framework

- [ ] **Develop systematic analysis approach**
  - Create templates for documenting findings
  - Establish protocols for comparing runs
  - Design visualization methods
  - Plan statistical analysis (if applicable)

---

## 🎯 Strategic Priorities

### Must Do (Thesis Core)

1. Define falsifiable hypotheses
2. Lock system (model, state structure, dataset)
3. Establish reproducibility baseline
4. Run 3-experiment proof package
5. Document clear results

### Should Do (After Core)

1. Extensions (if core validated)
2. Model comparisons (exploratory)
3. Expert validation (structured)

### Nice to Have (Post-Thesis)

1. Trajectory typology
2. Linguistic drift metrics
3. Comparative overlays
4. Multi-model comparison

**Remember:** If state vs stateless is not clearly differentiated first, extensions become decorative analysis.
