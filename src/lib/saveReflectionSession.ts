/**
 * Auto-save reflection session to data/reflections/<profileId>_<galleryId>_<sessionStartedAt>.json
 * Only called when we have a real profileId (from successful profile save).
 */

import type { Gallery } from "../data/galleries";
import type { VisionProvider } from "../api/vision";
import type { OutputLocale } from "../prompts";
import { isHfSpace } from "./isHfSpace";

const MODEL_LABELS: Record<
  VisionProvider,
  { vlm: string; llm: string }
> = {
  ollama: {
    vlm: "LLaVA-1.6 7B (llava:7b)",
    llm: "Llama 3.1 8B Instruct (Q5_K_M quantized) (llama3.1:8b-instruct-q5_K_M)",
  },
  openai: { vlm: "GPT-5.2", llm: "GPT-5.2" },
  gemini: { vlm: "Gemini 3 Pro (preview)", llm: "Gemini 3 Pro (preview)" },
  anthropic: { vlm: "Claude Sonnet 4.5", llm: "Claude Sonnet 4.5" },
};

export function getModelLabels(provider: VisionProvider): { vlm: string; llm: string } {
  return MODEL_LABELS[provider];
}

export interface SessionReflection {
  imageIndex: number;
  imageId: string;
  imageUrl: string;
  content: string;
  internalState?: string;
  /** When this reflection was generated (ISO). */
  generatedAt?: string;
  /** Legacy field name kept for backward compatibility (prefer `generatedAt`). */
  timestamp?: string;
  locale?: OutputLocale;
}

export interface ReflectionSessionPayload {
  profileId: string;
  galleryId: string;
  sessionStartedAt: string;
  lastUpdatedAt: string;
  /** Locale active when this session snapshot was saved. Individual reflections may differ. */
  locale?: OutputLocale;
  gallery: { id: string; name: string; era: string; description: string };
  profile: string;
  reflectionStyle: string;
  /** Initial internal state before the first image (from the generated profile). */
  initialState?: string;
  reflections: SessionReflection[];
  lastInternalState: string;
  /** Provider key for the LLM (profile/style generation) */
  llm: VisionProvider;
  /** Human-readable name of the LLM */
  llmModelLabel: string;
  /** Provider key for the VLM (image reflections) */
  vlm: VisionProvider;
  /** Human-readable name of the VLM */
  vlmModelLabel: string;
  /** Narrative summary of the trajectory (generated via Summarize trajectory) */
  trajectorySummary?: string;
  /** Locale used to generate `trajectorySummary` (summary language). */
  trajectorySummaryLocale?: OutputLocale;
  /** When the current `trajectorySummary` was generated (ISO). */
  trajectorySummaryGeneratedAt?: string;
}

export interface SaveReflectionSessionParams {
  profileId: string;
  gallery: Gallery;
  sessionStartedAt: string;
  profile: string;
  reflectionStyle: string;
  initialState?: string;
  reflections: SessionReflection[];
  lastInternalState: string;
  provider: VisionProvider;
  locale?: OutputLocale;
  /** Optional trajectory summary to include in the saved session */
  trajectorySummary?: string;
  /** Locale used to generate `trajectorySummary` (summary language). */
  trajectorySummaryLocale?: OutputLocale;
  /** When the current `trajectorySummary` was generated (ISO). */
  trajectorySummaryGeneratedAt?: string;
}

/**
 * POSTs the session to the dev server to save to data/reflections/.
 * No-op if the endpoint is not available. Returns true when save succeeds.
 */
export async function saveReflectionSession(
  params: SaveReflectionSessionParams
): Promise<boolean> {
  // On Hugging Face Spaces free tier, the server filesystem is shared across users and ephemeral.
  // We intentionally avoid writing user session data there.
  if (isHfSpace()) return false;
  const labels = getModelLabels(params.provider);
  const payload: ReflectionSessionPayload = {
    profileId: params.profileId,
    galleryId: params.gallery.id,
    sessionStartedAt: params.sessionStartedAt,
    lastUpdatedAt: new Date().toISOString(),
    ...(params.locale && { locale: params.locale }),
    gallery: {
      id: params.gallery.id,
      name: params.gallery.name,
      era: params.gallery.era,
      description: params.gallery.description,
    },
    profile: params.profile,
    reflectionStyle: params.reflectionStyle,
    ...(params.initialState && { initialState: params.initialState }),
    reflections: params.reflections,
    lastInternalState: params.lastInternalState,
    llm: params.provider,
    llmModelLabel: labels.llm,
    vlm: params.provider,
    vlmModelLabel: labels.vlm,
    ...(params.trajectorySummary && { trajectorySummary: params.trajectorySummary }),
    ...(params.trajectorySummaryLocale && { trajectorySummaryLocale: params.trajectorySummaryLocale }),
    ...(params.trajectorySummaryGeneratedAt && { trajectorySummaryGeneratedAt: params.trajectorySummaryGeneratedAt }),
  };

  try {
    const res = await fetch("/api/save-reflection-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload, null, 2),
    });
    return res.ok;
  } catch {
    return false;
  }
}
