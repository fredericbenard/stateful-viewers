/**
 * Save generated reflection style to data/styles/<uuid>.json
 */

import type { VisionProvider } from "../api/vision";
import type { OutputLocale } from "../prompts";
import { getModelLabels } from "./saveReflectionSession";

export interface SavedStylePayload {
  id: string;
  generatedAt: string;
  /** Locale used for generated text fields (style). */
  locale?: OutputLocale;
  /** Provider key for the LLM (style generation) */
  llm: VisionProvider;
  /** Human-readable name of the LLM */
  llmModelLabel: string;
  /** @deprecated Use llmModelLabel instead. Kept for backward compatibility. */
  modelLabel?: string;
  /** Concise label (2-5 words) summarizing the style */
  label?: string;
  reflectionStyle: string;
  /** Short LLM-summarized description of the reflective style (user-facing). */
  reflectionStyleShort?: string;
  /** Raw LLM output for reflection style (before cleaning) */
  rawReflectionStyle?: string;
}

export interface SaveStyleParams {
  locale: OutputLocale;
  styleRaw: string;
  styleCleaned: string;
  reflectionStyleShort?: string;
  labelCleaned?: string;
  provider: VisionProvider;
}

/**
 * Builds the payload and POSTs to the dev server to save to data/styles/<id>.json.
 * No-op if the endpoint is not available (e.g. production build).
 * Returns the generated id when save succeeds.
 */
export async function saveGeneratedStyle(
  params: SaveStyleParams
): Promise<string | null> {
  const id = crypto.randomUUID();
  const labels = getModelLabels(params.provider);
  const payload: SavedStylePayload = {
    id,
    generatedAt: new Date().toISOString(),
    locale: params.locale,
    llm: params.provider,
    llmModelLabel: labels.llm,
    modelLabel: labels.llm,
    ...(params.labelCleaned && { label: params.labelCleaned }),
    reflectionStyle: params.styleCleaned,
    ...(params.reflectionStyleShort && { reflectionStyleShort: params.reflectionStyleShort }),
    rawReflectionStyle: params.styleRaw,
  };

  try {
    const res = await fetch("/api/save-style", {
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

