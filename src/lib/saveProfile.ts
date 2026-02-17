/**
 * Save generated viewer profile + reflection style to data/profiles/<uuid>.json
 */

import type { VisionProvider } from "../api/vision";
import { PROFILE_VARIABILITY_HINTS, type OutputLocale } from "../prompts";
import { getModelLabels } from "./saveReflectionSession";

export interface SavedProfilePayload {
  id: string;
  generatedAt: string;
  /** Locale used for generated text fields (profile/style/label). */
  locale?: OutputLocale;
  /** Provider key for the LLM (profile/style/label generation) */
  llm: VisionProvider;
  /** Human-readable name of the LLM */
  llmModelLabel: string;
  /** @deprecated Use llmModelLabel instead. Kept for backward compatibility. */
  modelLabel?: string;
  /** Index of the variability hint used (0-based) for profile generation */
  variabilityHintIndex?: number;
  /** Variability hint text used (for reference) */
  variabilityHint?: string;
  /** Concise label (2-5 words) summarizing the profile */
  label?: string;
  profile: string;
  reflectionStyle: string;
  /** Raw LLM output for profile (before cleaning) */
  rawProfile?: string;
  /** Raw LLM output for reflection style (before cleaning) */
  rawReflectionStyle?: string;
  /** Raw LLM output for label (before cleaning) */
  rawLabel?: string;
}

export interface SaveProfileParams {
  locale: OutputLocale;
  profileUserPrompt: string;
  profileRaw: string;
  profileCleaned: string;
  reflectionStyleUserMessage: string;
  styleRaw: string;
  styleCleaned: string;
  labelRaw?: string;
  labelCleaned?: string;
  provider: VisionProvider;
}

/**
 * Extract which variability hint was used from the profile user prompt.
 * Returns the hint index (0-based) and hint text, or null if not found.
 */
function extractVariabilityHint(profileUserPrompt: string): { index: number; hint: string } | null {
  for (let i = 0; i < PROFILE_VARIABILITY_HINTS.length; i++) {
    if (profileUserPrompt.includes(PROFILE_VARIABILITY_HINTS[i])) {
      return { index: i, hint: PROFILE_VARIABILITY_HINTS[i] };
    }
  }
  return null;
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
  const variabilityHint = extractVariabilityHint(params.profileUserPrompt);
  const labels = getModelLabels(params.provider);
  const payload: SavedProfilePayload = {
    id,
    generatedAt: new Date().toISOString(),
    locale: params.locale,
    llm: params.provider,
    llmModelLabel: labels.llm,
    modelLabel: labels.llm, // Backward compatibility
    ...(variabilityHint && {
      variabilityHintIndex: variabilityHint.index,
      variabilityHint: variabilityHint.hint,
    }),
    ...(params.labelCleaned && {
      label: params.labelCleaned,
      rawLabel: params.labelRaw,
    }),
    profile: params.profileCleaned,
    reflectionStyle: params.styleCleaned,
    rawProfile: params.profileRaw,
    rawReflectionStyle: params.styleRaw,
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
