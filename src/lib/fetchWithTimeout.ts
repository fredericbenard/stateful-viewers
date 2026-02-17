/**
 * fetch with a timeout. Aborts the request after timeoutMs.
 * On timeout, the promise rejects with an Error whose name is "AbortError".
 * Callers should catch and return a user-friendly message (e.g. "Request timed out").
 */
const DEFAULT_TIMEOUT_MS = 60_000;

export function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { timeoutMs: timeoutMsFromInit, ...rest } = init ?? {};
  void timeoutMsFromInit;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(input, { ...rest, signal: controller.signal }).finally(() =>
    clearTimeout(id)
  );
}

/** Timeouts used by the app (ms). 90s so HF proxy + OpenAI round-trip can complete. */
export const API_TIMEOUTS = {
  /** Text-only: profile, reflection style, label, trajectory summary */
  TEXT_MS: 90_000,
  /** Vision + text: reflect on image */
  REFLECTION_MS: 90_000,
} as const;
