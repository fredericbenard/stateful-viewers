const HEALTH_TIMEOUT_MS = 5_000;

/**
 * Returns true if the app API is reachable for POST (same method as profile generation).
 * Uses POST /api/health so we verify POST requests work on this host (e.g. HF Spaces).
 */
export async function checkApiHealth(): Promise<boolean> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch("/api/health", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ping: true }),
      signal: controller.signal,
    });
    clearTimeout(id);
    if (!res.ok) return false;
    const data = await res.json();
    return data?.ok === true;
  } catch {
    clearTimeout(id);
    return false;
  }
}
