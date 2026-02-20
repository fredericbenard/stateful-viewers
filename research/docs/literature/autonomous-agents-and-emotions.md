# Autonomous agents and emotions: what the research says

The literature on autonomous agents and simulated emotions spans affective computing, cognitive architectures, robotics, reinforcement learning, and—more recently—LLM-based agent systems. Despite coming from different fields and motivations, the work converges on a shared insight: **in autonomous agents, emotion is best understood as a functional internal variable that shapes perception, decision-making, learning, and communication—not as a subjective feeling.**

Below is a structured synthesis.

---

## 1) Why give autonomous agents "emotions"?

Across fields, there is strong consensus that simulated emotions are not cosmetic but serve **functional roles** in cognition and behavior:

- **Decision-making and action selection**: Emotions bias which actions are chosen, which goals are prioritized, and how trade-offs are resolved—especially under uncertainty or time pressure (Damasio's somatic marker hypothesis is often cited as inspiration, even in artificial systems).
- **Learning efficiency and exploration**: In reinforcement learning, emotion-like signals can serve as intrinsic motivation, shaping exploration strategies and reward landscapes beyond task-specific rewards (Moerland et al., 2018).
- **Communication of internal state**: In multi-agent systems and human–agent interaction, emotional expression signals intentions, needs, and engagement level—enabling coordination and social regulation (Breazeal, 2003).
- **Human-likeness, engagement, and trust**: In HCI and social robotics, emotional expressiveness increases user engagement, perceived naturalness, and willingness to interact (Brave & Nass, 2003).

The theoretical core: **emotion is part of the cognition–action loop, not a separate add-on.** Most researchers in this space explicitly argue that emotion modulates attention, memory retrieval, and planning—it is a control signal, not decoration.

### Key sources

- Damasio, A. R. (1994). *Descartes' error: Emotion, reason, and the human brain*. Putnam.
- Picard, R. W. (1997). *Affective computing*. MIT Press.
- Breazeal, C. (2003). Emotion and sociable humanoid robots. *International Journal of Human-Computer Studies*, 59(1–2), 119–155.
- Brave, S., & Nass, C. (2003). Emotion in human–computer interaction. In J. A. Jacko & A. Sears (Eds.), *The human–computer interaction handbook* (pp. 81–96). Lawrence Erlbaum.

---

## 2) How are emotions represented in agents?

The literature converges around several dominant modeling paradigms. These are not mutually exclusive—many systems combine elements from more than one.

### (A) Appraisal-based models (dominant tradition)

Grounded in psychological appraisal theories (Lazarus, Scherer, Ortony–Clore–Collins), these models have agents evaluate events against appraisal variables—goal relevance, desirability, expectedness, agency, coping potential—and derive emotional states from those evaluations.

- The **OCC model** (Ortony, Clore, & Collins, 1988) defines ~22 emotion types derived from appraisals of events, actions, and objects. It is the most widely adopted framework in agent architectures.
- **Scherer's Component Process Model** provides a more fine-grained, sequential appraisal structure that maps naturally to agent processing loops.
- Fuzzy and probabilistic extensions allow graded appraisals conditioned on personality and context.

This is the most common approach in autonomous agent architectures because it provides a principled, causally structured link between perception and emotion.

### (B) Dimensional models (valence–arousal–dominance)

Emotions are represented as continuous vectors in a low-dimensional space (typically valence, arousal, and sometimes dominance). Used widely in control systems, RL agents, and physiological modeling. Related to experimental tools like the Self-Assessment Manikin (Bradley & Lang, 1994).

- **Advantage**: Smooth, interpolatable, easy to integrate with continuous control.
- **Limitation**: Loses categorical distinctiveness (anger and fear can occupy similar valence–arousal locations).

### (C) Motivation / drive-based models

Emotions emerge from the dynamics of goal pursuit, drives, and needs—rather than from explicit appraisal rules. Inspired by frameworks like Dörner's **Psi-theory**, where drives (water, food, certainty, competence, affiliation) modulate both cognition and affect. Emotions are epiphenomena of drive satisfaction/frustration dynamics.

### (D) Embodied / expressive models

Emotions are modeled primarily through behavioral expression: gesture, gaze, voice prosody, gait, facial action units. Common in virtual agents, VR characters, and social robotics. The emphasis is on the communicative function of emotion rather than internal state dynamics.

- Example: The **EVA** system uses gaze direction, posture, and gait parameters to convey emotional states.
- Example: **NECA** project—conversational animated agents with personality-driven emotional dialogue.

### (E) RL-integrated emotion models

Emotional variables are embedded directly in the reinforcement learning loop: they influence reward shaping, exploration–exploitation balance, and policy updates. This is a growing area, motivated by the observation that biological emotion-like signals (curiosity, frustration, satisfaction) shape adaptive behavior in ways that pure reward maximization does not capture.

### (F) LLM-based emotional agents (emerging area)

With the rise of large language models as agent cores, a new strand of work explores how LLMs can simulate or integrate emotional cognition:

- Current LLM agents typically lack integrated emotional state that persists across interactions and influences planning.
- Emerging frameworks propose unifying state, desire, emotion, and planning into a single agent loop (e.g., Emotional Agents, Park et al.'s generative agents with memory and reflection).
- The question of whether LLM-generated "emotional" text reflects functional internal dynamics or surface-level pattern matching remains open and contested.

### Key sources

- Ortony, A., Clore, G. L., & Collins, A. (1988). *The cognitive structure of emotions*. Cambridge University Press.
- Scherer, K. R. (2001). Appraisal considered as a process of multilevel sequential checking. In K. R. Scherer, A. Schorr, & T. Johnstone (Eds.), *Appraisal processes in emotion* (pp. 92–120). Oxford University Press.
- Dörner, D. (2003). The mathematics of emotions. In *Proceedings of the Fifth International Conference on Cognitive Modeling* (pp. 75–79).
- Bradley, M. M., & Lang, P. J. (1994). Measuring emotion: The Self-Assessment Manikin and the semantic differential. *Journal of Behavior Therapy and Experimental Psychiatry*, 25(1), 49–59.
- Moerland, T. M., Broekens, J., & Jonker, C. M. (2018). Emotion in reinforcement learning agents and robots: A survey. *Machine Learning*, 107(2), 443–480.
- Park, J. S., O'Brien, J. C., Cai, C. J., Morris, M. R., Liang, P., & Bernstein, M. S. (2023). Generative agents: Interactive simulacra of human behavior. In *Proceedings of the 36th Annual ACM Symposium on User Interface Software and Technology* (UIST '23).

---

## 3) Notable architectures and systems

Several landmark systems have shaped the field:

| System | Domain | Key contribution |
| --- | --- | --- |
| **Kismet** (MIT, Breazeal) | Social robotics | Early social robot expressing emotion through face and voice; emotion from drive-based regulation |
| **WASABI** (Becker-Asano & Wachsmuth) | Embodied conversational agents | Continuous affect simulation (PAD space) for real-time emotional agents |
| **EMA** (Marsella & Gratch) | Virtual humans | Full appraisal model (OCC + Lazarus) integrated with planning and coping |
| **Cathexis** (Velásquez) | Behavior-based agents | Multiple emotion systems (drives, somatic markers, appraisal) running in parallel |
| **NECA** | Animated conversational agents | Personality and emotional dialogue in multi-party conversations |
| **Feelix Growing** | Developmental robotics | Robots learning emotional responses over developmental interaction |
| **Generative Agents** (Park et al.) | LLM-based simulation | Memory, reflection, and planning in simulated social agents; affect is implicit in narrative |
| **EmotionBench** / **SocialAI** | LLM evaluation | Benchmarks for assessing emotional understanding and generation in LLMs |

The historical trend is from **static emotional expression** → to **dynamic, interaction-driven emotional state** → to **temporally evolving, memory-conditioned affect**.

### Key sources

- Breazeal, C. (2003). Emotion and sociable humanoid robots. *International Journal of Human-Computer Studies*, 59(1–2), 119–155.
- Becker-Asano, C., & Wachsmuth, I. (2010). Affective computing with primary and secondary emotions in a virtual human. *Autonomous Agents and Multi-Agent Systems*, 20(1), 32–49.
- Marsella, S. C., & Gratch, J. (2009). EMA: A process model of appraisal dynamics. *Cognitive Systems Research*, 10(1), 70–90.
- Velásquez, J. D. (1997). Modeling emotions and other motivations in synthetic agents. In *Proceedings of the 14th National Conference on Artificial Intelligence* (AAAI-97) (pp. 10–15).

---

## 4) What benefits have been observed?

Across domains, introducing emotion-like mechanisms into agents produces measurable effects:

### In decision-making and adaptive behavior

- Emotional agents show more robust behavior in changing or adversarial environments—emotion-like signals help break out of local optima and respond to novel situations (Moerland et al., 2018).
- In multi-agent settings, emotional signaling improves coordination and reduces conflict (de Melo et al., 2014).

### In human interaction

- Emotionally expressive agents increase user engagement, trust, and perceived social presence.
- Users form stronger rapport with agents that adapt emotional expression to context (Bickmore & Picard, 2005).
- Emotional congruence (agent's expressed emotion matching the situation) improves communication efficiency and user satisfaction.

### In learning and exploration

- Curiosity and frustration signals (as intrinsic motivation) can improve exploration efficiency in RL, reducing sample complexity in sparse-reward environments.
- Emotion-modulated memory (prioritizing emotionally salient experiences) can improve long-term performance.

### Key sources

- de Melo, C. M., Carnevale, P. J., Read, S. J., & Gratch, J. (2014). Reading people's minds from emotion expressions in interdependent decision making. *Journal of Personality and Social Psychology*, 106(1), 73–88.
- Bickmore, T. W., & Picard, R. W. (2005). Establishing and maintaining long-term human–computer relationships. *ACM Transactions on Computer-Human Interaction*, 12(2), 293–327.

---

## 5) Major open challenges

Despite decades of work, the literature consistently highlights key limitations:

### (1) Lack of deep integration with cognition

Many systems treat emotion as a module—a separate subsystem that outputs a label or vector—rather than as deeply integrated with reasoning, memory retrieval, attention, and planning. The result is that emotion often influences behavior at a coarse level (action selection) but not at the level of perception or interpretation.

### (2) Evaluation is hard

There is no agreed benchmark for evaluating whether an agent's emotional behavior is "realistic," "appropriate," or "functional." Evaluation tends to rely on user studies (subjective ratings) or task performance (indirect), with limited convergence across studies.

### (3) Ecological validity

Simulated emotions are typically calibrated to lab scenarios or scripted interactions. They often do not align with the way human emotional trajectories unfold over extended, open-ended experiences. Most systems are tested in short episodes, not in sustained temporal sequences.

### (4) Temporal continuity

Most systems still model emotions as **instant reactions**—an event triggers an appraisal, which produces an emotion, which decays. Few systems model emotion as a **trajectory**: something that accumulates, drifts, and is shaped by history across many time steps.

This is arguably the largest gap in the field. Even architectures with memory (like generative agents) tend to retrieve discrete memories rather than carrying forward a continuous affective state.

### (5) Ethical and safety concerns

Emotional agents raise important ethical questions:

- **Manipulation risk**: Agents that express emotion can influence human behavior, including in adversarial ways (persuasion, false intimacy, pressure).
- **False anthropomorphism**: Users may over-attribute sentience, suffering, or moral status to emotionally expressive agents.
- **Deceptive design**: Emotional expression without functional grounding can create misleading impressions of understanding or care.
- **Dependency**: Long-term emotional engagement with agents may create unhealthy attachment patterns.

### Key sources

- Gratch, J., & Marsella, S. (2004). A domain-independent framework for modeling emotion. *Cognitive Systems Research*, 5(4), 269–306.
- Turkle, S. (2011). *Alone together: Why we expect more from technology and less from each other*. Basic Books.
- Broekens, J., Heerink, M., & Rosendal, H. (2009). Assistive social robots in elderly care: A review. *Gerontechnology*, 8(2), 94–103.

---

## 6) The LLM-agent moment: what changes with language models

The rise of LLM-based agents introduces new dynamics that the older affective computing literature did not anticipate:

### What LLMs bring

- **Rich linguistic expressiveness**: LLMs can produce nuanced emotional language—metaphor, ambivalence, tonal shifts—without explicit emotion modules.
- **Implicit personality and stance**: Through prompting and context, LLMs can simulate diverse emotional profiles without hand-coded appraisal rules.
- **Memory and reflection**: Architectures like generative agents (Park et al., 2023) add memory retrieval and self-reflection, enabling a form of emotionally-conditioned recall.

### What LLMs still lack

- **Persistent internal state**: Most LLM agents do not carry forward a structured emotional state across interactions; each turn is conditioned by context window contents, not by a genuine evolving variable.
- **Emotion–cognition coupling**: Emotional "expression" in LLMs is typically surface-level text generation, not a signal that modulates attention, memory retrieval, or planning in the way appraisal models intend.
- **Grounding**: LLM-generated emotion is pattern-matched from training data, not derived from functional appraisal of the agent's own goals, drives, or situation.
- **Temporal dynamics**: LLMs process emotion turn-by-turn; they do not model mood drift, habituation, or cumulative affective load across extended sequences.

### Emerging directions

- **Structured emotional state in LLM agent loops**: Explicitly maintaining and updating emotional variables (mood, tension, energy) as part of the agent's working memory, then conditioning generation on that state.
- **Emotion-aware retrieval**: Using emotional salience to prioritize which memories are retrieved for context.
- **Multi-agent emotional dynamics**: Simulating how emotional contagion, empathy, and social regulation emerge in populations of LLM agents.
- **Evaluation frameworks**: Benchmarks for assessing whether LLM agents produce emotionally coherent, temporally consistent, and situationally appropriate responses.

### Key sources

- Park, J. S., O'Brien, J. C., Cai, C. J., Morris, M. R., Liang, P., & Bernstein, M. S. (2023). Generative agents: Interactive simulacra of human behavior. In *UIST '23*.
- Li, Y., et al. (2023). EmotionBench: Evaluating emotional intelligence of large language models. *arXiv preprint*.
- Wang, Z., et al. (2023). Emotional intelligence of large language models. *arXiv preprint*.

---

## 7) Theoretical tensions in the field

Several deep tensions run through the literature and remain unresolved:

### Functional vs. phenomenological framing

Most agent work treats emotion as **functional** (a control signal that improves behavior). But some researchers argue this misses the point: real emotion involves **phenomenal experience** (what it is like to feel), and simulating function without phenomenology is either insufficient or misleading.

### Expression vs. experience

An agent can express emotion (face, voice, text) without having any internal state that grounds it. Conversely, an agent can have rich internal dynamics without any expressive output. The field oscillates between these poles, and many systems conflate the two.

### Simplicity vs. ecological validity

Simple models (valence–arousal, OCC categories) are tractable and testable. But they may miss the **mixed, ambiguous, temporally extended** character of real emotional life. Richer models are harder to implement, calibrate, and evaluate.

### Autonomy vs. control

If an agent's emotional state genuinely influences its behavior, it becomes less predictable and harder to control. This creates tension between the goal of building emotionally authentic agents and the engineering requirement for reliable, safe systems.

---

## 8) One-sentence synthesis

The literature broadly agrees that:

> Simulated emotions in autonomous agents are functional internal variables that shape perception, decision-making, learning, and communication; however, current systems still struggle to model **temporally evolving, integrated affective states** that influence interpretation over time.

---

## References (consolidated)

Becker-Asano, C., & Wachsmuth, I. (2010). Affective computing with primary and secondary emotions in a virtual human. *Autonomous Agents and Multi-Agent Systems*, 20(1), 32–49.

Bickmore, T. W., & Picard, R. W. (2005). Establishing and maintaining long-term human–computer relationships. *ACM Transactions on Computer-Human Interaction*, 12(2), 293–327.

Bradley, M. M., & Lang, P. J. (1994). Measuring emotion: The Self-Assessment Manikin and the semantic differential. *Journal of Behavior Therapy and Experimental Psychiatry*, 25(1), 49–59.

Brave, S., & Nass, C. (2003). Emotion in human–computer interaction. In J. A. Jacko & A. Sears (Eds.), *The human–computer interaction handbook* (pp. 81–96). Lawrence Erlbaum.

Breazeal, C. (2003). Emotion and sociable humanoid robots. *International Journal of Human-Computer Studies*, 59(1–2), 119–155.

Broekens, J., Heerink, M., & Rosendal, H. (2009). Assistive social robots in elderly care: A review. *Gerontechnology*, 8(2), 94–103.

Damasio, A. R. (1994). *Descartes' error: Emotion, reason, and the human brain*. Putnam.

de Melo, C. M., Carnevale, P. J., Read, S. J., & Gratch, J. (2014). Reading people's minds from emotion expressions in interdependent decision making. *Journal of Personality and Social Psychology*, 106(1), 73–88.

Dörner, D. (2003). The mathematics of emotions. In *Proceedings of the Fifth International Conference on Cognitive Modeling* (pp. 75–79).

Gratch, J., & Marsella, S. (2004). A domain-independent framework for modeling emotion. *Cognitive Systems Research*, 5(4), 269–306.

Li, Y., et al. (2023). EmotionBench: Evaluating emotional intelligence of large language models. *arXiv preprint*.

Marsella, S. C., & Gratch, J. (2009). EMA: A process model of appraisal dynamics. *Cognitive Systems Research*, 10(1), 70–90.

Moerland, T. M., Broekens, J., & Jonker, C. M. (2018). Emotion in reinforcement learning agents and robots: A survey. *Machine Learning*, 107(2), 443–480.

Ortony, A., Clore, G. L., & Collins, A. (1988). *The cognitive structure of emotions*. Cambridge University Press.

Park, J. S., O'Brien, J. C., Cai, C. J., Morris, M. R., Liang, P., & Bernstein, M. S. (2023). Generative agents: Interactive simulacra of human behavior. In *UIST '23*.

Picard, R. W. (1997). *Affective computing*. MIT Press.

Scherer, K. R. (2001). Appraisal considered as a process of multilevel sequential checking. In K. R. Scherer, A. Schorr, & T. Johnstone (Eds.), *Appraisal processes in emotion* (pp. 92–120). Oxford University Press.

Turkle, S. (2011). *Alone together: Why we expect more from technology and less from each other*. Basic Books.

Velásquez, J. D. (1997). Modeling emotions and other motivations in synthetic agents. In *Proceedings of the 14th National Conference on Artificial Intelligence* (AAAI-97) (pp. 10–15).

Wang, Z., et al. (2023). Emotional intelligence of large language models. *arXiv preprint*.
