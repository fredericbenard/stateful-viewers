/**
 * Load and list generated initial states from data/states/
 */

import type { SavedStatePayload } from "./saveState";
import { getLocalArtifact, listLocalArtifacts } from "./localArtifactStore";
import { LOCAL_STATES_KEY } from "./saveState";

export interface StateSummary {
  id: string;
  generatedAt: string;
  locale?: string;
  llm: string;
  llmModelLabel: string;
  /** @deprecated Use llmModelLabel instead. Kept for backward compatibility. */
  modelLabel?: string;
  label?: string;
  initialStateShort?: string;
}

export interface ListStatesResponse {
  states: StateSummary[];
}

export interface LoadStateResponse {
  state: SavedStatePayload;
}

function toSummary(s: SavedStatePayload): StateSummary {
  return {
    id: s.id,
    generatedAt: s.generatedAt,
    locale: s.locale,
    llm: s.llm,
    llmModelLabel: s.llmModelLabel || s.modelLabel || s.llm,
    modelLabel: s.modelLabel,
    label: s.label,
    initialStateShort: s.initialStateShort,
  };
}

/**
 * List all states.
 * Returns empty array if endpoint is not available (e.g. production build).
 */
export async function listStates(): Promise<StateSummary[]> {
  const local = listLocalArtifacts<SavedStatePayload>(LOCAL_STATES_KEY).map(toSummary);
  try {
    const res = await fetch("/api/list-states");
    if (!res.ok) return local;
    const data: ListStatesResponse = await res.json();
    const map = new Map<string, StateSummary>();
    (data.states || []).forEach((s) => map.set(s.id, s));
    local.forEach((s) => map.set(s.id, s));
    return Array.from(map.values());
  } catch {
    return local;
  }
}

/**
 * Load a specific state by ID.
 * Returns null if not found or endpoint is not available.
 */
export async function loadState(id: string): Promise<SavedStatePayload | null> {
  const local = getLocalArtifact<SavedStatePayload>(LOCAL_STATES_KEY, id);
  if (local) return local;
  try {
    const res = await fetch(`/api/load-state?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const data: LoadStateResponse = await res.json();
    return data.state || null;
  } catch {
    return null;
  }
}

