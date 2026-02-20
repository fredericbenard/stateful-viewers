/**
 * Save generated viewer profile + reflection style + initial state to data/profiles/<uuid>.json
 * v2: profiles include profile, style, and initial state as independent stages,
 * plus short (LLM-summarized) descriptions for user-facing display.
 */

import type { VisionProvider } from "../api/vision";
import type { OutputLocale } from "../prompts";
import { getModelLabels } from "./saveReflectionSession";

export interface SavedProfilePayload {
  id: string;
  generatedAt: string;
  /** Locale used for generated text fields (profile/style/label/state). */
  locale?: OutputLocale;
  /** Provider key for the LLM (profile/style/label/state generation) */
  llm: VisionProvider;
  /** Human-readable name of the LLM */
  llmModelLabel: string;
  /** @deprecated Use llmModelLabel instead. Kept for backward compatibility. */
  modelLabel?: string;
  /** Concise label (2-5 words) summarizing the profile */
  label?: string;
  profile: string;
  /** Short LLM-summarized description of the profile (user-facing). */
  profileShort?: string;
  reflectionStyle: string;
  /** Short LLM-summarized description of the reflective style (user-facing). */
  reflectionStyleShort?: string;
  /** Initial internal state (v2: same 7-dimension schema as evolving state). */
  initialState?: string;
  /** Short LLM-summarized description of the initial state (user-facing). */
  initialStateShort?: string;
  /** Raw LLM output for profile (before cleaning) */
  rawProfile?: string;
  /** Raw LLM output for reflection style (before cleaning) */
  rawReflectionStyle?: string;
  /** Raw LLM output for label (before cleaning) */
  rawLabel?: string;
  /** Raw LLM output for initial state (before cleaning) */
  rawInitialState?: string;
}

export interface SaveProfileParams {
  locale: OutputLocale;
  profileRaw: string;
  profileCleaned: string;
  styleRaw: string;
  styleCleaned: string;
  initialStateRaw: string;
  initialStateCleaned: string;
  profileShort?: string;
  reflectionStyleShort?: string;
  initialStateShort?: string;
  labelRaw?: string;
  labelCleaned?: string;
  provider: VisionProvider;
}

/**
 * Builds the payload and POSTs to the dev server to save to data/profiles/<id>.json.
 * No-op if the endpoint is not available (e.g. production build).
 * Returns the generated id when save succeeds.
 */
export async function saveGeneratedProfile(
  params: SaveProfileParams
): Promise<string | null> {
  const id = crypto.randomUUID();
  const labels = getModelLabels(params.provider);
  const payload: SavedProfilePayload = {
    id,
    generatedAt: new Date().toISOString(),
    locale: params.locale,
    llm: params.provider,
    llmModelLabel: labels.llm,
    modelLabel: labels.llm,
    ...(params.labelCleaned && {
      label: params.labelCleaned,
      rawLabel: params.labelRaw,
    }),
    profile: params.profileCleaned,
    ...(params.profileShort && { profileShort: params.profileShort }),
    reflectionStyle: params.styleCleaned,
    ...(params.reflectionStyleShort && { reflectionStyleShort: params.reflectionStyleShort }),
    initialState: params.initialStateCleaned,
    ...(params.initialStateShort && { initialStateShort: params.initialStateShort }),
    rawProfile: params.profileRaw,
    rawReflectionStyle: params.styleRaw,
    rawInitialState: params.initialStateRaw,
  };

  try {
    const res = await fetch("/api/save-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload, null, 2),
    });
    if (!res.ok) return null;
    return id;
  } catch {
    return null;
  }
}
