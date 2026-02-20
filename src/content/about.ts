import type { UiLocale } from "../i18n";

type AboutSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: { term: string; description?: string; refs?: string }[];
  note?: string;
};

export type AboutContent = {
  title: string;
  overview: AboutSection;
  researchPositioning: AboutSection;
  viewerProfile: AboutSection;
  reflectionStyle: AboutSection;
  initialState: AboutSection;
  statefulReflections: AboutSection;
  summarizeTrajectory: AboutSection;
  modelsAndFeatures: AboutSection;
  images: {
    heading: string;
    paragraphs: {
      beforeLink: string;
      linkText: string;
      afterLink: string;
    }[];
    disclaimer?: string;
  };
};

export const ABOUT_CONTENT: Record<UiLocale, AboutContent> = {
  en: {
    title: "About Stateful Viewers",
    overview: {
      heading: "Overview",
      paragraphs: [
        "Stateful Viewers is an art and research project that simulates a visitor walking through a gallery. A vision–language model reflects on images one at a time, carrying forward memory, attention, and affect so that each encounter subtly shapes how subsequent images are perceived.",
        "Rather than treating images as independent inputs, the system models viewing as a continuous, cumulative experience.",
      ],
    },
    researchPositioning: {
      heading: "Research positioning",
      paragraphs: [
        "Stateful Viewers draws on reception theory, phenomenology, and aesthetic psychology. It models a viewer's perceptual stance prior to viewing, maintains a stable expressive voice across images, and treats emotional response as something that unfolds over time.",
        "The system operationalizes qualitative theories of aesthetic experience within a structured generative framework, without reducing experience to numerical scores or fixed emotion labels.",
        "Where affective computing often asks what emotion is present, Stateful Viewers asks <em>what it is like to encounter this image, having already encountered the previous ones.</em>",
      ],
    },
    viewerProfile: {
      heading: "Viewer profile",
      paragraphs: [
        "The viewer profile describes stable perceptual and interpretive dispositions — how this person characteristically attends to, processes, and makes meaning from visual art. It addresses 7 dimensions:",
      ],
      bullets: [
        { term: "Tolerance for ambiguity", description: "comfort with uncertainty and open interpretation" },
        { term: "Attention style", description: "absorbed/dwelling ↔ scanning/restless" },
        { term: "Embodied orientation", description: "somatic ↔ cognitive" },
        { term: "Interpretive posture", description: "literal/descriptive ↔ symbolic/associative ↔ autobiographical" },
        { term: "Aesthetic conditioning", description: "naïve ↔ highly conditioned, with art background" },
        { term: "Motivational stance", description: "seeking challenge/novelty ↔ seeking comfort/familiarity" },
        { term: "Memory integration tendency", description: "integrative/accumulative ↔ discrete/reset" },
      ],
    },
    reflectionStyle: {
      heading: "Reflection style",
      paragraphs: [
        "Independent of the profile, the reflection style defines how experience is expressed in language — the texture, rhythm, and habits of inner speech. It addresses 7 dimensions:",
      ],
      bullets: [
        { term: "Lexical register", description: "plain/conversational ↔ literary/poetic" },
        { term: "Emotion explicitness", description: "implicit/suggested ↔ explicit/named" },
        { term: "Voice stability", description: "steady/composed ↔ fragmented/shifting" },
        { term: "Sensory modality emphasis", description: "visual, kinesthetic, auditory, or mixed" },
        { term: "Self-reference mode", description: "first-person intimate ↔ observational/impersonal" },
        { term: "Metaphor density", description: "spare/literal ↔ rich/figurative" },
        { term: "Pacing", description: "terse/compressed ↔ expansive/flowing" },
      ],
    },
    initialState: {
      heading: "Initial internal state",
      paragraphs: [
        "Before encountering any images, the system generates an initial internal state — a momentary snapshot of how the viewer arrives today. This uses the same 7-dimension schema that evolves throughout the visit:",
      ],
      bullets: [
        { term: "Dominant mood", description: "e.g. calm, restless, melancholic, alert, wistful" },
        { term: "Underlying tension or ease", description: "the deeper felt texture beneath the surface mood" },
        { term: "Energy and engagement", description: "depleted/fatigued ↔ energized/ready" },
        { term: "Emotional openness", description: "guarded/defended ↔ receptive/permeable" },
        { term: "Attentional focus", description: "narrow/concentrated ↔ diffuse/wandering" },
        { term: "Meaning-making pressure", description: "strong pressure to understand ↔ letting-be" },
        { term: "Somatic activation", description: "body barely present ↔ intensely present" },
      ],
    },
    statefulReflections: {
      heading: "Stateful reflections",
      paragraphs: [
        "Each reflection incorporates the viewer profile and reflection style, and evolves gradually unless an image is strongly disruptive. On the first image, the generated initial state provides the starting point; subsequent images carry forward the state from the previous reflection.",
        "State is qualitative and expressed across the same 7 dimensions as the initial state (dominant mood, tension/ease, energy, openness, focus, meaning-making pressure, somatic activation).",
      ],
    },
    summarizeTrajectory: {
      heading: "Summarize trajectory",
      paragraphs: [
        "Reflection sessions can be treated as experiential trajectories: ordered paths of internal state through a gallery. Use Summarize trajectory to get a short narrative summary of how the experience moved (e.g. gradual settling, oscillation, depletion). Analysis stays qualitative and phenomenological — no valence/arousal or sentiment scores.",
      ],
    },
    modelsAndFeatures: {
      heading: "Models & features",
      paragraphs: [
        "Vision: LLaVA-1.6 7B (Ollama), GPT-5.2 (OpenAI), Gemini 3 Pro (Google), Claude Sonnet 4.5 (Anthropic). Profile, reflection style, and initial state are generated by the chosen provider. Variability is ensured by parametric hints that pin a random subset of dimensions and let the model resolve the rest.",
        "The profile list is not filtered by LLM provider — you can load a profile generated by one provider and reflect with another. Exported data tracks the profile-generation LLM separately from the reflection LLM/VLM.",
        "Walk-through mode, auto-advance, text-to-speech, auto voice-over, reflection history.",
      ],
    },
    images: {
      heading: "Images",
      paragraphs: [
        {
          beforeLink: "Images in this app are drawn from ",
          linkText: "fredericbenard.com",
          afterLink:
            " (Film, Digital, and Current Work galleries). All images © 1990–2026 Frédéric Bénard. All rights reserved. These images are not part of the open-source repository and may not be copied, reused, or redistributed without permission.",
        },
      ],
      disclaimer:
        "Some photographs include artistic nudity and are presented in an artistic context. Viewer discretion is advised.",
    },
  },
  fr: {
    title: "À propos de Stateful Viewers",
    overview: {
      heading: "Aperçu",
      paragraphs: [
        "Stateful Viewers est un projet d'art et de recherche qui simule la visite d'une galerie. Un modèle vision-langage réfléchit aux images une à une, en portant en lui mémoire, attention et affect, de sorte que chaque rencontre façonne subtilement la perception des images suivantes.",
        "Plutôt que de traiter les images comme des entrées indépendantes, le système modélise l'expérience du regard comme un processus continu et cumulatif.",
      ],
    },
    researchPositioning: {
      heading: "Positionnement de recherche",
      paragraphs: [
        "Stateful Viewers s'appuie sur la théorie de la réception, la phénoménologie et la psychologie esthétique. Il modélise la posture perceptive du regardeur avant la rencontre avec l'image, maintient une voix expressive stable d'une image à l'autre, et considère la réponse émotionnelle comme un processus qui se déploie dans le temps.",
        "Le système opérationnalise des théories qualitatives de l'expérience esthétique dans un cadre génératif structuré, sans réduire l'expérience à des scores numériques ni à des catégories émotionnelles fixes.",
        "Là où l'informatique affective demande souvent quelle émotion est présente, Stateful Viewers s'interroge sur <em>ce que signifie faire l'expérience de cette image, après avoir déjà fait l'expérience des précédentes.</em>",
      ],
    },
    viewerProfile: {
      heading: "Profil du regardeur",
      paragraphs: [
        "Le profil décrit des dispositions perceptives et interprétatives stables — la manière dont cette personne porte habituellement attention aux images, les traite et en construit le sens. Il couvre 7 dimensions :",
      ],
      bullets: [
        { term: "Tolérance à l'ambiguïté", description: "confort avec l'incertitude et l'interprétation ouverte" },
        { term: "Style attentionnel", description: "absorbé/contemplatif ↔ balayant/fébrile" },
        { term: "Orientation incarnée", description: "somatique ↔ cognitive" },
        { term: "Posture interprétative", description: "littérale/descriptive ↔ symbolique/associative ↔ autobiographique" },
        { term: "Conditionnement esthétique", description: "naïve ↔ fortement conditionné, avec formation artistique" },
        { term: "Posture motivationnelle", description: "recherche de défi/nouveauté ↔ recherche de confort/familiarité" },
        { term: "Tendance à l'intégration mnésique", description: "intégrative/cumulative ↔ discrète/remise à zéro" },
      ],
    },
    reflectionStyle: {
      heading: "Style de réflexion",
      paragraphs: [
        "Indépendant du profil, le style de réflexion définit la manière dont l'expérience est exprimée en langage — la texture, le rythme et les habitudes du discours intérieur. Il couvre 7 dimensions :",
      ],
      bullets: [
        { term: "Registre lexical", description: "courant/conversationnel ↔ littéraire/poétique" },
        { term: "Explicitation de l'émotion", description: "implicite/suggérée ↔ explicite/nommée" },
        { term: "Stabilité de la voix", description: "stable/composée ↔ fragmentée/changeante" },
        { term: "Modalité sensorielle", description: "visuelle, kinesthésique, auditive ou mixte" },
        { term: "Mode d'autoréférence", description: "première personne intime ↔ observationnel/impersonnel" },
        { term: "Densité métaphorique", description: "sobre/littéral ↔ riche/figuré" },
        { term: "Rythme", description: "condensé/laconique ↔ ample/fluide" },
      ],
    },
    initialState: {
      heading: "État interne initial",
      paragraphs: [
        "Avant toute rencontre avec les images, le système génère un état interne initial — un instantané de l'état intérieur du regardeur au moment où il entre dans la galerie. Cet état utilise le même schéma à 7 dimensions qui évolue tout au long de la visite :",
      ],
      bullets: [
        { term: "Humeur dominante", description: "ex. : calme, agité, mélancolique, alerte, nostalgique" },
        { term: "Tension ou aisance sous-jacente", description: "la texture ressentie sous l'humeur de surface" },
        { term: "Énergie et engagement", description: "épuisé/fatigué ↔ énergisé/prêt" },
        { term: "Ouverture émotionnelle", description: "gardé/défendu ↔ réceptif/perméable" },
        { term: "Focalisation attentionnelle", description: "étroite/concentrée ↔ diffuse/errante" },
        { term: "Pression de construction de sens", description: "forte pression pour comprendre ↔ laisser-être" },
        { term: "Activation somatique", description: "corps à peine présent ↔ intensité corporelle immédiate" },
      ],
    },
    statefulReflections: {
      heading: "Réflexions avec état",
      paragraphs: [
        "Chaque réflexion intègre le profil du regardeur et le style de réflexion, et évolue graduellement, sauf lorsqu'une image provoque une rupture marquante. Pour la première image, l'état initial généré sert de point de départ ; les images suivantes prolongent l'état issu de la réflexion précédente.",
        "L'état est qualitatif et s'exprime selon les mêmes 7 dimensions que l'état initial (humeur dominante, tension/aisance, énergie, ouverture, focalisation, pression de sens, activation somatique).",
      ],
    },
    summarizeTrajectory: {
      heading: "Résumer la trajectoire",
      paragraphs: [
        "Les sessions de réflexion peuvent être considérées comme des trajectoires expérientielles : des parcours ordonnés de l'état interne à travers une galerie. La fonction « Résumer la trajectoire » permet d'obtenir un court résumé narratif de la manière dont l'expérience a évolué (par exemple : apaisement graduel, oscillation, épuisement). L'analyse reste qualitative et phénoménologique — pas de scores valence–arousal ni d'analyse de sentiment.",
      ],
    },
    modelsAndFeatures: {
      heading: "Modèles et fonctionnalités",
      paragraphs: [
        "Vision : LLaVA-1.6 7B (Ollama), GPT-5.2 (OpenAI), Gemini 3 Pro (Google), Claude Sonnet 4.5 (Anthropic). Le profil, le style de réflexion et l'état initial sont générés par le fournisseur choisi. La diversité est assurée par des indices paramétriques qui fixent un sous-ensemble aléatoire de dimensions et laissent le modèle résoudre le reste.",
        "La liste des profils n'est pas filtrée par fournisseur — vous pouvez charger un profil généré par un fournisseur et réfléchir avec un autre. Les données exportées distinguent le LLM utilisé pour la génération du profil de celui utilisé pour les réflexions.",
        "Mode parcours guidé, avancement automatique, synthèse vocale et lecture automatique, historique des réflexions.",
      ],
    },
    images: {
      heading: "Images",
      paragraphs: [
        {
          beforeLink: "Les images de cette application proviennent de ",
          linkText: "fredericbenard.com",
          afterLink:
            " (galeries Film, Numérique et Travaux récents). Toutes les images © 1990–2026 Frédéric Bénard. Tous droits réservés. Ces images ne font pas partie du dépôt open source et ne peuvent pas être copiées, réutilisées ou redistribuées sans autorisation.",
        },
      ],
      disclaimer:
        "Certaines photographies incluent de la nudité artistique et sont présentées dans un contexte artistique. Discrétion du spectateur recommandée.",
    },
  },
};
