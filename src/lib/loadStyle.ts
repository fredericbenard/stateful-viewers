/**
 * Load and list generated reflection styles from data/styles/
 */

import type { SavedStylePayload } from "./saveStyle";
import { getLocalArtifact, listLocalArtifacts } from "./localArtifactStore";
import { LOCAL_STYLES_KEY } from "./saveStyle";

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

function toSummary(s: SavedStylePayload): StyleSummary {
  return {
    id: s.id,
    generatedAt: s.generatedAt,
    locale: s.locale,
    llm: s.llm,
    llmModelLabel: s.llmModelLabel || s.modelLabel || s.llm,
    modelLabel: s.modelLabel,
    label: s.label,
    reflectionStyleShort: s.reflectionStyleShort,
  };
}

/**
 * List all styles.
 * Returns empty array if endpoint is not available (e.g. production build).
 */
export async function listStyles(): Promise<StyleSummary[]> {
  const local = listLocalArtifacts<SavedStylePayload>(LOCAL_STYLES_KEY).map(toSummary);
  try {
    const res = await fetch("/api/list-styles");
    if (!res.ok) return local;
    const data: ListStylesResponse = await res.json();
    const map = new Map<string, StyleSummary>();
    (data.styles || []).forEach((s) => map.set(s.id, s));
    local.forEach((s) => map.set(s.id, s));
    return Array.from(map.values());
  } catch {
    return local;
  }
}

/**
 * Load a specific style by ID.
 * Returns null if not found or endpoint is not available.
 */
export async function loadStyle(id: string): Promise<SavedStylePayload | null> {
  const local = getLocalArtifact<SavedStylePayload>(LOCAL_STYLES_KEY, id);
  if (local) return local;
  try {
    const res = await fetch(`/api/load-style?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const data: LoadStyleResponse = await res.json();
    return data.style || null;
  } catch {
    return null;
  }
}

