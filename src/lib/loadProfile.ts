/**
 * Load and list generated viewer profiles from data/profiles/
 */

import type { SavedProfilePayload } from "./saveProfile";

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

/**
 * List all profiles.
 * Returns empty array if endpoint is not available (e.g. production build).
 */
export async function listProfiles(): Promise<ProfileSummary[]> {
  try {
    const res = await fetch("/api/list-profiles");
    if (!res.ok) return [];
    const data: ListProfilesResponse = await res.json();
    return data.profiles || [];
  } catch {
    return [];
  }
}

/**
 * Load a specific profile by ID.
 * Returns null if profile not found or endpoint is not available.
 */
export async function loadProfile(
  id: string
): Promise<SavedProfilePayload | null> {
  try {
    const res = await fetch(`/api/load-profile?id=${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const data: LoadProfileResponse = await res.json();
    return data.profile || null;
  } catch {
    return null;
  }
}
