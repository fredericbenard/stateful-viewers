/**
 * Save generated viewer profile to data/profiles/<uuid>.json
 */

import type { VisionProvider } from "../api/vision";
import type { OutputLocale } from "../prompts";
import { isHfSpace } from "./isHfSpace";
import { upsertLocalArtifact } from "./localArtifactStore";
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
  /** Raw LLM output for profile (before cleaning) */
  rawProfile?: string;
  /**
   * Legacy fields kept for backward compatibility with older combined profile payloads.
   * New app versions persist these as separate artifacts in data/styles and data/states.
   */
  reflectionStyle?: string;
  reflectionStyleShort?: string;
  initialState?: string;
  initialStateShort?: string;
  rawReflectionStyle?: string;
  rawInitialState?: string;
}

export interface SaveProfileParams {
  locale: OutputLocale;
  profileRaw: string;
  profileCleaned: string;
  profileShort?: string;
  labelCleaned?: string;
  provider: VisionProvider;
}

export const LOCAL_PROFILES_KEY = "stateful-viewers:artifacts:v1:profiles";

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
    }),
    profile: params.profileCleaned,
    ...(params.profileShort && { profileShort: params.profileShort }),
    rawProfile: params.profileRaw,
  };

  // Always save locally so artifacts are per-browser (prevents cross-user sharing on HF).
  upsertLocalArtifact<SavedProfilePayload>(LOCAL_PROFILES_KEY, payload);

  try {
    // On HF Spaces, avoid writing user artifacts to the shared ephemeral container disk.
    if (isHfSpace()) return id;
    await fetch("/api/save-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload, null, 2),
    });
    return id;
  } catch {
    return id;
  }
}
