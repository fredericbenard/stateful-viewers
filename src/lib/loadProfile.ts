/**
 * Load and list generated viewer profiles from data/profiles/
 */

import type { SavedProfilePayload } from "./saveProfile";
import { getLocalArtifact, listLocalArtifacts } from "./localArtifactStore";
import { LOCAL_PROFILES_KEY } from "./saveProfile";

export interface ProfileSummary {
  id: string;
  generatedAt: string;
  locale?: string;
  llm: string;
  llmModelLabel: string;
  /** @deprecated Use llmModelLabel instead. Kept for backward compatibility. */
  modelLabel?: string;
  label?: string;
}

export interface ListProfilesResponse {
  profiles: ProfileSummary[];
}

export interface LoadProfileResponse {
  profile: SavedProfilePayload;
}

function toSummary(p: SavedProfilePayload): ProfileSummary {
  return {
    id: p.id,
    generatedAt: p.generatedAt,
    locale: p.locale,
    llm: p.llm,
    llmModelLabel: p.llmModelLabel || p.modelLabel || p.llm,
    modelLabel: p.modelLabel,
    label: p.label,
  };
}

/**
 * List all profiles.
 * Returns empty array if endpoint is not available (e.g. production build).
 */
export async function listProfiles(): Promise<ProfileSummary[]> {
  const local = listLocalArtifacts<SavedProfilePayload>(LOCAL_PROFILES_KEY).map(toSummary);
  try {
    const res = await fetch("/api/list-profiles");
    if (!res.ok) return local;
    const data: ListProfilesResponse = await res.json();
    const map = new Map<string, ProfileSummary>();
    (data.profiles || []).forEach((p) => map.set(p.id, p));
    local.forEach((p) => map.set(p.id, p));
    return Array.from(map.values());
  } catch {
    return local;
  }
}

/**
 * Load a specific profile by ID.
 * Returns null if profile not found or endpoint is not available.
 */
export async function loadProfile(
  id: string
): Promise<SavedProfilePayload | null> {
  const local = getLocalArtifact<SavedProfilePayload>(LOCAL_PROFILES_KEY, id);
  if (local) return local;
  try {
    const res = await fetch(`/api/load-profile?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const data: LoadProfileResponse = await res.json();
    return data.profile || null;
  } catch {
    return null;
  }
}
