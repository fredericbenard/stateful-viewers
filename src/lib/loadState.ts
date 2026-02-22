/**
 * Load and list generated initial states from data/states/
 */

import type { SavedStatePayload } from "./saveState";

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

/**
 * List all states.
 * Returns empty array if endpoint is not available (e.g. production build).
 */
export async function listStates(): Promise<StateSummary[]> {
  try {
    const res = await fetch("/api/list-states");
    if (!res.ok) return [];
    const data: ListStatesResponse = await res.json();
    return data.states || [];
  } catch {
    return [];
  }
}

/**
 * Load a specific state by ID.
 * Returns null if not found or endpoint is not available.
 */
export async function loadState(id: string): Promise<SavedStatePayload | null> {
  try {
    const res = await fetch(`/api/load-state?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const data: LoadStateResponse = await res.json();
    return data.state || null;
  } catch {
    return null;
  }
}

