import { en } from "./en";
import { fr } from "./fr";

export type UiLocale = "en" | "fr";

const DICTS = { en, fr } satisfies Record<UiLocale, unknown>;

function getPath(obj: unknown, key: string): unknown {
  let acc: unknown = obj;
  for (const part of key.split(".")) {
    if (acc && typeof acc === "object" && part in acc) {
      acc = (acc as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return acc;
}

export function t(
  locale: UiLocale,
  key: string,
  params?: Record<string, string | number>
): string {
  const fromLocale = getPath(DICTS[locale], key);
  const fromEn = getPath(DICTS.en, key);
  const raw = (fromLocale ?? fromEn ?? key) as string;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
}

