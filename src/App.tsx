import { useState, useEffect, useRef, type ReactNode } from "react";
import { getGalleries } from "./data/galleries";
import type { Gallery, GalleryImage } from "./data/galleries";
import { reflectOnImage } from "./api/vision";
import type { VisionProvider } from "./api/vision";
import { generateText } from "./api/llm";
import {
  getStatefulPrompt,
  getViewerProfileUserPrompt,
  getReflectionStyleUserPrompt,
  getInitialStateUserPrompt,
  getProfileLabelFromProfileUserPrompt,
  getStyleLabelUserPrompt,
  getStateLabelUserPrompt,
  getShortProfileUserPrompt,
  getShortStyleUserPrompt,
  getShortStateUserPrompt,
  VIEWER_PROFILE_PROMPT,
  REFLECTION_STYLE_PROMPT,
  INITIAL_STATE_PROMPT,
  PROFILE_LABEL_PROMPT,
  SHORT_DESCRIPTION_PROMPT,
} from "./prompts";
import { parseReflection } from "./lib/parseReflection";
import { useSpeech } from "./hooks/useSpeech";
import { exportAsMarkdown, exportAsJson, downloadFile } from "./lib/exportSession";
import { saveGeneratedProfile } from "./lib/saveProfile";
import { listProfiles, loadProfile, type ProfileSummary } from "./lib/loadProfile";
import { saveGeneratedStyle } from "./lib/saveStyle";
import { listStyles, loadStyle, type StyleSummary } from "./lib/loadStyle";
import { saveGeneratedState } from "./lib/saveState";
import { listStates, loadState, type StateSummary } from "./lib/loadState";
import {
  saveReflectionSession,
  getModelLabels,
  type ReflectionSessionPayload,
} from "./lib/saveReflectionSession";
import { trajectoryFromSession } from "./lib/trajectory";
import { generateNarrativeSummary } from "./lib/analyzeTrajectory";
import { getApiKeys, setApiKeys, type ApiKeys } from "./lib/apiKeys";
import { checkApiHealth } from "./lib/apiHealth";
import { isHfSpace } from "./lib/isHfSpace";
import { t, type UiLocale } from "./i18n";
import { ABOUT_CONTENT } from "./content/about";
import "./App.css";

interface Reflection {
  imageIndex: number;
  imageId: string;
  imageUrl: string;
  content: string;
  internalState?: string;
  error?: string;
  /** When this reflection was generated (ISO). */
  generatedAt?: string;
  /** Legacy field name kept for backward compatibility (prefer `generatedAt`). */
  timestamp?: string;
  locale?: UiLocale;
}

type GenerationStatusKey =
  | "generatingProfile"
  | "generatingReflectionStyle"
  | "generatingInitialState"
  | "generatingLabel"
  | "generatingSummaries"
  | "saving";

// Helper function to truncate text at word boundaries
function truncateAtWord(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.7) {
    // Only use word boundary if it's not too close to the start
    return truncated.slice(0, lastSpace) + "…";
  }
  return truncated + "…";
}

function getSpeakableReflectionOnlyText(content: string): string {
  const parsed = parseReflection(content);
  // Prefer the extracted reflection block (never include updated internal state).
  let text = (parsed.reaction || "").trim() || content.trim();

  // Safety: if the model didn't follow the expected format, strip any obvious state section.
  text = text.replace(/^\s*\*{0,2}\[REFLECTION\]\*{0,2}\s*:?\s*/i, "");
  text = text.split(/\n?\s*\*{0,2}\[STATE\]\*{0,2}\s*:?\s*/i)[0] ?? text;
  text = text.split(/\n?\s*Internal state after this image:\s*/i)[0] ?? text;

  return text.trim();
}

function renderTextWithAnimatedEllipsis(text: string): ReactNode {
  const trimmed = text.trimEnd();
  const endsWithThreeDots = trimmed.endsWith("...");
  const endsWithEllipsisChar = trimmed.endsWith("…");

  if (!endsWithThreeDots && !endsWithEllipsisChar) return text;

  const base = endsWithThreeDots
    ? trimmed.slice(0, -3)
    : trimmed.slice(0, -1);
  const trailingWhitespace = text.slice(trimmed.length);

  return (
    <>
      {base}
      <span className="loading-dots" aria-hidden="true">
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </span>
      {trailingWhitespace}
    </>
  );
}

function renderInlineMarkup(text: string) {
  const pattern = /<(em|it|italic)>([\s\S]*?)<\/\1>|<a\s+href="([^"]+)">([\s\S]*?)<\/a>/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // <em>...</em>
    if (match[1]) {
      parts.push(<em key={`em-${match.index}`}>{match[2]}</em>);
    } else {
      // <a href="...">...</a>
      const href = match[3];
      const label = match[4];
      parts.push(
        <a key={`a-${match.index}`} href={href} target="_blank" rel="noreferrer">
          {label}
        </a>
      );
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function isAppleMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIPhoneOrIPad = /iPhone|iPad|iPod/i.test(ua);
  // iPadOS desktop-mode Safari reports as Mac; detect touch-capable Mac UA.
  const isIPadDesktopMode =
    navigator.platform === "MacIntel" &&
    typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1;
  return isIPhoneOrIPad || isIPadDesktopMode;
}

function getPreferredTtsVoice(
  availableVoices: SpeechSynthesisVoice[],
  locale: UiLocale
): string | null {
  if (availableVoices.length === 0) return null;

  const findByNameIncludes = (parts: string[]): SpeechSynthesisVoice | undefined =>
    availableVoices.find((voice) => {
      const name = voice.name.toLowerCase();
      return parts.every((part) => name.includes(part));
    });

  const findByLang = (langs: string[]): SpeechSynthesisVoice | undefined =>
    availableVoices.find((voice) =>
      langs.some((lang) => voice.lang.toLowerCase().startsWith(lang.toLowerCase()))
    );

  const isFrench = locale === "fr";

  if (isAppleMobileBrowser()) {
    // Prefer natural-sounding Apple/Siri voices on iOS/iPadOS when available.
    if (isFrench) {
      return (
        findByLang(["fr-CA"])?.lang ||
        findByLang(["fr-FR"])?.lang ||
        findByLang(["fr"])?.lang ||
        null
      );
    }
    return (
      findByNameIncludes(["siri", "female"])?.name ||
      findByNameIncludes(["samantha"])?.name ||
      findByNameIncludes(["karen"])?.name ||
      findByNameIncludes(["moira"])?.name ||
      findByLang(["en-GB"])?.lang ||
      findByLang(["en-AU"])?.lang ||
      findByLang(["en-US"])?.lang ||
      null
    );
  }

  if (isFrench) {
    return (
      // Chrome voices commonly include "Google français" / "Google français canadien"
      findByNameIncludes(["google", "français", "canadien"])?.name ||
      findByNameIncludes(["google", "français"])?.name ||
      findByLang(["fr-CA"])?.lang ||
      findByLang(["fr-FR"])?.lang ||
      findByLang(["fr"])?.lang ||
      null
    );
  }

  return (
    findByNameIncludes(["google", "uk", "english", "female"])?.name ||
    findByNameIncludes(["samantha"])?.name ||
    findByNameIncludes(["karen"])?.name ||
    findByNameIncludes(["moira"])?.name ||
    findByNameIncludes(["daniel"])?.name ||
    findByNameIncludes(["siri"])?.name ||
    findByLang(["en-GB"])?.lang ||
    findByLang(["en-US"])?.lang ||
    null
  );
}

// localStorage keys
const STORAGE_KEYS = {
  viewerProfile: "stateful-viewers:viewerProfile",
  reflectionStyle: "stateful-viewers:reflectionStyle",
  initialState: "stateful-viewers:initialState",
  profileShort: "stateful-viewers:profileShort",
  reflectionStyleShort: "stateful-viewers:reflectionStyleShort",
  initialStateShort: "stateful-viewers:initialStateShort",
  profileId: "stateful-viewers:profileId",
  styleId: "stateful-viewers:styleId",
  stateId: "stateful-viewers:stateId",
  profileLabel: "stateful-viewers:profileLabel",
  styleLabel: "stateful-viewers:styleLabel",
  stateLabel: "stateful-viewers:stateLabel",
  profileLlm: "stateful-viewers:profileLlm",
  profileLlmModelLabel: "stateful-viewers:profileLlmModelLabel",
  styleLlm: "stateful-viewers:styleLlm",
  styleLlmModelLabel: "stateful-viewers:styleLlmModelLabel",
  stateLlm: "stateful-viewers:stateLlm",
  stateLlmModelLabel: "stateful-viewers:stateLlmModelLabel",
  locale: "stateful-viewers:locale",
  selectedGalleryId: "stateful-viewers:selectedGalleryId",
  currentIndexByGallery: "stateful-viewers:currentIndexByGallery",
  reflectionsByGallery: "stateful-viewers:reflectionsByGallery",
  lastInternalStateByGallery: "stateful-viewers:lastInternalStateByGallery",
  selectedReflectionGeneratedAtByGallery: "stateful-viewers:selectedReflectionGeneratedAtByGallery",
  // Legacy key name kept for backward compatibility.
  selectedReflectionTimestampByGallery: "stateful-viewers:selectedReflectionTimestampByGallery",
  sessionStartedAtByKey: "stateful-viewers:sessionStartedAtByKey",
  visionProvider: "stateful-viewers:visionProvider",
  autoVoiceOver: "stateful-viewers:autoVoiceOver",
  ttsRate: "stateful-viewers:ttsRate",
  ttsVoice: "stateful-viewers:ttsVoice",
};

function normalizeUiLocale(value: string | null | undefined): UiLocale {
  const raw = (value ?? "").trim().toLowerCase();
  if (raw.startsWith("fr")) return "fr";
  return "en";
}

function detectBrowserLocale(): UiLocale {
  if (typeof navigator === "undefined") return "en";
  const candidate = navigator.languages?.[0] || navigator.language || "en";
  return normalizeUiLocale(candidate);
}

function App() {
  // Initialize state from localStorage on mount
  const [locale, setLocale] = useState<UiLocale>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.locale);
      if (saved) return normalizeUiLocale(saved);
    } catch (e) {
      console.warn("Failed to restore locale from localStorage:", e);
    }
    return detectBrowserLocale();
  });
  const galleries = getGalleries(locale);

  const [selectedGalleryId, setSelectedGalleryId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.selectedGalleryId);
    } catch (e) {
      console.warn("Failed to restore selectedGalleryId from localStorage:", e);
    }
    return null;
  });
  const selectedGallery: Gallery | null = selectedGalleryId
    ? galleries.find((g) => g.id === selectedGalleryId) || null
    : null;
  const [currentIndexByGallery, setCurrentIndexByGallery] = useState<
    Record<string, number>
  >(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.currentIndexByGallery);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Failed to restore currentIndexByGallery from localStorage:", e);
    }
    return {};
  });
  const [selectedReflectionGeneratedAtByGallery, setSelectedReflectionGeneratedAtByGallery] =
    useState<Record<string, string>>(() => {
      try {
        const saved =
          localStorage.getItem(STORAGE_KEYS.selectedReflectionGeneratedAtByGallery) ||
          localStorage.getItem(STORAGE_KEYS.selectedReflectionTimestampByGallery);
        if (saved) {
          return JSON.parse(saved);
        }
      } catch (e) {
        console.warn("Failed to restore selectedReflectionGeneratedAtByGallery from localStorage:", e);
      }
      return {};
    });
  const [reflectionsByGallery, setReflectionsByGallery] = useState<
    Record<string, Reflection[]>
  >(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.reflectionsByGallery);
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, Reflection[]>;
        // Backward compatibility: older saved reflections used `timestamp` instead of `generatedAt`.
        return Object.fromEntries(
          Object.entries(parsed).map(([gid, list]) => [
            gid,
            Array.isArray(list)
              ? list.map((r) => ({
                  ...r,
                  generatedAt: r.generatedAt ?? r.timestamp,
                }))
              : [],
          ])
        );
      }
    } catch (e) {
      console.warn("Failed to restore reflectionsByGallery from localStorage:", e);
    }
    return {};
  });
  const [lastInternalStateByGallery, setLastInternalStateByGallery] = useState<
    Record<string, string>
  >(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.lastInternalStateByGallery);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Failed to restore lastInternalStateByGallery from localStorage:", e);
    }
    return {};
  });
  const [isLoading, setIsLoading] = useState(false);
  const [walkThroughActive, setWalkThroughActive] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(true);
  const { speak, stop, isSpeaking, voices, unlock: unlockSpeech, refreshVoices } = useSpeech();
  const [ttsRate] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ttsRate);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 1.5) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Failed to restore ttsRate from localStorage:", e);
    }
    return 0.9;
  });
  const [ttsVoice, setTtsVoice] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ttsVoice);
      if (saved) {
        return saved;
      }
    } catch (e) {
      console.warn("Failed to restore ttsVoice from localStorage:", e);
    }
    return "";
  });
  const [autoVoiceOver, setAutoVoiceOver] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.autoVoiceOver);
      if (saved !== null) {
        return saved === "true";
      }
    } catch (e) {
      console.warn("Failed to restore autoVoiceOver from localStorage:", e);
    }
    return false;
  });
  const [speechCompleteForWalkThrough, setSpeechCompleteForWalkThrough] =
    useState(false);
  const [visionProvider, setVisionProvider] = useState<VisionProvider>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.visionProvider);
      if (saved && ["ollama", "openai", "gemini", "anthropic"].includes(saved)) {
        const provider = saved as VisionProvider;
        if (provider === "ollama" && isHfSpace()) return "openai";
        return provider;
      }
    } catch (e) {
      console.warn("Failed to restore visionProvider from localStorage:", e);
    }
    return "openai";
  });
  const [viewerProfile, setViewerProfile] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.viewerProfile) || "";
    } catch (e) {
      console.warn("Failed to restore viewerProfile from localStorage:", e);
      return "";
    }
  });
  const [reflectionStyle, setReflectionStyle] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.reflectionStyle) || "";
    } catch (e) {
      console.warn("Failed to restore reflectionStyle from localStorage:", e);
      return "";
    }
  });
  const [initialState, setInitialState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.initialState) || "";
    } catch (e) {
      console.warn("Failed to restore initialState from localStorage:", e);
      return "";
    }
  });
  const [profileShort, setProfileShort] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.profileShort) || "";
    } catch {
      return "";
    }
  });
  const [reflectionStyleShort, setReflectionStyleShort] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.reflectionStyleShort) || "";
    } catch {
      return "";
    }
  });
  const [initialStateShort, setInitialStateShort] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.initialStateShort) || "";
    } catch {
      return "";
    }
  });
  const [profileId, setProfileId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.profileId);
    } catch (e) {
      console.warn("Failed to restore profileId from localStorage:", e);
      return null;
    }
  });
  const [styleId, setStyleId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.styleId);
    } catch (e) {
      console.warn("Failed to restore styleId from localStorage:", e);
      return null;
    }
  });
  const [stateId, setStateId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.stateId);
    } catch (e) {
      console.warn("Failed to restore stateId from localStorage:", e);
      return null;
    }
  });
  const [profileLabel, setProfileLabel] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.profileLabel);
    } catch (e) {
      console.warn("Failed to restore profileLabel from localStorage:", e);
      return null;
    }
  });
  const [styleLabel, setStyleLabel] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.styleLabel);
    } catch (e) {
      console.warn("Failed to restore styleLabel from localStorage:", e);
      return null;
    }
  });
  const [stateLabel, setStateLabel] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.stateLabel);
    } catch (e) {
      console.warn("Failed to restore stateLabel from localStorage:", e);
      return null;
    }
  });
  const [profileLlm, setProfileLlm] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.profileLlm);
    } catch {
      return null;
    }
  });
  const [profileLlmModelLabel, setProfileLlmModelLabel] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.profileLlmModelLabel);
    } catch {
      return null;
    }
  });
  const [styleLlm, setStyleLlm] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.styleLlm);
    } catch {
      return null;
    }
  });
  const [styleLlmModelLabel, setStyleLlmModelLabel] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.styleLlmModelLabel);
    } catch {
      return null;
    }
  });
  const [stateLlm, setStateLlm] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.stateLlm);
    } catch {
      return null;
    }
  });
  const [stateLlmModelLabel, setStateLlmModelLabel] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.stateLlmModelLabel);
    } catch {
      return null;
    }
  });
  const [sessionStartedAtByKey, setSessionStartedAtByKey] = useState<
    Record<string, string>
  >(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.sessionStartedAtByKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Failed to restore sessionStartedAtByKey from localStorage:", e);
    }
    return {};
  });
  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
  const [isGeneratingStyle, setIsGeneratingStyle] = useState(false);
  const [isGeneratingState, setIsGeneratingState] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<GenerationStatusKey | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showApiKeysModal, setShowApiKeysModal] = useState(false);
  const [apiKeysForm, setApiKeysForm] = useState<ApiKeys>(() => getApiKeys());
  const [narrativeSummary, setNarrativeSummary] = useState<string | null>(null);
  const [narrativeSummaryLoading, setNarrativeSummaryLoading] = useState(false);
  const [narrativeSummaryError, setNarrativeSummaryError] = useState<string | null>(null);
  const [narrativeSummaryLocale, setNarrativeSummaryLocale] = useState<UiLocale | null>(null);
  const [narrativeSummaryGeneratedAt, setNarrativeSummaryGeneratedAt] = useState<string | null>(
    null
  );
  const [showTrajectorySummaryModal, setShowTrajectorySummaryModal] = useState(false);
  const [availableProfiles, setAvailableProfiles] = useState<ProfileSummary[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);
  const [availableStyles, setAvailableStyles] = useState<StyleSummary[]>([]);
  const [isLoadingStyles, setIsLoadingStyles] = useState(false);
  const [availableStates, setAvailableStates] = useState<StateSummary[]>([]);
  const [isLoadingStates, setIsLoadingStates] = useState(false);
  // We intentionally do not filter profiles/styles/states by locale: allow mixing across languages.
  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageNaturalSize, setModalImageNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [revealedSensitiveByImageKey, setRevealedSensitiveByImageKey] = useState<
    Record<string, boolean>
  >({});
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [profileShortExpanded, setProfileShortExpanded] = useState(false);
  const [styleShortExpanded, setStyleShortExpanded] = useState(false);
  const [stateShortExpanded, setStateShortExpanded] = useState(false);
  const profileTextRef = useRef<HTMLDivElement>(null);
  const styleTextRef = useRef<HTMLDivElement>(null);
  const stateTextRef = useRef<HTMLDivElement>(null);
  const [profileHasOverflow, setProfileHasOverflow] = useState(false);
  const [styleHasOverflow, setStyleHasOverflow] = useState(false);
  const [stateHasOverflow, setStateHasOverflow] = useState(false);

  const galleryId = selectedGallery?.id ?? "";
  const currentIndex = currentIndexByGallery[galleryId] ?? 0;
  const reflections = reflectionsByGallery[galleryId] ?? [];
  const lastInternalState = lastInternalStateByGallery[galleryId] ?? "";
  const isGeneratingAny = isGeneratingProfile || isGeneratingStyle || isGeneratingState;
  const isGeneratingUi = isGeneratingAny || generationStatus != null;
  // Default behavior: show artifacts matching the current UI locale.
  // UX improvement: always keep the currently selected artifact visible (pinned),
  // even if it's from the other locale, so switching UI language doesn't make
  // the selection "disappear" from the picker.
  // Back-compat: older artifacts may be missing locale → treat as English.
  const normalizeArtifactLocale = (l?: string): UiLocale =>
    (l || "en").toString().toLowerCase().startsWith("fr") ? "fr" : "en";
  const selectedProfileSummary = profileId
    ? availableProfiles.find((p) => p.id === profileId) ?? null
    : null;
  const selectedStyleSummary = styleId
    ? availableStyles.find((s) => s.id === styleId) ?? null
    : null;
  const selectedStateSummary = stateId
    ? availableStates.find((s) => s.id === stateId) ?? null
    : null;

  const visibleProfiles = availableProfiles.filter(
    (p) => normalizeArtifactLocale(p.locale) === locale
  );
  const visibleStyles = availableStyles.filter(
    (s) => normalizeArtifactLocale(s.locale) === locale
  );
  const visibleStates = availableStates.filter(
    (s) => normalizeArtifactLocale(s.locale) === locale
  );

  const sortedAvailableProfiles = (() => {
    const list =
      selectedProfileSummary && !visibleProfiles.some((p) => p.id === selectedProfileSummary.id)
        ? [selectedProfileSummary, ...visibleProfiles]
        : visibleProfiles;
    return [...list].sort((a, b) => {
      const labelA = (a.label || t(locale, "sidebar.untitledProfile")).toLocaleLowerCase();
      const labelB = (b.label || t(locale, "sidebar.untitledProfile")).toLocaleLowerCase();
      return labelA.localeCompare(labelB);
    });
  })();

  const sortedAvailableStyles = (() => {
    const list =
      selectedStyleSummary && !visibleStyles.some((s) => s.id === selectedStyleSummary.id)
        ? [selectedStyleSummary, ...visibleStyles]
        : visibleStyles;
    return [...list].sort((a, b) => {
      const aDisplay =
        a.label ||
        (a.reflectionStyleShort
          ? truncateAtWord(a.reflectionStyleShort, 72)
          : t(locale, "sidebar.untitledStyle"));
      const bDisplay =
        b.label ||
        (b.reflectionStyleShort
          ? truncateAtWord(b.reflectionStyleShort, 72)
          : t(locale, "sidebar.untitledStyle"));
      return aDisplay.toLocaleLowerCase().localeCompare(bDisplay.toLocaleLowerCase());
    });
  })();

  const sortedAvailableStates = (() => {
    const list =
      selectedStateSummary && !visibleStates.some((s) => s.id === selectedStateSummary.id)
        ? [selectedStateSummary, ...visibleStates]
        : visibleStates;
    return [...list].sort((a, b) => {
      const aDisplay =
        a.label ||
        (a.initialStateShort
          ? truncateAtWord(a.initialStateShort, 72)
          : t(locale, "sidebar.untitledState"));
      const bDisplay =
        b.label ||
        (b.initialStateShort
          ? truncateAtWord(b.initialStateShort, 72)
          : t(locale, "sidebar.untitledState"));
      return aDisplay.toLocaleLowerCase().localeCompare(bDisplay.toLocaleLowerCase());
    });
  })();
  const selectedReflectionGeneratedAt =
    selectedReflectionGeneratedAtByGallery[galleryId];

  const currentImage: GalleryImage | null = selectedGallery
    ? selectedGallery.images[currentIndex] ?? null
    : null;
  const apiKeys = getApiKeys();
  const selectedProviderNeedsApiKey =
    visionProvider !== "ollama" &&
    ((visionProvider === "openai" && !apiKeys.openai?.trim()) ||
      (visionProvider === "gemini" && !apiKeys.google?.trim()) ||
      (visionProvider === "anthropic" && !apiKeys.anthropic?.trim()));
  const providerLabel =
    visionProvider === "openai"
      ? "OpenAI"
      : visionProvider === "gemini"
        ? "Google Gemini"
        : visionProvider === "anthropic"
          ? "Anthropic"
          : "selected";
  const onboardingHint = selectedProviderNeedsApiKey
    ? t(locale, "onboarding.nextStepAddApiKey", { provider: providerLabel })
    : isGeneratingUi
      ? t(locale, "onboarding.generatingProfile")
      : !viewerProfile?.trim()
        ? t(locale, "onboarding.nextStepGenerateOrLoadProfile")
        : !reflectionStyle?.trim()
          ? t(locale, "onboarding.nextStepGenerateOrLoadStyle")
          : !initialState?.trim()
            ? t(locale, "onboarding.nextStepGenerateOrLoadState")
            : !selectedGallery
              ? t(locale, "onboarding.nextStepSelectGallery")
              : "";

  const getImageKey = (gallery: Gallery | null, image: GalleryImage | null): string | null => {
    if (!gallery || !image) return null;
    return `${gallery.id}:${image.id}`;
  };

  const isSensitiveImage = (image: GalleryImage | null | undefined): boolean =>
    image?.sensitive?.type === "artistic_nudity";

  const isImageRevealed = (gallery: Gallery | null, image: GalleryImage | null): boolean => {
    if (!isSensitiveImage(image)) return true;
    const key = getImageKey(gallery, image);
    return key ? !!revealedSensitiveByImageKey[key] : false;
  };

  const revealImage = (
    gallery: Gallery | null,
    image: GalleryImage | null,
    revealed: boolean
  ): void => {
    const key = getImageKey(gallery, image);
    if (!key) return;
    setRevealedSensitiveByImageKey((prev) => ({ ...prev, [key]: revealed }));
  };

  // Reset modal image size when modal closes or image changes
  useEffect(() => {
    if (!showImageModal || !currentImage) setModalImageNaturalSize(null);
  }, [showImageModal, currentImage?.url]);

  // Persist locale and set document language attribute
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.locale, locale);
    } catch (e) {
      console.warn("Failed to save locale to localStorage:", e);
    }
    try {
      document.documentElement.lang = locale;
    } catch {
      // ignore
    }
  }, [locale]);

  // Close export menu when clicking outside
  useEffect(() => {
    if (!showExportMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showExportMenu]);

  // Compute modal dimensions from image aspect ratio: portrait images → tall narrow modal, landscape → wide short modal
  const imageModalStyle = (() => {
    if (
      typeof window === "undefined" ||
      !modalImageNaturalSize ||
      modalImageNaturalSize.width <= 0 ||
      modalImageNaturalSize.height <= 0
    )
      return undefined;
    const r = modalImageNaturalSize.width / modalImageNaturalSize.height;
    const rem = 16;
    const maxImageW = window.innerWidth * 0.9 - 2 * rem;
    const maxImageH =
      window.innerHeight -
      4 * rem -
      2.5 * rem -
      2 * rem -
      3 * rem;
    let imageW: number;
    let imageH: number;
    if (r >= maxImageW / maxImageH) {
      imageW = maxImageW;
      imageH = maxImageW / r;
    } else {
      imageH = maxImageH;
      imageW = maxImageH * r;
    }
    const modalW = Math.round(imageW + 2 * rem);
    const modalH = Math.round(2.5 * rem + 2 * rem + imageH + 3 * rem);
    return {
      width: modalW,
      height: modalH,
      maxWidth: "90vw",
      maxHeight: "calc(100vh - 4rem)",
    } as React.CSSProperties;
  })();

  // Persist state to localStorage whenever it changes
  useEffect(() => {
    try {
      if (viewerProfile) {
        localStorage.setItem(STORAGE_KEYS.viewerProfile, viewerProfile);
      } else {
        localStorage.removeItem(STORAGE_KEYS.viewerProfile);
      }
    } catch (e) {
      console.warn("Failed to save viewerProfile to localStorage:", e);
    }
  }, [viewerProfile]);

  useEffect(() => {
    try {
      if (reflectionStyle) {
        localStorage.setItem(STORAGE_KEYS.reflectionStyle, reflectionStyle);
      } else {
        localStorage.removeItem(STORAGE_KEYS.reflectionStyle);
      }
    } catch (e) {
      console.warn("Failed to save reflectionStyle to localStorage:", e);
    }
  }, [reflectionStyle]);

  useEffect(() => {
    try {
      if (initialState) {
        localStorage.setItem(STORAGE_KEYS.initialState, initialState);
      } else {
        localStorage.removeItem(STORAGE_KEYS.initialState);
      }
    } catch { /* ignore */ }
  }, [initialState]);

  useEffect(() => {
    try {
      if (profileShort) {
        localStorage.setItem(STORAGE_KEYS.profileShort, profileShort);
      } else {
        localStorage.removeItem(STORAGE_KEYS.profileShort);
      }
    } catch { /* ignore */ }
  }, [profileShort]);

  useEffect(() => {
    try {
      if (reflectionStyleShort) {
        localStorage.setItem(STORAGE_KEYS.reflectionStyleShort, reflectionStyleShort);
      } else {
        localStorage.removeItem(STORAGE_KEYS.reflectionStyleShort);
      }
    } catch { /* ignore */ }
  }, [reflectionStyleShort]);

  useEffect(() => {
    try {
      if (initialStateShort) {
        localStorage.setItem(STORAGE_KEYS.initialStateShort, initialStateShort);
      } else {
        localStorage.removeItem(STORAGE_KEYS.initialStateShort);
      }
    } catch { /* ignore */ }
  }, [initialStateShort]);

  useEffect(() => {
    try {
      if (profileId) {
        localStorage.setItem(STORAGE_KEYS.profileId, profileId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.profileId);
      }
    } catch (e) {
      console.warn("Failed to save profileId to localStorage:", e);
    }
  }, [profileId]);

  useEffect(() => {
    try {
      if (styleId) {
        localStorage.setItem(STORAGE_KEYS.styleId, styleId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.styleId);
      }
    } catch (e) {
      console.warn("Failed to save styleId to localStorage:", e);
    }
  }, [styleId]);

  useEffect(() => {
    try {
      if (stateId) {
        localStorage.setItem(STORAGE_KEYS.stateId, stateId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.stateId);
      }
    } catch (e) {
      console.warn("Failed to save stateId to localStorage:", e);
    }
  }, [stateId]);

  useEffect(() => {
    try {
      if (profileLabel) {
        localStorage.setItem(STORAGE_KEYS.profileLabel, profileLabel);
      } else {
        localStorage.removeItem(STORAGE_KEYS.profileLabel);
      }
    } catch (e) {
      console.warn("Failed to save profileLabel to localStorage:", e);
    }
  }, [profileLabel]);

  useEffect(() => {
    try {
      if (styleLabel) {
        localStorage.setItem(STORAGE_KEYS.styleLabel, styleLabel);
      } else {
        localStorage.removeItem(STORAGE_KEYS.styleLabel);
      }
    } catch (e) {
      console.warn("Failed to save styleLabel to localStorage:", e);
    }
  }, [styleLabel]);

  useEffect(() => {
    try {
      if (stateLabel) {
        localStorage.setItem(STORAGE_KEYS.stateLabel, stateLabel);
      } else {
        localStorage.removeItem(STORAGE_KEYS.stateLabel);
      }
    } catch (e) {
      console.warn("Failed to save stateLabel to localStorage:", e);
    }
  }, [stateLabel]);

  useEffect(() => {
    try {
      if (profileLlm) {
        localStorage.setItem(STORAGE_KEYS.profileLlm, profileLlm);
      } else {
        localStorage.removeItem(STORAGE_KEYS.profileLlm);
      }
    } catch { /* noop */ }
  }, [profileLlm]);

  useEffect(() => {
    try {
      if (profileLlmModelLabel) {
        localStorage.setItem(STORAGE_KEYS.profileLlmModelLabel, profileLlmModelLabel);
      } else {
        localStorage.removeItem(STORAGE_KEYS.profileLlmModelLabel);
      }
    } catch { /* noop */ }
  }, [profileLlmModelLabel]);

  useEffect(() => {
    try {
      if (styleLlm) {
        localStorage.setItem(STORAGE_KEYS.styleLlm, styleLlm);
      } else {
        localStorage.removeItem(STORAGE_KEYS.styleLlm);
      }
    } catch { /* noop */ }
  }, [styleLlm]);

  useEffect(() => {
    try {
      if (styleLlmModelLabel) {
        localStorage.setItem(STORAGE_KEYS.styleLlmModelLabel, styleLlmModelLabel);
      } else {
        localStorage.removeItem(STORAGE_KEYS.styleLlmModelLabel);
      }
    } catch { /* noop */ }
  }, [styleLlmModelLabel]);

  useEffect(() => {
    try {
      if (stateLlm) {
        localStorage.setItem(STORAGE_KEYS.stateLlm, stateLlm);
      } else {
        localStorage.removeItem(STORAGE_KEYS.stateLlm);
      }
    } catch { /* noop */ }
  }, [stateLlm]);

  useEffect(() => {
    try {
      if (stateLlmModelLabel) {
        localStorage.setItem(STORAGE_KEYS.stateLlmModelLabel, stateLlmModelLabel);
      } else {
        localStorage.removeItem(STORAGE_KEYS.stateLlmModelLabel);
      }
    } catch { /* noop */ }
  }, [stateLlmModelLabel]);

  useEffect(() => {
    try {
      if (selectedGalleryId) {
        localStorage.setItem(STORAGE_KEYS.selectedGalleryId, selectedGalleryId);
      } else {
        localStorage.removeItem(STORAGE_KEYS.selectedGalleryId);
      }
    } catch (e) {
      console.warn("Failed to save selectedGallery to localStorage:", e);
    }
  }, [selectedGalleryId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.currentIndexByGallery, JSON.stringify(currentIndexByGallery));
    } catch (e) {
      console.warn("Failed to save currentIndexByGallery to localStorage:", e);
    }
  }, [currentIndexByGallery]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.reflectionsByGallery, JSON.stringify(reflectionsByGallery));
    } catch (e) {
      console.warn("Failed to save reflectionsByGallery to localStorage:", e);
    }
  }, [reflectionsByGallery]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.lastInternalStateByGallery, JSON.stringify(lastInternalStateByGallery));
    } catch (e) {
      console.warn("Failed to save lastInternalStateByGallery to localStorage:", e);
    }
  }, [lastInternalStateByGallery]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.selectedReflectionGeneratedAtByGallery,
        JSON.stringify(selectedReflectionGeneratedAtByGallery)
      );
    } catch (e) {
      console.warn("Failed to save selectedReflectionGeneratedAtByGallery to localStorage:", e);
    }
  }, [selectedReflectionGeneratedAtByGallery]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.sessionStartedAtByKey, JSON.stringify(sessionStartedAtByKey));
    } catch (e) {
      console.warn("Failed to save sessionStartedAtByKey to localStorage:", e);
    }
  }, [sessionStartedAtByKey]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.visionProvider, visionProvider);
    } catch (e) {
      console.warn("Failed to save visionProvider to localStorage:", e);
    }
  }, [visionProvider]);

  useEffect(() => {
    if (isHfSpace() && visionProvider === "ollama") {
      setVisionProvider("openai");
    }
  }, [visionProvider]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.autoVoiceOver, String(autoVoiceOver));
    } catch (e) {
      console.warn("Failed to save autoVoiceOver to localStorage:", e);
    }
  }, [autoVoiceOver]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ttsRate, String(ttsRate));
    } catch (e) {
      console.warn("Failed to save ttsRate to localStorage:", e);
    }
  }, [ttsRate]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ttsVoice, ttsVoice);
    } catch (e) {
      console.warn("Failed to save ttsVoice to localStorage:", e);
    }
  }, [ttsVoice]);

  useEffect(() => {
    if (!voices.length) return;
    const localeVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(locale));
    const selectedVoice = ttsVoice
      ? voices.find((v) => v.name === ttsVoice || v.lang === ttsVoice)
      : undefined;
    const selectedVoiceStillAvailable = !ttsVoice || !!selectedVoice;
    const selectedLang = selectedVoice?.lang ?? "";
    const selectedMatchesLocale =
      !!selectedVoice && selectedLang.toLowerCase().startsWith(locale);

    // If the selected voice exists and matches the UI locale, keep it.
    if (selectedVoiceStillAvailable && selectedMatchesLocale) return;

    // If there are no voices for the current locale, don't force a change.
    if (localeVoices.length === 0) return;

    const preferredVoice = getPreferredTtsVoice(voices, locale);
    if (preferredVoice) {
      setTtsVoice(preferredVoice);
    }
  }, [voices, ttsVoice, locale]);

  // Normalize legacy `ttsVoice` values stored as language codes to a voice name
  // so they round-trip cleanly through a <select> dropdown.
  useEffect(() => {
    if (!voices.length) return;
    if (!ttsVoice) return;
    const matchedByName = voices.find((v) => v.name === ttsVoice);
    if (matchedByName) return;
    const matchedByLang = voices.find((v) => v.lang === ttsVoice);
    if (matchedByLang) {
      setTtsVoice(matchedByLang.name);
    }
  }, [voices, ttsVoice]);

  const localeVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(locale));
  const voicesForVoicePicker = localeVoices.length ? localeVoices : voices;
  const selectedVoiceForPicker = ttsVoice
    ? voicesForVoicePicker.find((v) => v.name === ttsVoice || v.lang === ttsVoice)
    : undefined;
  const voicePickerValue = selectedVoiceForPicker?.name ?? "";

  const cleanGeneratedText = (text: string): string => {
    let cleaned = text.trim();
    const originalLength = cleaned.length;
    
    // Remove common introductory phrases (be very specific to avoid removing content)
    const introPatterns = [
      /^(Here is|Here's) (the |a )?viewer profile[:\s]*\n?/i,
      /^(Here is|Here's) (the |a )?reflection style[:\s]*\n?/i,
      /^(Here is|Here's) (the |a )?derived reflection style[:\s]*\n?/i,
      /^(The|This) viewer profile (is|:)[:\s]*\n?/i,
      /^(The|This) reflection style (is|:)[:\s]*\n?/i,
      /^(The|This) profile (is|:)[:\s]*\n?/i,
      /^(The|This) style (is|:)[:\s]*\n?/i,
      /^Here's the derived[:\s]*\n?/i,
    ];
    
    for (const pattern of introPatterns) {
      cleaned = cleaned.replace(pattern, "");
    }
    
    // Safety check: if we removed more than 50 characters, something went wrong
    // This prevents removing actual content
    if (originalLength - cleaned.length > 50) {
      // If we removed too much, return original (might have been a false match)
      cleaned = text.trim();
    }
    
    // Remove markdown bold formatting (**text** becomes text)
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1");
    
    // Remove quotes if the entire text is quoted (handles both single and double quotes)
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1).trim();
    }
    // Handle escaped quotes
    if ((cleaned.startsWith('\\"') && cleaned.endsWith('\\"')) ||
        (cleaned.startsWith("\\'") && cleaned.endsWith("\\'"))) {
      cleaned = cleaned.slice(2, -2).trim();
    }
    
    // Remove leading/trailing whitespace and empty lines
    cleaned = cleaned.trim();
    
    // Final check: if result starts with lowercase or incomplete phrase, restore original
    if (cleaned.length > 0 && /^(is|are|has|have|was|were|will|would|can|could|should|may|might)\s/i.test(cleaned)) {
      // Looks like we removed too much, return original
      return text.trim();
    }
    
    return cleaned;
  };

  const normalizeLabelSentenceCase = (label: string): string => {
    const cleaned = label.trim().replace(/\s+/g, " ");
    if (!cleaned) return cleaned;
    const words = cleaned.split(" ");
    return words
      .map((word, idx) =>
        idx === 0
          ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
          : word.toLowerCase()
      )
      .join(" ");
  };

  const ensureProviderReady = async (): Promise<boolean> => {
    const keys = getApiKeys();
    const needsKey =
      (visionProvider === "openai" && !keys.openai?.trim()) ||
      (visionProvider === "gemini" && !keys.google?.trim()) ||
      (visionProvider === "anthropic" && !keys.anthropic?.trim());
    if (needsKey) {
      setGenerationError(t(locale, "errors.apiKeyRequired"));
      setShowApiKeysModal(true);
      return false;
    }
    const apiReachable = await checkApiHealth();
    if (!apiReachable) {
      setGenerationError(t(locale, "errors.serverNotResponding"));
      return false;
    }
    return true;
  };

  const resetExperienceAfterViewerChange = () => {
    setReflectionsByGallery({});
    setLastInternalStateByGallery({});
    setSelectedReflectionGeneratedAtByGallery({});
    setWalkThroughActive(false);
    setNarrativeSummary(null);
    setNarrativeSummaryError(null);
    setNarrativeSummaryLocale(null);
    setNarrativeSummaryGeneratedAt(null);
  };

  const handleGenerateProfile = async () => {
    setGenerationError(null);
    setGenerationStatus("generatingProfile");
    setIsGeneratingProfile(true);
    setViewerProfile("");
    setProfileShort("");
    setProfileId(null);
    setProfileLabel(null);
    resetExperienceAfterViewerChange();

    try {
      if (!(await ensureProviderReady())) {
        setIsGeneratingProfile(false);
        setGenerationStatus(null);
        return;
      }

      const profileResult = await generateText(
        visionProvider,
        VIEWER_PROFILE_PROMPT,
        getViewerProfileUserPrompt(locale),
        locale
      );
      if (profileResult.error) {
        setGenerationError(
          t(locale, "errors.failedGenerateProfile", { error: profileResult.error })
        );
        setIsGeneratingProfile(false);
        setGenerationStatus(null);
        return;
      }
      const cleanedProfile = cleanGeneratedText(profileResult.content);

      const labelResult = await generateText(
        visionProvider,
        PROFILE_LABEL_PROMPT,
        getProfileLabelFromProfileUserPrompt(cleanedProfile, locale),
        locale
      );
      let cleanedLabel: string | undefined;
      if (!labelResult.error && labelResult.content) {
        cleanedLabel = normalizeLabelSentenceCase(
          cleanGeneratedText(labelResult.content).trim()
        );
      }

      const shortProfileRes = await generateText(
        visionProvider,
        SHORT_DESCRIPTION_PROMPT,
        getShortProfileUserPrompt(cleanedProfile, locale),
        locale
      );
      const shortProfile = shortProfileRes.error
        ? ""
        : cleanGeneratedText(shortProfileRes.content).trim();

      const savedId = await saveGeneratedProfile({
        locale,
        profileRaw: profileResult.content,
        profileCleaned: cleanedProfile,
        profileShort: shortProfile || undefined,
        labelCleaned: cleanedLabel,
        provider: visionProvider,
      });

      const labels = getModelLabels(visionProvider);
      setViewerProfile(cleanedProfile);
      setProfileLabel(cleanedLabel || null);
      setProfileLlm(visionProvider);
      setProfileLlmModelLabel(labels.llm);
      setProfileShort(shortProfile);

      if (savedId) {
        setProfileId(savedId);
        console.info(`Profile saved to data/profiles/${savedId}.json`);
        loadProfiles();
      } else {
        setGenerationError(t(locale, "errors.failedSaveProfile"));
      }

      setGenerationStatus(null);
      setIsGeneratingProfile(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setGenerationError(t(locale, "errors.unexpectedError", { error: errorMessage }));
      setIsGeneratingProfile(false);
      setGenerationStatus(null);
    }
  };

  const handleGenerateStyle = async () => {
    setGenerationError(null);
    setGenerationStatus("generatingReflectionStyle");
    setIsGeneratingStyle(true);
    setReflectionStyle("");
    setReflectionStyleShort("");
    setStyleId(null);
    setStyleLabel(null);
    resetExperienceAfterViewerChange();

    try {
      if (!(await ensureProviderReady())) {
        setIsGeneratingStyle(false);
        setGenerationStatus(null);
        return;
      }

      const styleResult = await generateText(
        visionProvider,
        REFLECTION_STYLE_PROMPT,
        getReflectionStyleUserPrompt(locale),
        locale
      );
      if (styleResult.error) {
        setGenerationError(
          t(locale, "errors.failedGenerateReflectionStyle", { error: styleResult.error })
        );
        setIsGeneratingStyle(false);
        setGenerationStatus(null);
        return;
      }
      const cleanedStyle = cleanGeneratedText(styleResult.content);

      const labelResult = await generateText(
        visionProvider,
        PROFILE_LABEL_PROMPT,
        getStyleLabelUserPrompt(cleanedStyle, locale),
        locale
      );
      let cleanedLabel: string | undefined;
      if (!labelResult.error && labelResult.content) {
        cleanedLabel = normalizeLabelSentenceCase(
          cleanGeneratedText(labelResult.content).trim()
        );
      }

      const shortStyleRes = await generateText(
        visionProvider,
        SHORT_DESCRIPTION_PROMPT,
        getShortStyleUserPrompt(cleanedStyle, locale),
        locale
      );
      const shortStyle = shortStyleRes.error
        ? ""
        : cleanGeneratedText(shortStyleRes.content).trim();

      const savedId = await saveGeneratedStyle({
        locale,
        styleRaw: styleResult.content,
        styleCleaned: cleanedStyle,
        reflectionStyleShort: shortStyle || undefined,
        labelCleaned: cleanedLabel,
        provider: visionProvider,
      });

      const labels = getModelLabels(visionProvider);
      setReflectionStyle(cleanedStyle);
      setReflectionStyleShort(shortStyle);
      setStyleLabel(cleanedLabel || null);
      setStyleLlm(visionProvider);
      setStyleLlmModelLabel(labels.llm);

      if (savedId) {
        setStyleId(savedId);
        console.info(`Style saved to data/styles/${savedId}.json`);
        loadStyles();
      } else {
        setGenerationError(t(locale, "errors.failedSaveStyle"));
      }

      setGenerationStatus(null);
      setIsGeneratingStyle(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setGenerationError(t(locale, "errors.unexpectedError", { error: errorMessage }));
      setIsGeneratingStyle(false);
      setGenerationStatus(null);
    }
  };

  const handleGenerateState = async () => {
    setGenerationError(null);
    setGenerationStatus("generatingInitialState");
    setIsGeneratingState(true);
    setInitialState("");
    setInitialStateShort("");
    setStateId(null);
    setStateLabel(null);
    resetExperienceAfterViewerChange();

    try {
      if (!(await ensureProviderReady())) {
        setIsGeneratingState(false);
        setGenerationStatus(null);
        return;
      }

      const stateResult = await generateText(
        visionProvider,
        INITIAL_STATE_PROMPT,
        getInitialStateUserPrompt(locale),
        locale
      );
      if (stateResult.error) {
        setGenerationError(
          t(locale, "errors.failedGenerateInitialState", { error: stateResult.error })
        );
        setIsGeneratingState(false);
        setGenerationStatus(null);
        return;
      }
      const cleanedState = cleanGeneratedText(stateResult.content);

      const labelResult = await generateText(
        visionProvider,
        PROFILE_LABEL_PROMPT,
        getStateLabelUserPrompt(cleanedState, locale),
        locale
      );
      let cleanedLabel: string | undefined;
      if (!labelResult.error && labelResult.content) {
        cleanedLabel = normalizeLabelSentenceCase(
          cleanGeneratedText(labelResult.content).trim()
        );
      }

      const shortStateRes = await generateText(
        visionProvider,
        SHORT_DESCRIPTION_PROMPT,
        getShortStateUserPrompt(cleanedState, locale),
        locale
      );
      const shortState = shortStateRes.error
        ? ""
        : cleanGeneratedText(shortStateRes.content).trim();

      const savedId = await saveGeneratedState({
        locale,
        initialStateRaw: stateResult.content,
        initialStateCleaned: cleanedState,
        initialStateShort: shortState || undefined,
        labelCleaned: cleanedLabel,
        provider: visionProvider,
      });

      const labels = getModelLabels(visionProvider);
      setInitialState(cleanedState);
      setInitialStateShort(shortState);
      setStateLabel(cleanedLabel || null);
      setStateLlm(visionProvider);
      setStateLlmModelLabel(labels.llm);

      if (savedId) {
        setStateId(savedId);
        console.info(`State saved to data/states/${savedId}.json`);
        loadStates();
      } else {
        setGenerationError(t(locale, "errors.failedSaveState"));
      }

      setGenerationStatus(null);
      setIsGeneratingState(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setGenerationError(t(locale, "errors.unexpectedError", { error: errorMessage }));
      setIsGeneratingState(false);
      setGenerationStatus(null);
    }
  };

  const handleProviderChange = (provider: VisionProvider) => {
    setVisionProvider(provider);
    setReflectionsByGallery({});
    setLastInternalStateByGallery({});
    setSelectedReflectionGeneratedAtByGallery({});
    setWalkThroughActive(false);
    setGenerationError(null);
    setGenerationStatus(null);
  };

  const loadProfiles = async () => {
    setIsLoadingProfiles(true);
    try {
      const profiles = await listProfiles();
      setAvailableProfiles(profiles);
    } catch (error) {
      console.error("Failed to load profiles:", error);
      setAvailableProfiles([]);
    } finally {
      setIsLoadingProfiles(false);
    }
  };

  const loadStyles = async () => {
    setIsLoadingStyles(true);
    try {
      const styles = await listStyles();
      setAvailableStyles(styles);
    } catch (error) {
      console.error("Failed to load styles:", error);
      setAvailableStyles([]);
    } finally {
      setIsLoadingStyles(false);
    }
  };

  const loadStates = async () => {
    setIsLoadingStates(true);
    try {
      const states = await listStates();
      setAvailableStates(states);
    } catch (error) {
      console.error("Failed to load states:", error);
      setAvailableStates([]);
    } finally {
      setIsLoadingStates(false);
    }
  };

  const handleLoadProfile = async (profileId: string) => {
    setIsLoadingProfiles(true);
    try {
      const profile = await loadProfile(profileId);
      if (profile) {
        setProfileId(profile.id);
        setViewerProfile(profile.profile);
        setProfileLabel(profile.label || null);
        setProfileLlm(profile.llm || null);
        setProfileLlmModelLabel(profile.llmModelLabel || profile.modelLabel || null);
        setProfileShort(profile.profileShort || "");
        setProfileShortExpanded(false);
        resetExperienceAfterViewerChange();
        console.info(`Loaded profile ${profile.id}`);
      } else {
        console.error("Failed to load profile");
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setIsLoadingProfiles(false);
    }
  };

  const handleLoadStyle = async (id: string) => {
    setIsLoadingStyles(true);
    try {
      const style = await loadStyle(id);
      if (style) {
        setStyleId(style.id);
        setStyleLabel(style.label || null);
        setReflectionStyle(style.reflectionStyle);
        setReflectionStyleShort(style.reflectionStyleShort || "");
        setStyleLlm(style.llm || null);
        setStyleLlmModelLabel(style.llmModelLabel || style.modelLabel || null);
        setStyleShortExpanded(false);
        resetExperienceAfterViewerChange();
        console.info(`Loaded style ${style.id}`);
      } else {
        console.error("Failed to load style");
      }
    } catch (error) {
      console.error("Error loading style:", error);
    } finally {
      setIsLoadingStyles(false);
    }
  };

  const handleLoadState = async (id: string) => {
    setIsLoadingStates(true);
    try {
      const state = await loadState(id);
      if (state) {
        setStateId(state.id);
        setStateLabel(state.label || null);
        setInitialState(state.initialState);
        setInitialStateShort(state.initialStateShort || "");
        setStateLlm(state.llm || null);
        setStateLlmModelLabel(state.llmModelLabel || state.modelLabel || null);
        setStateShortExpanded(false);
        resetExperienceAfterViewerChange();
        console.info(`Loaded state ${state.id}`);
      } else {
        console.error("Failed to load state");
      }
    } catch (error) {
      console.error("Error loading state:", error);
    } finally {
      setIsLoadingStates(false);
    }
  };

  useEffect(() => {
    loadProfiles();
    loadStyles();
    loadStates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hydrate profileShort when we have profileId but profileShort is empty (e.g. page load with persisted profile)
  useEffect(() => {
    if (!profileId || profileShort?.trim()) return;
    loadProfile(profileId).then((profile) => {
      if (profile?.profileShort?.trim()) {
        setProfileShort(profile.profileShort);
      }
    });
  }, [profileId, profileShort]);

  const checkOverflow = (el: HTMLDivElement | null, setter: (v: boolean) => void) => {
    if (!el) return;
    setter(el.scrollHeight > el.clientHeight);
  };

  useEffect(() => {
    if (profileShortExpanded) return;
    const el = profileTextRef.current;
    const run = () => checkOverflow(profileTextRef.current, setProfileHasOverflow);
    run();
    const raf = requestAnimationFrame(() => run());
    const afterTransition = setTimeout(run, 250);
    if (!el) return () => { cancelAnimationFrame(raf); clearTimeout(afterTransition); };
    const ro = new ResizeObserver(run);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(afterTransition);
      ro.disconnect();
    };
  }, [profileShortExpanded, profileShort, viewerProfile]);

  useEffect(() => {
    if (styleShortExpanded) return;
    const el = styleTextRef.current;
    const run = () => checkOverflow(styleTextRef.current, setStyleHasOverflow);
    run();
    const raf = requestAnimationFrame(() => run());
    const afterTransition = setTimeout(run, 250);
    if (!el) return () => { cancelAnimationFrame(raf); clearTimeout(afterTransition); };
    const ro = new ResizeObserver(run);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(afterTransition);
      ro.disconnect();
    };
  }, [styleShortExpanded, reflectionStyleShort, reflectionStyle]);

  useEffect(() => {
    if (stateShortExpanded) return;
    const el = stateTextRef.current;
    const run = () => checkOverflow(stateTextRef.current, setStateHasOverflow);
    run();
    const raf = requestAnimationFrame(() => run());
    const afterTransition = setTimeout(run, 250);
    if (!el) return () => { cancelAnimationFrame(raf); clearTimeout(afterTransition); };
    const ro = new ResizeObserver(run);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(afterTransition);
      ro.disconnect();
    };
  }, [stateShortExpanded, initialStateShort, initialState]);

  const handleStartGallery = (galleryId: string) => {
    setSelectedGalleryId(galleryId);
    setNarrativeSummary(null);
    setNarrativeSummaryError(null);
    setNarrativeSummaryLocale(null);
    setNarrativeSummaryGeneratedAt(null);
    setCurrentIndexByGallery((prev) => ({
      ...prev,
      [galleryId]: prev[galleryId] ?? 0,
    }));
  };

  const handleReflectOnCurrent = async () => {
    if (
      !currentImage ||
      !selectedGallery ||
      !viewerProfile.trim() ||
      !reflectionStyle.trim() ||
      !initialState.trim()
    )
      return;

    const keys = getApiKeys();
    const needsKey =
      (visionProvider === "openai" && !keys.openai?.trim()) ||
      (visionProvider === "gemini" && !keys.google?.trim()) ||
      (visionProvider === "anthropic" && !keys.anthropic?.trim());
    if (needsKey) {
      setGenerationError(t(locale, "errors.apiKeyRequired"));
      setShowApiKeysModal(true);
      return;
    }

    setIsLoading(true);

    // Clear previous error for this image so retry doesn't show stale error while loading
    setReflectionsByGallery((prev) => {
      const list = prev[galleryId] ?? [];
      const forCurrent = list.filter((r) => r.imageIndex === currentIndex);
      if (forCurrent.length === 0) return prev;
      const last = forCurrent[forCurrent.length - 1];
      if (!last.error) return prev;
      const idx = list.lastIndexOf(last);
      const updated = [...list];
      updated[idx] = { ...last, error: undefined };
      return { ...prev, [galleryId]: updated };
    });

    const previousState = lastInternalState || initialState || undefined;
    const prompt = getStatefulPrompt(viewerProfile, reflectionStyle, locale);

    const result = await reflectOnImage(
      visionProvider,
      currentImage.url,
      prompt,
      previousState,
      currentImage.caption,
      locale
    );

    const parsed = result.content ? parseReflection(result.content) : null;
    const newLastState = parsed?.internalState ?? lastInternalState;

    const newReflection: Reflection = {
      imageIndex: currentIndex,
      imageId: currentImage.id,
      imageUrl: currentImage.url,
      content: result.content,
      internalState: parsed?.internalState,
      error: result.error,
      generatedAt: new Date().toISOString(),
      locale,
    };

    setReflectionsByGallery((prev) => ({
      ...prev,
      [galleryId]: [...(prev[galleryId] ?? []), newReflection],
    }));

    // Clear selected reflection when a new reflection is added (show the new one)
    setSelectedReflectionGeneratedAtByGallery((prev) => {
      const updated = { ...prev };
      delete updated[galleryId];
      return updated;
    });

    if (parsed?.internalState) {
      setLastInternalStateByGallery((prev) => ({
        ...prev,
        [galleryId]: parsed.internalState,
      }));
    }

    // Clear trajectory summary when a new reflection is added (old summary is no longer valid)
    setNarrativeSummary(null);
    setNarrativeSummaryError(null);
    setNarrativeSummaryLocale(null);
    setNarrativeSummaryGeneratedAt(null);

    setIsLoading(false);

    // Auto-save reflection session when we have a real profileId (dev server only)
    if (profileId && selectedGallery) {
      const key = `${profileId}:${galleryId}`;
      const sessionStartedAt =
        sessionStartedAtByKey[key] ?? new Date().toISOString();
      if (!sessionStartedAtByKey[key]) {
        setSessionStartedAtByKey((prev) => ({ ...prev, [key]: sessionStartedAt }));
      }
      const existingReflections = reflectionsByGallery[galleryId] ?? [];
      const allReflections = [...existingReflections, newReflection];
      const sessionReflections = allReflections.map((r) => ({
        imageIndex: r.imageIndex,
        imageId: r.imageId,
        imageUrl: r.imageUrl,
        content: r.content,
        internalState: r.internalState,
        generatedAt: r.generatedAt ?? r.timestamp,
        locale: r.locale,
      }));
      const saved = await saveReflectionSession({
        profileId,
        gallery: selectedGallery,
        sessionStartedAt,
        profile: viewerProfile,
        reflectionStyle,
        ...(initialState && { initialState }),
        reflections: sessionReflections,
        lastInternalState: newLastState,
        provider: visionProvider,
      });
      if (saved) {
        console.info(
          `Session saved to data/reflections/${profileId}_${galleryId}_${sessionStartedAt.replace(/:/g, "-")}.json`
        );
      }
    } else if (!profileId) {
      console.info(
        "Reflection session not saved: generate a viewer profile with the dev server (npm run dev) so it can be saved to data/profiles/; then reflections will auto-save to data/reflections/."
      );
    }

    if (autoVoiceOver && result.content && !result.error) {
      setSpeechCompleteForWalkThrough(false);
      speak(getSpeakableReflectionOnlyText(result.content), {
        rate: ttsRate,
        voice: ttsVoice || undefined,
        lang: locale,
        onEnd:
          walkThroughActive && autoAdvance
            ? () => setSpeechCompleteForWalkThrough(true)
            : undefined,
      });
    } else if (walkThroughActive && autoAdvance) {
      setSpeechCompleteForWalkThrough(true);
    }
  };

  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!walkThroughActive || !selectedGallery || isLoading) return;

    // Get the most recent reflection for the current image
    const currentRef = reflections
      .filter((r) => r.imageIndex === currentIndex)
      .slice(-1)[0];
    if (!currentRef) return;

    if (currentIndex >= selectedGallery.images.length - 1) {
      setWalkThroughActive(false);
      return;
    }
    if (autoAdvance) {
      if (autoVoiceOver && !speechCompleteForWalkThrough) return;
      const delay = autoVoiceOver ? 500 : 7000;
      autoAdvanceRef.current = setTimeout(() => {
        setSpeechCompleteForWalkThrough(false);
        setCurrentIndexByGallery((prev) => ({
          ...prev,
          [galleryId]: (prev[galleryId] ?? currentIndex) + 1,
        }));
      }, delay);
    }
    return () => {
      if (autoAdvanceRef.current) {
        clearTimeout(autoAdvanceRef.current);
      }
    };
  }, [walkThroughActive, selectedGallery, isLoading, reflections, currentIndex, autoAdvance, autoVoiceOver, speechCompleteForWalkThrough, galleryId]);

  const handleStartWalkThrough = () => {
    if (!selectedGallery) return;
    if (autoVoiceOver) {
      // Warm up TTS inside this click gesture (important on iOS/iPadOS).
      unlockSpeech();
    }
    setWalkThroughActive(true);
    setSpeechCompleteForWalkThrough(false);
    setCurrentIndexByGallery((prev) => ({ ...prev, [galleryId]: 0 }));
    setReflectionsByGallery((prev) => ({ ...prev, [galleryId]: [] }));
    setLastInternalStateByGallery((prev) => ({ ...prev, [galleryId]: "" }));
    setSelectedReflectionGeneratedAtByGallery((prev) => {
      const updated = { ...prev };
      delete updated[galleryId];
      return updated;
    });
  };

  const handleExport = (format: "markdown" | "json") => {
    if (!selectedGallery) return;
    const slug = selectedGallery.id.replace(/_/g, "-");
    const date = new Date().toISOString().slice(0, 10);
    const sessionStartedAt =
      (profileId && sessionStartedAtByKey[`${profileId}:${galleryId}`]) || new Date().toISOString();
    const options = {
      profileId: profileId ?? "anonymous",
      ...(styleId && { styleId }),
      ...(stateId && { stateId }),
      ...(profileLabel && { profileLabel }),
      ...(styleLabel && { styleLabel }),
      ...(stateLabel && { stateLabel }),
      sessionStartedAt,
      visionProvider,
      locale,
      ...(profileLlm && { profileLlm }),
      ...(profileLlmModelLabel && { profileLlmModelLabel }),
      ...(styleLlm && { styleLlm }),
      ...(styleLlmModelLabel && { styleLlmModelLabel }),
      ...(stateLlm && { stateLlm }),
      ...(stateLlmModelLabel && { stateLlmModelLabel }),
      ...(initialState && { initialState }),
      ...(profileShort && { profileShort }),
      ...(reflectionStyleShort && { reflectionStyleShort }),
      ...(initialStateShort && { initialStateShort }),
      ...(narrativeSummary && { trajectorySummary: narrativeSummary }),
      ...(narrativeSummaryLocale && { trajectorySummaryLocale: narrativeSummaryLocale }),
      ...(narrativeSummaryGeneratedAt && {
        trajectorySummaryGeneratedAt: narrativeSummaryGeneratedAt,
      }),
    };
    if (format === "markdown") {
      const md = exportAsMarkdown(
        selectedGallery,
        reflections.map((r) => ({
          ...r,
          generatedAt: r.generatedAt ?? r.timestamp,
          locale: r.locale,
        })),
        lastInternalState,
        viewerProfile,
        reflectionStyle,
        options
      );
      downloadFile(md, `${slug}-${date}.md`, "text/markdown;charset=utf-8");
    } else {
      const json = exportAsJson(
        selectedGallery,
        reflections.map((r) => ({
          ...r,
          generatedAt: r.generatedAt ?? r.timestamp,
          locale: r.locale,
        })),
        lastInternalState,
        viewerProfile,
        reflectionStyle,
        options
      );
      downloadFile(json, `${slug}-${date}.json`, "application/json;charset=utf-8");
    }
  };

  const handleSummarizeTrajectory = async () => {
    if (!selectedGallery || reflections.length === 0) return;
    setNarrativeSummaryLoading(true);
    setNarrativeSummaryError(null);
    setNarrativeSummary(null);
    const sessionStartedAt =
      profileId && sessionStartedAtByKey[`${profileId}:${galleryId}`]
        ? sessionStartedAtByKey[`${profileId}:${galleryId}`]
        : new Date().toISOString();
    const labels = getModelLabels(visionProvider);
    const payload: ReflectionSessionPayload = {
      profileId: profileId ?? "anonymous",
      galleryId: selectedGallery.id,
      sessionStartedAt,
      lastUpdatedAt: new Date().toISOString(),
      gallery: {
        id: selectedGallery.id,
        name: selectedGallery.name,
        era: selectedGallery.era,
        description: selectedGallery.description,
      },
      profile: viewerProfile,
      reflectionStyle,
      reflections: reflections.map((r) => ({
        imageIndex: r.imageIndex,
        imageId: r.imageId,
        imageUrl: r.imageUrl,
        content: r.content,
        ...(r.internalState && { internalState: r.internalState }),
        ...((r.generatedAt ?? r.timestamp) && { generatedAt: r.generatedAt ?? r.timestamp }),
        ...(r.locale && { locale: r.locale }),
      })),
      lastInternalState,
      llm: visionProvider,
      llmModelLabel: labels.llm,
      vlm: visionProvider,
      vlmModelLabel: labels.vlm,
    };
    const trajectory = trajectoryFromSession(payload);
    const result = await generateNarrativeSummary(trajectory, visionProvider, locale, initialState || undefined);
    setNarrativeSummaryLoading(false);
    if (result.error) {
      setNarrativeSummaryError(result.error);
      setNarrativeSummary(null);
      setNarrativeSummaryLocale(null);
      setNarrativeSummaryGeneratedAt(null);
    } else {
      setNarrativeSummary(result.summary);
      setNarrativeSummaryError(null);
      setNarrativeSummaryLocale(locale);
      const trajectorySummaryGeneratedAt = new Date().toISOString();
      setNarrativeSummaryGeneratedAt(trajectorySummaryGeneratedAt);
      // Save the trajectory summary to the session file (only if we have a real profileId)
      if (profileId && result.summary) {
        await saveReflectionSession({
          profileId,
          gallery: selectedGallery,
          sessionStartedAt,
          profile: viewerProfile,
          reflectionStyle,
          ...(initialState && { initialState }),
          reflections: reflections.map((r) => ({
            imageIndex: r.imageIndex,
            imageId: r.imageId,
            imageUrl: r.imageUrl,
            content: r.content,
            ...(r.internalState && { internalState: r.internalState }),
            ...((r.generatedAt ?? r.timestamp) && { generatedAt: r.generatedAt ?? r.timestamp }),
            ...(r.locale && { locale: r.locale }),
          })),
          lastInternalState,
          provider: visionProvider,
          trajectorySummary: result.summary,
          trajectorySummaryLocale: locale,
          trajectorySummaryGeneratedAt,
        });
      }
    }
    setShowTrajectorySummaryModal(true);
  };

  const handleStopWalkThrough = () => {
    setWalkThroughActive(false);
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
    }
  };

  const handleNext = () => {
    if (!selectedGallery) return;
    if (currentIndex < selectedGallery.images.length - 1) {
      setCurrentIndexByGallery((prev) => ({
        ...prev,
        [galleryId]: (prev[galleryId] ?? currentIndex) + 1,
      }));
      // Clear selected reflection when navigating via prev/next
      setSelectedReflectionGeneratedAtByGallery((prev) => {
        const updated = { ...prev };
        delete updated[galleryId];
        return updated;
      });
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndexByGallery((prev) => ({
        ...prev,
        [galleryId]: (prev[galleryId] ?? currentIndex) - 1,
      }));
      // Clear selected reflection when navigating via prev/next
      setSelectedReflectionGeneratedAtByGallery((prev) => {
        const updated = { ...prev };
        delete updated[galleryId];
        return updated;
      });
    }
  };

  // Get the selected reflection if one was clicked, otherwise the most recent for the current image
  const currentReflection = selectedReflectionGeneratedAt
    ? reflections.find(
        (r) =>
          r.imageIndex === currentIndex &&
          (r.generatedAt ?? r.timestamp) === selectedReflectionGeneratedAt
      )
    : reflections
        .filter((r) => r.imageIndex === currentIndex)
        .slice(-1)[0];

  useEffect(() => {
    if (!galleryId) return;
    const galleryReflections = reflectionsByGallery[galleryId] ?? [];
    setIsHistoryCollapsed(galleryReflections.length > 1);
  }, [galleryId]);

  const needsReflect =
    walkThroughActive &&
    selectedGallery &&
    !isLoading &&
    !reflections.some((r) => r.imageIndex === currentIndex);

  useEffect(() => {
    if (needsReflect && currentImage) {
      handleReflectOnCurrent();
    }
  }, [needsReflect]);

  const overlayOpen =
    showAbout ||
    showApiKeysModal ||
    showImageModal ||
    (showTrajectorySummaryModal &&
      (narrativeSummary !== null || narrativeSummaryError !== null));

  const activeHint =
    generationStatus ||
    (onboardingHint && onboardingHint !== t(locale, "onboarding.nextStepSelectGallery"))
      ? (generationStatus ? (
          <>
            {t(locale, `status.${generationStatus}`)}
            <span className="loading-dots" aria-hidden="true">
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          </>
        ) : (
          renderTextWithAnimatedEllipsis(onboardingHint!)
        ))
      : !onboardingHint && selectedGallery
        ? isLoading
          ? renderTextWithAnimatedEllipsis(t(locale, "reflection.reflectingHint"))
          : walkThroughActive || reflections.length === 0
            ? walkThroughActive
              ? <>
                  {t(locale, "reflection.walkthroughInProgress")}
                  <br />
                  {autoAdvance
                    ? t(locale, "reflection.autoAdvanceOn")
                    : t(locale, "reflection.autoAdvanceOff")}
                  <br />
                  {t(locale, "reflection.stopWalkthroughHint")}
                </>
              : <>{t(locale, "reflection.selectImageHint")}</>
            : null
        : null;

  return (
    <div className={`app${overlayOpen ? " overlay-open" : ""}`}>
      <header className="header">
        <div className="header-content">
          <img src="https://fredericbenard.com/images/icons/stateful-viewers.png" alt="Stateful Viewers" className="header-logo" />
          <div>
            <h1>{t(locale, "app.title")}</h1>
            <p className="subtitle">
              {t(locale, "app.subtitle")}
            </p>
          </div>
        </div>
        {activeHint != null && (
          <p className="hint-top-right" role="status" aria-live="polite">
            {activeHint}
          </p>
        )}
      </header>

      <main className="main">
        <aside className="sidebar">
          <div className="sidebar-section sidebar-section-models">
            <h2>{t(locale, "sidebar.models")}</h2>
            <div className="model-select">
              {!isHfSpace() && (
              <label className="model-option">
                <input
                  type="radio"
                  name="provider"
                  value="ollama"
                  checked={visionProvider === "ollama"}
                  onChange={() => handleProviderChange("ollama")}
                />
                <span>LLaVA-1.6 7B, Llama 3.1 8B Instruct</span>
              </label>
              )}
              <label className="model-option">
                <input
                  type="radio"
                  name="provider"
                  value="openai"
                  checked={visionProvider === "openai"}
                  onChange={() => handleProviderChange("openai")}
                />
                <span>GPT-5.2</span>
              </label>
              <label className="model-option">
                <input
                  type="radio"
                  name="provider"
                  value="gemini"
                  checked={visionProvider === "gemini"}
                  onChange={() => handleProviderChange("gemini")}
                />
                <span>Gemini 3 Pro (preview)</span>
              </label>
              <label className="model-option">
                <input
                  type="radio"
                  name="provider"
                  value="anthropic"
                  checked={visionProvider === "anthropic"}
                  onChange={() => handleProviderChange("anthropic")}
                />
                <span>Claude Sonnet 4.5</span>
              </label>
            </div>
            <button
              type="button"
              className="sidebar-api-keys-btn"
              onClick={() => setShowApiKeysModal(true)}
            >
              {t(locale, "sidebar.apiKeys")}
            </button>
            {generationError && (
              <div className="generation-error sidebar-llm-error">
                {generationError}
              </div>
            )}
          </div>
          <div className="sidebar-section sidebar-section-viewer">
            <h2>{t(locale, "sidebar.viewer")}</h2>
            {(() => {
              const unset = t(locale, "viewerConfiguration.unset");
              const profileLocaleTag = selectedProfileSummary
                ? normalizeArtifactLocale(selectedProfileSummary.locale).toUpperCase()
                : null;
              const voiceLocaleTag = selectedStyleSummary
                ? normalizeArtifactLocale(selectedStyleSummary.locale).toUpperCase()
                : null;
              const stateLocaleTag = selectedStateSummary
                ? normalizeArtifactLocale(selectedStateSummary.locale).toUpperCase()
                : null;

              const currentProfileRaw = profileLabel?.trim();
              const currentVoiceRaw = styleLabel?.trim();
              const currentInitialStateRaw = stateLabel?.trim();

              const currentProfile = currentProfileRaw
                ? `${currentProfileRaw}${
                    profileLocaleTag && profileLocaleTag.toLowerCase() !== locale
                      ? ` (${profileLocaleTag})`
                      : ""
                  }`
                : unset;
              const currentVoice = currentVoiceRaw
                ? `${currentVoiceRaw}${
                    voiceLocaleTag && voiceLocaleTag.toLowerCase() !== locale
                      ? ` (${voiceLocaleTag})`
                      : ""
                  }`
                : unset;
              const currentInitialState = currentInitialStateRaw
                ? `${currentInitialStateRaw}${
                    stateLocaleTag && stateLocaleTag.toLowerCase() !== locale
                      ? ` (${stateLocaleTag})`
                      : ""
                  }`
                : unset;

              return (
                <div className="viewer-config-block">
                  <p className="viewer-config-definition">
                    <em>{t(locale, "viewerConfiguration.definition")}</em>
                  </p>
                  <div className="viewer-config-subtitle">
                    {t(locale, "viewerConfiguration.currentViewer")}
                  </div>
                  <ul className="viewer-config-list">
                    <li>
                      <span className="viewer-config-key">
                        {t(locale, "viewerProfile.profileHeading")}:
                      </span>{" "}
                      {currentProfile}
                    </li>
                    <li>
                      <span className="viewer-config-key">
                        {t(locale, "viewerProfile.reflectionStyleHeading")}:
                      </span>{" "}
                      {currentVoice}
                    </li>
                    <li>
                      <span className="viewer-config-key">
                        {t(locale, "viewerProfile.initialStateHeading")}:
                      </span>{" "}
                      {currentInitialState}
                    </li>
                  </ul>
                </div>
              );
            })()}
            <div className="viewer-artifact-group">
              <div className="viewer-artifact-group-header">
                <div className="viewer-artifact-group-title">
                  {t(locale, "viewerProfile.profileHeading")}
                </div>
                <div className="viewer-artifact-actions">
                  <button
                    className="generate-viewer-btn viewer-artifact-btn-secondary"
                    onClick={() => !isGeneratingUi && handleGenerateProfile()}
                    disabled={isGeneratingUi}
                  >
                    {isGeneratingProfile
                      ? t(locale, "sidebar.generating")
                      : t(locale, "sidebar.generate")}
                  </button>
                </div>
              </div>
              <div className="artifact-picklist-section">
                <select
                  className="artifact-select"
                  value={
                    profileId || (!!viewerProfile.trim() && !profileId ? "__current__" : "")
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) {
                      setProfileId(null);
                      setViewerProfile("");
                      setProfileShort("");
                      setProfileLabel(null);
                      resetExperienceAfterViewerChange();
                      return;
                    }
                    if (v === "__current__") return;
                    handleLoadProfile(v);
                  }}
                  disabled={isLoadingProfiles}
                  aria-label={t(locale, "sidebar.selectProfile")}
                >
                  <option value="">
                    {isLoadingProfiles
                      ? t(locale, "sidebar.loadingProfiles")
                      : sortedAvailableProfiles.length === 0 && !(!!viewerProfile.trim() && !profileId)
                        ? t(locale, "sidebar.noProfiles")
                        : t(locale, "sidebar.selectProfile")}
                  </option>
                  {!!viewerProfile.trim() &&
                    !profileId &&
                    !isLoadingProfiles && (
                      <option value="__current__">
                        {profileLabel || t(locale, "viewerProfile.profileHeading")}
                      </option>
                    )}
                  {!isLoadingProfiles &&
                    sortedAvailableProfiles.map((p) => {
                      const badge =
                        p.locale && normalizeArtifactLocale(p.locale) !== locale
                          ? ` (${normalizeArtifactLocale(p.locale).toUpperCase()})`
                          : "";
                      return (
                        <option key={p.id} value={p.id}>
                          {(p.label || t(locale, "sidebar.untitledProfile")) + badge}
                        </option>
                      );
                    })}
                </select>
                {(profileId || !!viewerProfile.trim()) && (
                  <div className="artifact-detail-block">
                    <div
                      ref={profileTextRef}
                      className={`profile-selector-summary artifact-detail-text ${
                        !profileShortExpanded ? "artifact-detail-text--clamped" : ""
                      }`}
                    >
                      {profileShort?.trim() || viewerProfile}
                    </div>
                    {(profileShortExpanded || profileHasOverflow) && (
                      <button
                        type="button"
                        className="viewer-profile-toggle-ghost"
                        onClick={() => setProfileShortExpanded((v) => !v)}
                        data-expanded={profileShortExpanded ? "true" : "false"}
                      >
                        <span className="viewer-profile-toggle-chevron" aria-hidden="true">
                          ▸
                        </span>
                        {profileShortExpanded
                          ? t(locale, "viewerProfile.showLess")
                          : t(locale, "viewerProfile.showMore")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="viewer-artifact-group">
              <div className="viewer-artifact-group-header">
                <div className="viewer-artifact-group-title">
                  {t(locale, "viewerProfile.reflectionStyleHeading")}
                </div>
                <div className="viewer-artifact-actions">
                  <button
                    className="generate-viewer-btn viewer-artifact-btn-secondary"
                    onClick={() => !isGeneratingUi && handleGenerateStyle()}
                    disabled={isGeneratingUi}
                  >
                    {isGeneratingStyle
                      ? t(locale, "sidebar.generating")
                      : t(locale, "sidebar.generate")}
                  </button>
                </div>
              </div>
              <div className="artifact-picklist-section">
                <select
                  className="artifact-select"
                  value={
                    styleId || (!!reflectionStyle.trim() && !styleId ? "__current__" : "")
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) {
                      setStyleId(null);
                      setReflectionStyle("");
                      setReflectionStyleShort("");
                      setStyleLabel(null);
                      resetExperienceAfterViewerChange();
                      return;
                    }
                    if (v === "__current__") return;
                    handleLoadStyle(v);
                  }}
                  disabled={isLoadingStyles}
                  aria-label={t(locale, "sidebar.selectVoice")}
                >
                  <option value="">
                    {isLoadingStyles
                      ? t(locale, "sidebar.loadingStyles")
                      : sortedAvailableStyles.length === 0 && !(!!reflectionStyle.trim() && !styleId)
                        ? t(locale, "sidebar.noStyles")
                        : t(locale, "sidebar.selectVoice")}
                  </option>
                  {!!reflectionStyle.trim() &&
                    !styleId &&
                    !isLoadingStyles && (
                      <option value="__current__">
                        {styleLabel || t(locale, "viewerProfile.reflectionStyleHeading")}
                      </option>
                    )}
                  {!isLoadingStyles &&
                    sortedAvailableStyles.map((s) => {
                      const label =
                        s.label ||
                        (s.reflectionStyleShort
                          ? truncateAtWord(s.reflectionStyleShort, 72)
                          : t(locale, "sidebar.untitledStyle"));
                      const badge =
                        s.locale && normalizeArtifactLocale(s.locale) !== locale
                          ? ` (${normalizeArtifactLocale(s.locale).toUpperCase()})`
                          : "";
                      return (
                        <option key={s.id} value={s.id}>
                          {label + badge}
                        </option>
                      );
                    })}
                </select>
                {(styleId || !!reflectionStyle.trim()) && (
                  <div className="artifact-detail-block">
                    <div
                      ref={styleTextRef}
                      className={`profile-selector-summary artifact-detail-text ${
                        !styleShortExpanded ? "artifact-detail-text--clamped" : ""
                      }`}
                    >
                      {reflectionStyleShort?.trim() || reflectionStyle}
                    </div>
                    {(styleShortExpanded || styleHasOverflow) && (
                      <button
                        type="button"
                        className="viewer-profile-toggle-ghost"
                        onClick={() => setStyleShortExpanded((v) => !v)}
                        data-expanded={styleShortExpanded ? "true" : "false"}
                      >
                        <span className="viewer-profile-toggle-chevron" aria-hidden="true">
                          ▸
                        </span>
                        {styleShortExpanded
                          ? t(locale, "viewerProfile.showLess")
                          : t(locale, "viewerProfile.showMore")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="viewer-artifact-group">
              <div className="viewer-artifact-group-header">
                <div className="viewer-artifact-group-title">
                  {t(locale, "viewerProfile.initialStateHeading")}
                </div>
                <div className="viewer-artifact-actions">
                  <button
                    className="generate-viewer-btn viewer-artifact-btn-secondary"
                    onClick={() => !isGeneratingUi && handleGenerateState()}
                    disabled={isGeneratingUi}
                  >
                    {isGeneratingState
                      ? t(locale, "sidebar.generating")
                      : t(locale, "sidebar.generate")}
                  </button>
                </div>
              </div>
              <div className="artifact-picklist-section">
                <select
                  className="artifact-select"
                  value={
                    stateId || (!!initialState.trim() && !stateId ? "__current__" : "")
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (!v) {
                      setStateId(null);
                      setInitialState("");
                      setInitialStateShort("");
                      setStateLabel(null);
                      resetExperienceAfterViewerChange();
                      return;
                    }
                    if (v === "__current__") return;
                    handleLoadState(v);
                  }}
                  disabled={isLoadingStates}
                  aria-label={t(locale, "sidebar.selectState")}
                >
                  <option value="">
                    {isLoadingStates
                      ? t(locale, "sidebar.loadingStates")
                      : sortedAvailableStates.length === 0 && !(!!initialState.trim() && !stateId)
                        ? t(locale, "sidebar.noStates")
                        : t(locale, "sidebar.selectState")}
                  </option>
                  {!!initialState.trim() &&
                    !stateId &&
                    !isLoadingStates && (
                      <option value="__current__">
                        {stateLabel || t(locale, "viewerProfile.initialStateHeading")}
                      </option>
                    )}
                  {!isLoadingStates &&
                    sortedAvailableStates.map((s) => {
                      const label =
                        s.label ||
                        (s.initialStateShort
                          ? truncateAtWord(s.initialStateShort, 72)
                          : t(locale, "sidebar.untitledState"));
                      const badge =
                        s.locale && normalizeArtifactLocale(s.locale) !== locale
                          ? ` (${normalizeArtifactLocale(s.locale).toUpperCase()})`
                          : "";
                      return (
                        <option key={s.id} value={s.id}>
                          {label + badge}
                        </option>
                      );
                    })}
                </select>
                {(stateId || !!initialState.trim()) && (
                  <div className="artifact-detail-block">
                    <div
                      ref={stateTextRef}
                      className={`profile-selector-summary artifact-detail-text ${
                        !stateShortExpanded ? "artifact-detail-text--clamped" : ""
                      }`}
                    >
                      {initialStateShort?.trim() || initialState}
                    </div>
                    {(stateShortExpanded || stateHasOverflow) && (
                      <button
                        type="button"
                        className="viewer-profile-toggle-ghost"
                        onClick={() => setStateShortExpanded((v) => !v)}
                        data-expanded={stateShortExpanded ? "true" : "false"}
                      >
                        <span className="viewer-profile-toggle-chevron" aria-hidden="true">
                          ▸
                        </span>
                        {stateShortExpanded
                          ? t(locale, "viewerProfile.showLess")
                          : t(locale, "viewerProfile.showMore")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {showApiKeysModal && (
          <div className="about-overlay" onClick={() => setShowApiKeysModal(false)}>
            <div className="about-modal" onClick={(e) => e.stopPropagation()}>
              <div className="about-modal-header">
                <h2>{t(locale, "apiKeysModal.title")}</h2>
                <button
                  className="about-close"
                  onClick={() => setShowApiKeysModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="about-modal-content">
                <p className="api-keys-intro">
                  {t(locale, "apiKeysModal.intro")}
                </p>
                <div className="api-keys-form">
                  <label>
                    <span>OpenAI</span>
                    <input
                      type="text"
                      autoComplete="off"
                      placeholder="sk-..."
                      value={apiKeysForm.openai ?? ""}
                      onChange={(e) => setApiKeysForm((k) => ({ ...k, openai: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Google (Gemini)</span>
                    <input
                      type="text"
                      autoComplete="off"
                      placeholder="AIza..."
                      value={apiKeysForm.google ?? ""}
                      onChange={(e) => setApiKeysForm((k) => ({ ...k, google: e.target.value }))}
                    />
                  </label>
                  <label>
                    <span>Anthropic</span>
                    <input
                      type="text"
                      autoComplete="off"
                      placeholder="sk-ant-..."
                      value={apiKeysForm.anthropic ?? ""}
                      onChange={(e) => setApiKeysForm((k) => ({ ...k, anthropic: e.target.value }))}
                    />
                  </label>
                  <div className="api-keys-actions">
                    <button
                      className="generate-viewer-btn"
                      onClick={() => {
                        setApiKeys(apiKeysForm);
                        setShowApiKeysModal(false);
                        const hasKeyForProvider =
                          (visionProvider === "openai" && apiKeysForm.openai?.trim()) ||
                          (visionProvider === "gemini" && apiKeysForm.google?.trim()) ||
                          (visionProvider === "anthropic" && apiKeysForm.anthropic?.trim());
                        if (hasKeyForProvider) setGenerationError(null);
                      }}
                    >
                      {t(locale, "common.save")}
                    </button>
                    <button
                      className="about-btn"
                      onClick={() => setShowApiKeysModal(false)}
                    >
                      {t(locale, "common.cancel")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showAbout && (
          <div className="about-overlay" onClick={() => setShowAbout(false)}>
            <div className="about-modal" onClick={(e) => e.stopPropagation()}>
              <div className="about-modal-header">
                <h2>{ABOUT_CONTENT[locale].title}</h2>
                <button
                  className="about-close"
                  onClick={() => setShowAbout(false)}
                >
                  ×
                </button>
              </div>
              <div className="about-modal-content">
                {(() => {
                  const about = ABOUT_CONTENT[locale];
                  type AboutBullet = { term: string; description?: string; refs?: string };
                  type AboutSection = {
                    heading?: string;
                    paragraphs?: string[];
                    bullets?: AboutBullet[];
                    note?: string;
                  };
                  const renderSection = (id: string, section: AboutSection) => (
                    <>
                      {section.heading ? <h3>{section.heading}</h3> : null}
                      {section.paragraphs?.map((p, idx) => (
                        <p key={`${id}-p-${idx}`}>{renderInlineMarkup(p)}</p>
                      ))}
                      {section.bullets && section.bullets.length > 0 && (
                        <ul>
                          {section.bullets.map((b, idx) => (
                            <li key={`${id}-b-${idx}`}>
                              <strong>{b.term}</strong>
                              {b.description ? ` — ${b.description}` : b.refs ? ` → ${b.refs}` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                      {section.note ? <p>{section.note}</p> : null}
                    </>
                  );
                  return (
                    <>
                      {renderSection("overview", about.overview)}
                      {renderSection("researchPositioning", about.researchPositioning)}
                      {renderSection("systemStructure", about.systemStructure)}
                      {renderSection("viewerProfile", about.viewerProfile)}
                      {renderSection("reflectionStyle", about.reflectionStyle)}
                      {renderSection("initialState", about.initialState)}
                      {renderSection("statefulReflections", about.statefulReflections)}
                      {renderSection("summarizeTrajectory", about.summarizeTrajectory)}
                      {renderSection("whyThisMatters", about.whyThisMatters)}
                      <h3>{about.images.heading}</h3>
                      {about.images.paragraphs.map((p, idx) => (
                        <p key={`images-p-${idx}`}>
                          {p.beforeLink}
                          <a href="https://www.fredericbenard.com" target="_blank" rel="noreferrer">
                            {p.linkText}
                          </a>
                          {p.afterLink}
                        </p>
                      ))}
                      {about.images.disclaimer ? <p>{about.images.disclaimer}</p> : null}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {showTrajectorySummaryModal && (narrativeSummary !== null || narrativeSummaryError !== null) && (
          <div className="about-overlay" onClick={() => setShowTrajectorySummaryModal(false)}>
            <div className="about-modal" onClick={(e) => e.stopPropagation()}>
              <div className="about-modal-header">
                <h2>{t(locale, "trajectorySummary.title")}</h2>
                <button
                  className="about-close"
                  onClick={() => setShowTrajectorySummaryModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="about-modal-content">
                {narrativeSummaryError ? (
                  <p className="trajectory-summary-error">{narrativeSummaryError}</p>
                ) : narrativeSummary ? (
                  <p className="trajectory-summary-text">{narrativeSummary}</p>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {showImageModal && currentImage && (
          <div className="about-overlay" onClick={() => setShowImageModal(false)}>
            <div
              className="image-modal"
              style={imageModalStyle}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="image-modal-header">
                <button
                  className="about-close"
                  onClick={() => setShowImageModal(false)}
                >
                  ×
                </button>
              </div>
              <div className="image-modal-content">
                <div className="image-modal-image-wrap">
                  {isSensitiveImage(currentImage) && !isImageRevealed(selectedGallery, currentImage) && (
                    <div className="sensitive-image-overlay">
                      <p className="sensitive-image-text">{t(locale, "image.containsArtisticNudity")}</p>
                      <button
                        type="button"
                        className="sensitive-reveal-btn"
                        onClick={() => revealImage(selectedGallery, currentImage, true)}
                      >
                        {t(locale, "image.revealImage")}
                      </button>
                    </div>
                  )}
                  <img
                    src={currentImage.url}
                    alt={(currentImage.caption ?? "").replace(/&mdash;/g, "—")}
                    className={`image-modal-image ${
                      isSensitiveImage(currentImage) && !isImageRevealed(selectedGallery, currentImage)
                        ? "is-sensitive-blurred"
                        : ""
                    }`}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      if (img.naturalWidth && img.naturalHeight)
                        setModalImageNaturalSize({
                          width: img.naturalWidth,
                          height: img.naturalHeight,
                        });
                    }}
                  />
                </div>
                {currentImage.caption && (
                  <div className="image-modal-caption">
                    {currentImage.caption.replace(/&mdash;/g, "—")}
                  </div>
                )}
                {isSensitiveImage(currentImage) && isImageRevealed(selectedGallery, currentImage) && (
                  <button
                    type="button"
                    className="sensitive-reveal-btn sensitive-hide-btn"
                    onClick={() => revealImage(selectedGallery, currentImage, false)}
                  >
                    {t(locale, "image.hideImageAgain")}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <section className="viewer">
          {!selectedGallery ? (
            <>
              <div className="viewer-gallery-selector">
                <div className="viewer-artifact-group-title">
                  {t(locale, "gallery.heading")}
                </div>
                <select
                  className="gallery-select"
                  value=""
                  onChange={(e) => {
                    const id = e.target.value || null;
                    if (id) handleStartGallery(id);
                    else setSelectedGalleryId(null);
                  }}
                  disabled={walkThroughActive}
                  aria-label={t(locale, "gallery.selectPlaceholder")}
                >
                  <option value="">{t(locale, "gallery.selectPlaceholder")}</option>
                  {galleries.map((gallery) => (
                    <option key={gallery.id} value={gallery.id}>
                      {gallery.name}
                      {gallery.era ? ` — ${gallery.era}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="placeholder" />
            </>
          ) : (
            <div className="viewer-three-panes">
              <div className="viewer-center-pane">
                <div className="viewer-gallery-selector">
                  <div className="viewer-artifact-group-title">
                    {t(locale, "gallery.heading")}
                  </div>
                  <select
                    className="gallery-select"
                    value={selectedGallery?.id ?? ""}
                    onChange={(e) => {
                      const id = e.target.value || null;
                      if (id) handleStartGallery(id);
                      else setSelectedGalleryId(null);
                    }}
                    disabled={walkThroughActive}
                    title={
                      walkThroughActive
                        ? t(locale, "sidebar.stopWalkthroughToSwitchGalleries")
                        : undefined
                    }
                    aria-label={t(locale, "gallery.selectPlaceholder")}
                  >
                    <option value="">{t(locale, "gallery.selectPlaceholder")}</option>
                    {galleries.map((gallery) => (
                      <option key={gallery.id} value={gallery.id}>
                        {gallery.name}
                        {gallery.era ? ` — ${gallery.era}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="gallery-thumbnails gallery-thumbnails-contained">
                  <div className="gallery-thumbnails-row">
                    <div className="thumbnails-strip">
                      {selectedGallery.images.map((img, idx) => (
                        (() => {
                          const thumbnailRevealed = isImageRevealed(selectedGallery, img);
                          return (
                            <button
                              key={img.id}
                              type="button"
                              className={`thumbnail-item ${
                                idx === currentIndex ? "active" : ""
                              }`}
                              onClick={() => {
                                setCurrentIndexByGallery((prev) => ({
                                  ...prev,
                                  [galleryId]: idx,
                                }));
                                setSelectedReflectionGeneratedAtByGallery((prev) => {
                                  const updated = { ...prev };
                                  delete updated[galleryId];
                                  return updated;
                                });
                              }}
                              disabled={walkThroughActive}
                              title={
                                walkThroughActive
                                  ? t(locale, "image.stopWalkthroughToJump")
                                  : undefined
                              }
                            >
                              <img
                                src={img.url}
                                alt={img.caption || t(locale, "image.thumbnailAlt", { n: idx + 1 })}
                                className={`thumbnail-image ${
                                  isSensitiveImage(img) && !thumbnailRevealed
                                    ? "is-sensitive-blurred"
                                    : ""
                                }`}
                              />
                              {isSensitiveImage(img) && !thumbnailRevealed && (
                                <span className="thumbnail-sensitive-chip">
                                  {t(locale, "image.sensitiveChip")}
                                </span>
                              )}
                            </button>
                          );
                        })()
                      ))}
                    </div>
                  </div>
                </div>
                <div className="image-section">
                  <div className="image-container">
                    {isSensitiveImage(currentImage) && !isImageRevealed(selectedGallery, currentImage) && (
                      <div className="sensitive-image-overlay">
                        <p className="sensitive-image-text">
                          {t(locale, "image.containsArtisticNudity")}
                        </p>
                        <button
                          type="button"
                          className="sensitive-reveal-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            revealImage(selectedGallery, currentImage, true);
                          }}
                        >
                          {t(locale, "image.revealImage")}
                        </button>
                      </div>
                    )}
                    <img
                      src={currentImage?.url}
                      alt={(currentImage?.caption ?? "").replace(/&mdash;/g, "—")}
                      className={`gallery-image ${
                        isSensitiveImage(currentImage) && !isImageRevealed(selectedGallery, currentImage)
                          ? "is-sensitive-blurred"
                          : ""
                      }`}
                      onClick={() => setShowImageModal(true)}
                      style={{ cursor: "pointer" }}
                    />
                    {currentImage?.caption && (
                      <div className="image-caption">
                        {currentImage.caption.replace(/&mdash;/g, "—")}
                      </div>
                    )}
                  </div>
                  <div className="image-nav">
                    <button
                      onClick={handlePrev}
                      disabled={walkThroughActive || currentIndex === 0}
                    >
                      {t(locale, "image.previous")}
                    </button>
                    <span className="image-counter">
                      {currentIndex + 1} / {selectedGallery.images.length}
                    </span>
                    <button
                      onClick={handleNext}
                      disabled={
                        (walkThroughActive && autoAdvance) ||
                        currentIndex >= selectedGallery.images.length - 1
                      }
                    >
                      {t(locale, "reflection.next")}
                    </button>
                  </div>
                </div>
              </div>

              <aside className="experience-panel experience-panel-right">
                  <div className="reflection-section experience-current">
                    <div className="reflection-header-row">
                      <h3>{t(locale, "reflection.title")}</h3>
                    </div>
                    <div className="action-buttons experience-controls reflection-action-buttons">
                      <button
                        className="reflect-btn"
                        onClick={handleReflectOnCurrent}
                        disabled={
                          !currentImage ||
                          isLoading ||
                          !viewerProfile.trim() ||
                          !reflectionStyle.trim() ||
                          !initialState.trim() ||
                          walkThroughActive
                        }
                      >
                        {isLoading
                          ? t(locale, "reflection.reflecting")
                          : t(locale, "reflection.reflectOnThisImage")}
                      </button>
                      {!walkThroughActive ? (
                        <button
                          className="walkthrough-btn"
                          onClick={handleStartWalkThrough}
                          disabled={
                            !selectedGallery ||
                            isLoading ||
                            !viewerProfile.trim() ||
                            !reflectionStyle.trim() ||
                            !initialState.trim()
                          }
                        >
                          {t(locale, "reflection.startWalkthrough")}
                        </button>
                      ) : (
                        <button
                          className="walkthrough-btn stop"
                          onClick={handleStopWalkThrough}
                        >
                          {t(locale, "reflection.stopWalkthrough")}
                        </button>
                      )}
                    </div>
                    <div className="reflection-voice-toolbar">
                      {walkThroughActive && (
                        <label className="auto-advance-label reflection-auto-advance">
                          <input
                            type="checkbox"
                            checked={autoAdvance}
                            onChange={(e) => setAutoAdvance(e.target.checked)}
                          />
                          {t(locale, "reflection.autoAdvance")}
                        </label>
                      )}
                      <label className="reflection-auto-voice-toggle">
                        <input
                          type="checkbox"
                          checked={autoVoiceOver}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setAutoVoiceOver(checked);
                            if (checked) {
                              // Warm up TTS when the user explicitly enables auto voice-over.
                              unlockSpeech();
                            }
                          }}
                        />
                        {t(locale, "reflection.autoVoiceOver")}
                      </label>
                      <label className="reflection-voice-select-label">
                        <span>{t(locale, "reflection.voice")}</span>
                        <select
                          className="reflection-voice-select"
                          value={voicesForVoicePicker.length ? voicePickerValue : ""}
                          onMouseDown={() => {
                            // Ensure the browser has a chance to populate voices before showing the list.
                            refreshVoices();
                          }}
                          onFocus={() => refreshVoices()}
                          onChange={(e) => {
                            const next = e.target.value;
                            if (isSpeaking) stop();
                            setTtsVoice(next);
                            // Selecting a voice is a user gesture; also warm up TTS for iOS/iPadOS.
                            unlockSpeech();
                          }}
                          disabled={!voicesForVoicePicker.length}
                          aria-label={t(locale, "reflection.voice")}
                        >
                          {!voicesForVoicePicker.length ? (
                            <option value="">{t(locale, "reflection.loadingVoices")}</option>
                          ) : (
                            [...voicesForVoicePicker]
                              .sort((a, b) => {
                                const aIsLocale = a.lang.toLowerCase().startsWith(locale);
                                const bIsLocale = b.lang.toLowerCase().startsWith(locale);
                                if (aIsLocale !== bIsLocale) return aIsLocale ? -1 : 1;
                                const byLang = a.lang.localeCompare(b.lang);
                                if (byLang !== 0) return byLang;
                                return a.name.localeCompare(b.name);
                              })
                              .map((v) => (
                                <option key={`${v.name}|||${v.lang}`} value={v.name}>
                                  {v.name} ({v.lang})
                                </option>
                              ))
                          )}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="speak-btn"
                        onClick={() => {
                          if (!currentReflection) return;
                          if (isSpeaking) {
                            stop();
                          } else {
                            speak(getSpeakableReflectionOnlyText(currentReflection.content), {
                              rate: ttsRate,
                              voice: ttsVoice || undefined,
                              lang: locale,
                            });
                          }
                        }}
                        disabled={!currentReflection}
                      >
                        {isSpeaking
                          ? t(locale, "reflection.stopListening")
                          : t(locale, "reflection.listen")}
                      </button>
                    </div>
                    {currentReflection ? (
                      <div className="reflection-content">
                        {currentReflection.error ? (
                          <div className="generation-error">
                            {currentReflection.error}
                          </div>
                        ) : (
                          <>
                            {currentReflection.internalState ? (
                              <>
                                <p className="reflection-text">
                                  {parseReflection(currentReflection.content).reaction}
                                </p>
                                <div className="internal-state-block">
                                  <p className="internal-state-text">
                                    {currentReflection.internalState}
                                  </p>
                                </div>
                              </>
                            ) : (
                              <p className="reflection-text">
                                {currentReflection.content}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {reflections.length > 0 && (
                    <div className="reflection-history experience-history">
                      <div className="experience-history-header">
                        <h3>{t(locale, "history.title")}</h3>
                      </div>
                      <div className="reflection-history-actions">
                        <button
                          type="button"
                          className="history-toggle-btn"
                          onClick={() => setIsHistoryCollapsed((prev) => !prev)}
                        >
                          {isHistoryCollapsed ? t(locale, "history.show") : t(locale, "history.hide")}
                        </button>
                        <div className="export-menu-wrap" ref={exportMenuRef}>
                          <button
                            type="button"
                            className="export-btn"
                            onClick={() => setShowExportMenu((v) => !v)}
                            aria-expanded={showExportMenu}
                            aria-haspopup="true"
                          >
                            {t(locale, "history.export")}
                          </button>
                          {showExportMenu && (
                            <div className="export-menu" role="menu">
                              <button
                                type="button"
                                role="menuitem"
                                className="export-menu-item"
                                onClick={() => {
                                  setShowExportMenu(false);
                                  handleExport("markdown");
                                }}
                              >
                                {t(locale, "history.exportMarkdown")}
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                className="export-menu-item"
                                onClick={() => {
                                  setShowExportMenu(false);
                                  handleExport("json");
                                }}
                              >
                                {t(locale, "history.exportJson")}
                              </button>
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          className="export-btn"
                          onClick={handleSummarizeTrajectory}
                          disabled={narrativeSummaryLoading}
                        >
                          {narrativeSummaryLoading
                            ? t(locale, "history.summarizing")
                            : t(locale, "history.summarize")}
                        </button>
                      </div>
                      {isHistoryCollapsed ? (
                        <p className="experience-history-summary">
                          {reflections.length === 1
                            ? t(locale, "history.reflectionsOne", { count: reflections.length })
                            : t(locale, "history.reflectionsMany", { count: reflections.length })}
                        </p>
                      ) : (
                        <div className="history-list">
                          {reflections.map((r, idx) => (
                            <button
                              key={`${r.imageIndex}-${r.imageId}-${r.generatedAt || r.timestamp || idx}`}
                              type="button"
                              className={`history-item ${
                                r.imageIndex === currentIndex &&
                                currentReflection &&
                                (r.generatedAt ?? r.timestamp) === (currentReflection.generatedAt ?? currentReflection.timestamp)
                                  ? "active"
                                  : ""
                              }`}
                              onClick={() => {
                                setCurrentIndexByGallery((prev) => ({
                                  ...prev,
                                  [galleryId]: r.imageIndex,
                                }));
                                // Track which specific reflection was selected
                                const when = r.generatedAt ?? r.timestamp;
                                if (when) {
                                  setSelectedReflectionGeneratedAtByGallery((prev) => ({
                                    ...prev,
                                    [galleryId]: when,
                                  }));
                                }
                              }}
                              disabled={walkThroughActive}
                              title={
                                walkThroughActive
                                  ? t(locale, "history.stopWalkthroughToSelect")
                                  : undefined
                              }
                            >
                              <img
                                src={r.imageUrl}
                                alt=""
                                className="history-thumbnail"
                              />
                              <div className="history-content">
                                <span className="history-index">
                                  {t(locale, "history.imageNumber", { n: r.imageIndex + 1 })}
                                </span>
                                <span className="history-preview">
                                  {truncateAtWord(parseReflection(r.content).reaction || r.content, 150)}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </aside>
            </div>
          )}
        </section>
      </main>

      <footer className="footer app-footer">
        <div className="app-footer-content">
          <span className="sidebar-images-credit">
            {t(locale, "sidebar.imagesCopyright")}{" "}
            <a
              href="https://www.fredericbenard.com"
              target="_blank"
              rel="noreferrer"
            >
              Frédéric Bénard
            </a>
            {`. ${t(locale, "sidebar.allRightsReserved")}`}
          </span>
          <span className="app-footer-sep" aria-hidden="true">
            {" · "}
          </span>
          <span
            className="sidebar-locale-toggle"
            role="group"
            aria-label={t(locale, "sidebar.language")}
          >
            <button
              type="button"
              className={`sidebar-about-link ${locale === "en" ? "active" : ""}`}
              onClick={() => setLocale("en")}
            >
              EN
            </button>
            <span aria-hidden="true">/</span>
            <button
              type="button"
              className={`sidebar-about-link ${locale === "fr" ? "active" : ""}`}
              onClick={() => setLocale("fr")}
            >
              FR
            </button>
          </span>
          <span className="app-footer-sep" aria-hidden="true">
            {" · "}
          </span>
          <button
            type="button"
            className="sidebar-about-link"
            onClick={() => setShowAbout(true)}
          >
            {t(locale, "sidebar.aboutProject")}
          </button>
        </div>
      </footer>

    </div>
  );
}

export default App;
