/**
 * Load and list generated reflection styles from data/styles/
 */

import type { SavedStylePayload } from "./saveStyle";

export interface StyleSummary {
  id: string;
  generatedAt: string;
  locale?: string;
  llm: string;
  llmModelLabel: string;
  /** @deprecated Use llmModelLabel instead. Kept for backward compatibility. */
  modelLabel?: string;
  label?: string;
  reflectionStyleShort?: string;
}

export interface ListStylesResponse {
  styles: StyleSummary[];
}

export interface LoadStyleResponse {
  style: SavedStylePayload;
}

/**
 * List all styles.
 * Returns empty array if endpoint is not available (e.g. production build).
 */
export async function listStyles(): Promise<StyleSummary[]> {
  try {
    const res = await fetch("/api/list-styles");
    if (!res.ok) return [];
    const data: ListStylesResponse = await res.json();
    return data.styles || [];
  } catch {
    return [];
  }
}

/**
 * Load a specific style by ID.
 * Returns null if not found or endpoint is not available.
 */
export async function loadStyle(id: string): Promise<SavedStylePayload | null> {
  try {
    const res = await fetch(`/api/load-style?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const data: LoadStyleResponse = await res.json();
    return data.style || null;
  } catch {
    return null;
  }
}

