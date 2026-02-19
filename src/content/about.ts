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
      bullets: [
        { term: "Viewer profile", refs: "Jauss, Merleau-Ponty, Gombrich" },
        { term: "Reflection style", refs: "Vygotsky, Bruner, Husserl" },
        { term: "Stateful reflection", refs: "Dewey, Tomkins" },
      ],
      note: "(See README for full references.)",
    },
    viewerProfile: {
      heading: "Viewer profile",
      paragraphs: [
        "Generate a unique viewer profile and reflection style before viewing. The profile is a temporary inner stance—a mode of attention and perception—not a fixed personality. It includes:",
      ],
      bullets: [
        { term: "Baseline emotional state", description: "starting affective tone" },
        {
          term: "Tolerance for ambiguity",
          description: "comfort with uncertainty and open interpretation",
        },
        {
          term: "Relationship to control and boundaries",
          description: "orientation toward structure and limits",
        },
        { term: "Attention style", description: "slow/dwelling, scanning, restless, absorbed, etc." },
        { term: "Level of embodied awareness", description: "bodily vs cognitive" },
        {
          term: "Aesthetic conditioning",
          description: "exposure to restrained, ambiguous, or non-explanatory art",
        },
        {
          term: "Primary art background",
          description:
            "optional (photography, architecture, painting, cinema, literature, design, etc.)",
        },
      ],
    },
    reflectionStyle: {
      heading: "Reflection style",
      paragraphs: ["Derived from the profile, the reflection style defines how experience is expressed:"],
      bullets: [
        { term: "Explicitness of emotions", description: "implicit ↔ explicit" },
        { term: "Stability of inner voice", description: "steady, tentative, wavering, fragmented" },
        { term: "Distance from experience", description: "embodied, reflective, detached" },
        { term: "Pacing and length", description: "rhythm and duration of reflections" },
        { term: "Restraint or confidence", description: "in articulating feelings" },
      ],
    },
    statefulReflections: {
      heading: "Stateful reflections",
      paragraphs: [
        "Each reflection incorporates the viewer profile and reflection style, carries forward accumulated internal state, and evolves gradually unless an image is strongly disruptive. State is qualitative: dominant mood, tension or ease, energy (engaged ↔ fatigued), openness (guarded ↔ receptive).",
      ],
    },
    summarizeTrajectory: {
      heading: "Summarize trajectory",
      paragraphs: [
        "Reflection sessions can be treated as experiential trajectories: ordered paths of internal state through a gallery. Use Summarize trajectory to get a short narrative summary of how the experience moved (e.g. gradual settling, oscillation, depletion). Analysis stays qualitative and phenomenological—no valence/arousal or sentiment scores.",
      ],
    },
    modelsAndFeatures: {
      heading: "Models & features",
      paragraphs: [
        "Vision: LLaVA-1.6 7B (Ollama), GPT-5.2 (OpenAI), Gemini 3 Pro (Google), Claude Sonnet 4.5 (Anthropic). Profile and reflection style are generated by your chosen provider using text-only (no image input). Walk-through mode, auto-advance, text-to-speech, auto voice-over, reflection history.",
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
        "Stateful Viewers est un projet d’art et de recherche qui simule la visite d’une galerie. Un modèle vision-langage réfléchit aux images une à une, en portant en lui mémoire, attention et affect, de sorte que chaque rencontre façonne subtilement la perception des images suivantes.",
        "Plutôt que de traiter les images comme des entrées indépendantes, le système modélise l’expérience du regard comme un processus continu et cumulatif.",
      ],
    },
    researchPositioning: {
      heading: "Positionnement de recherche",
      paragraphs: [
        "Stateful Viewers s’appuie sur la théorie de la réception, la phénoménologie et la psychologie esthétique. Il modélise la posture perceptive du regardeur avant la rencontre avec l’image, maintient une voix expressive stable d’une image à l’autre, et considère la réponse émotionnelle comme un processus qui se déploie dans le temps.",
        "Le système opérationnalise des théories qualitatives de l’expérience esthétique dans un cadre génératif structuré, sans réduire l’expérience à des scores numériques ni à des catégories émotionnelles fixes.",
        "Là où l’informatique affective demande souvent quelle émotion est présente, Stateful Viewers s’interroge sur <em>ce que signifie faire l’expérience de cette image, après avoir déjà fait l’expérience des précédentes.</em>",
      ],
      bullets: [
        { term: "Profil du regardeur", refs: "Jauss, Merleau-Ponty, Gombrich" },
        { term: "Style de réflexion", refs: "Vygotsky, Bruner, Husserl" },
        { term: "Réflexions avec état", refs: "Dewey, Tomkins" },
      ],
      note: "(Voir le README pour les références complètes.)",
    },
    viewerProfile: {
      heading: "Profil du regardeur",
      paragraphs: [
        "Avant d’entrer dans la galerie, le système génère un profil de regardeur et un style de réflexion correspondant. Le profil représente une posture intérieure temporaire plutôt qu’une personnalité fixe. Il comprend :",
      ],
      bullets: [
        {
          term: "Tonalité émotionnelle de base",
          description: "le ton affectif initial",
        },
        {
          term: "Tolérance à l’ambiguïté",
          description: "le confort avec l’incertitude et l’interprétation ouverte",
        },
        {
          term: "Rapport au contrôle et aux limites",
          description: "l’orientation vers la structure, les règles et les frontières",
        },
        {
          term: "Style attentionnel",
          description: "attention qui s’attarde, scanne, erre, s’absorbe, etc.",
        },
        {
          term: "Degré de conscience incarnée",
          description: "plutôt corporel ou plutôt cognitif",
        },
        {
          term: "Conditionnement esthétique",
          description:
            "exposition à des formes d’art retenues, ambiguës ou non-explicatives",
        },
        {
          term: "Formation artistique principale",
          description:
            "optionnel (photo, architecture, peinture, cinéma, littérature, design, etc.)",
        },
      ],
    },
    reflectionStyle: {
      heading: "Style de réflexion",
      paragraphs: [
        "Issu du profil, le style de réflexion façonne la manière dont l’expérience est exprimée, indépendamment du contenu des images.",
      ],
      bullets: [
        {
          term: "Le degré d’explicitation de l’émotion",
          description: "implicite ↔ explicite",
        },
        {
          term: "La stabilité de la voix intérieure",
          description: "stable, hésitante, vacillante, fragmentée",
        },
        {
          term: "La distance à l’expérience (immergé ↔ réflexif)",
          description: "incarné, réflexif, détaché",
        },
        {
          term: "Le rythme et la longueur des réflexions",
          description: "cadence et durée des textes",
        },
        {
          term: "La retenue ou l’assurance dans l’articulation",
          description: "manière de formuler et d’assumer le ressenti",
        },
      ],
    },
    statefulReflections: {
      heading: "Réflexions avec état",
      paragraphs: [
        "Chaque réflexion intègre le profil du regardeur et le style de réflexion, prolonge un état interne accumulé à partir des images précédentes et évolue graduellement, sauf lorsqu’une image provoque une rupture marquante.",
        "L’état interne est qualitatif plutôt que numérique, et s’exprime à travers des dimensions telles que : humeur dominante, tension ou relâchement, énergie (engagé ↔ fatigué), ouverture (réservé ↔ réceptif).",
      ],
    },
    summarizeTrajectory: {
      heading: "Résumer la trajectoire",
      paragraphs: [
        "Les sessions de réflexion peuvent être considérées comme des trajectoires expérientielles : des parcours ordonnés de l’état interne à travers une galerie. La fonction « Résumer la trajectoire » permet d’obtenir un court résumé narratif de la manière dont l’expérience a évolué (par exemple : apaisement graduel, oscillation, épuisement). L’analyse reste qualitative et phénoménologique — pas de scores valence–arousal ni d’analyse de sentiment.",
      ],
    },
    modelsAndFeatures: {
      heading: "Modèles et fonctionnalités",
      paragraphs: [
        "Vision : LLaVA-1.6 7B (Ollama), GPT-5.2 (OpenAI), Gemini 3 Pro (Google), Claude Sonnet 4.5 (Anthropic). Le profil et le style de réflexion sont générés par le fournisseur choisi à partir de texte uniquement (sans image). Mode parcours guidé, avancement automatique, synthèse vocale et lecture automatique, historique des réflexions.",
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

