/**
 * Save generated initial internal state to data/states/<uuid>.json
 */

import type { VisionProvider } from "../api/vision";
import type { OutputLocale } from "../prompts";
import { isHfSpace } from "./isHfSpace";
import { upsertLocalArtifact } from "./localArtifactStore";
import { getModelLabels } from "./saveReflectionSession";

export interface SavedStatePayload {
  id: string;
  generatedAt: string;
  /** Locale used for generated text fields (initial state). */
  locale?: OutputLocale;
  /** Provider key for the LLM (state generation) */
  llm: VisionProvider;
  /** Human-readable name of the LLM */
  llmModelLabel: string;
  /** @deprecated Use llmModelLabel instead. Kept for backward compatibility. */
  modelLabel?: string;
  /** Concise label (2-5 words) summarizing the arrival state */
  label?: string;
  /** Initial internal state (v2: same 7-dimension schema as evolving state). */
  initialState: string;
  /** Short LLM-summarized description of the initial state (user-facing). */
  initialStateShort?: string;
  /** Raw LLM output for initial state (before cleaning) */
  rawInitialState?: string;
}

export interface SaveStateParams {
  locale: OutputLocale;
  initialStateRaw: string;
  initialStateCleaned: string;
  initialStateShort?: string;
  labelCleaned?: string;
  provider: VisionProvider;
}

export const LOCAL_STATES_KEY = "stateful-viewers:artifacts:v1:states";

/**
 * Builds the payload and POSTs to the dev server to save to data/states/<id>.json.
 * No-op if the endpoint is not available (e.g. production build).
 * Returns the generated id when save succeeds.
 */
export async function saveGeneratedState(
  params: SaveStateParams
): Promise<string | null> {
  const id = crypto.randomUUID();
  const labels = getModelLabels(params.provider);
  const payload: SavedStatePayload = {
    id,
    generatedAt: new Date().toISOString(),
    locale: params.locale,
    llm: params.provider,
    llmModelLabel: labels.llm,
    modelLabel: labels.llm,
    ...(params.labelCleaned && { label: params.labelCleaned }),
    initialState: params.initialStateCleaned,
    ...(params.initialStateShort && { initialStateShort: params.initialStateShort }),
    rawInitialState: params.initialStateRaw,
  };

  // Always save locally so artifacts are per-browser.
  upsertLocalArtifact<SavedStatePayload>(LOCAL_STATES_KEY, payload);

  try {
    if (isHfSpace()) return id;
    const res = await fetch("/api/save-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload, null, 2),
    });
    return id;
  } catch {
    return id;
  }
}

