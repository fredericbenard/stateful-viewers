/**
 * User-provided API keys (bring your own key).
 * Stored in localStorage; sent to the backend in request headers so the proxy
 * can forward them to OpenAI, Google, Anthropic without storing keys on the server.
 */

import type { VisionProvider } from "../api/vision";

const STORAGE_KEY = "stateful-viewers:apiKeys";

export type ApiKeys = {
  openai?: string;
  google?: string;
  anthropic?: string;
};

const EMPTY: ApiKeys = {};

export function getApiKeys(): ApiKeys {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Record<string, string>;
    return {
      openai: parsed.openai?.trim() || undefined,
      google: parsed.google?.trim() || undefined,
      anthropic: parsed.anthropic?.trim() || undefined,
    };
  } catch {
    return EMPTY;
  }
}

export function setApiKeys(keys: ApiKeys): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch (e) {
    console.warn("Failed to save API keys to localStorage:", e);
  }
}

/** Header names the backend expects when forwarding to providers (BYOK). */
const HEADER_OPENAI = "X-OpenAI-API-Key";
const HEADER_GOOGLE = "X-Google-API-Key";
const HEADER_ANTHROPIC = "X-Anthropic-API-Key";

/**
 * Returns headers to add to fetch() for the given provider when the user has set a key.
 * Backend (and Vite proxy in dev) use these to forward to the provider instead of env.
 */
export function getHeadersForProvider(provider: VisionProvider): Record<string, string> {
  const keys = getApiKeys();
  if (provider === "openai" && keys.openai) {
    return { [HEADER_OPENAI]: keys.openai };
  }
  if (provider === "gemini" && keys.google) {
    return { [HEADER_GOOGLE]: keys.google };
  }
  if (provider === "anthropic" && keys.anthropic) {
    return { [HEADER_ANTHROPIC]: keys.anthropic };
  }
  return {};
}
