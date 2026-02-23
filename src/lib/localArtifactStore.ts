/**
 * Per-browser artifact storage.
 *
 * We use localStorage to avoid cross-user sharing on hosts with ephemeral shared disks
 * (e.g. Hugging Face Spaces free tier). This keeps user-created artifacts private to
 * the browser, while still allowing the server to serve built-in/public artifacts.
 */
type StoreV1<T> = {
  v: 1;
  items: Record<string, T>;
};

function readStore<T>(key: string): StoreV1<T> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { v: 1, items: {} };
    const parsed = JSON.parse(raw) as Partial<StoreV1<T>>;
    if (parsed?.v !== 1 || !parsed.items || typeof parsed.items !== "object") {
      return { v: 1, items: {} };
    }
    return { v: 1, items: parsed.items as Record<string, T> };
  } catch {
    return { v: 1, items: {} };
  }
}

function writeStore<T>(key: string, store: StoreV1<T>): void {
  try {
    localStorage.setItem(key, JSON.stringify(store));
  } catch {
    // Best-effort: if storage quota is exceeded or storage is unavailable, just skip.
  }
}

export function upsertLocalArtifact<T extends { id: string }>(key: string, value: T): void {
  const store = readStore<T>(key);
  store.items[value.id] = value;
  writeStore(key, store);
}

export function getLocalArtifact<T>(key: string, id: string): T | null {
  const store = readStore<T>(key);
  return (store.items as Record<string, T>)[id] ?? null;
}

export function listLocalArtifacts<T extends { id: string }>(key: string): T[] {
  const store = readStore<T>(key);
  return Object.values(store.items);
}

