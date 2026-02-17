/**
 * Gemini API client for vision and text
 * Proxied through Vite; API key from user (BYOK) headers or server env
 */

import { imageUrlToBase64 } from "./imageUtils";
import { REFLECTION_SYSTEM_INSTRUCTION } from "../prompts";
import { getHeadersForProvider } from "../lib/apiKeys";
import { fetchWithTimeout, API_TIMEOUTS } from "../lib/fetchWithTimeout";
import type { UiLocale } from "../i18n";
import {
  apiHttpStatusErrorMessage,
  apiNetworkUnreachableMessage,
  apiNoContentReturnedMessage,
  apiRetriesExhaustedHint,
  apiTimeoutMessage,
} from "../lib/apiErrorMessages";

const GEMINI_BASE = "/api/gemini";
const MODEL = "gemini-3-pro-preview";

const RETRYABLE_STATUS = [429, 500, 503]; // 500 = Internal Server Error (often transient)
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  options: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const { timeoutMs, ...rest } = options;
  const fetchOptions = { ...rest, timeoutMs };
  let lastResponse: Response | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    lastResponse = await fetchWithTimeout(url, fetchOptions);
    if (!RETRYABLE_STATUS.includes(lastResponse.status) || attempt === MAX_RETRIES - 1) {
      return lastResponse;
    }
    const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
    await sleep(delay);
  }
  return lastResponse!;
}

export interface ReflectionResponse {
  content: string;
  error?: string;
}

// System instruction imported from prompts.ts

/**
 * Call Gemini to reflect on an image
 */
export async function reflectOnImageGemini(
  imageUrl: string,
  prompt: string,
  previousState?: string,
  caption?: string,
  locale: UiLocale = "en"
): Promise<ReflectionResponse> {
  const base64 = await imageUrlToBase64(imageUrl);
  const mimeType = imageUrl.endsWith(".png") ? "image/png" : "image/jpeg";

  let userText = prompt;
  if (caption) {
    userText = `${userText}\n\nThe image caption: "${caption}"`;
  }
  if (previousState) {
    userText = `${userText}\n\nYour current internal state (carry this into your response):\n${previousState}`;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getHeadersForProvider("gemini"),
  };
  try {
    const response = await fetchWithRetry(
      `${GEMINI_BASE}/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: REFLECTION_SYSTEM_INSTRUCTION }],
          },
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64,
                  },
                },
                { text: userText },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: 4096,
            thinkingConfig: {
              thinkingBudget: 2048,
            },
          },
        }),
        timeoutMs: API_TIMEOUTS.REFLECTION_MS,
      }
    );

    if (!response.ok) {
      let err = await response.text();
      if (response.status === 504 && err.startsWith("{")) {
        try {
          const o = JSON.parse(err);
          if (o?.error) err = o.error;
        } catch {
          // Ignore parse errors and fall back to raw upstream message.
        }
      } else {
        const hint = [429, 500, 503].includes(response.status)
          ? apiRetriesExhaustedHint(locale)
          : "";
        err = apiHttpStatusErrorMessage(locale, "Gemini", response.status, err, hint);
      }
      return { content: "", error: err };
    }

    const data = await response.json();
    const text = extractTextFromGeminiResponse(data);
    return { content: text };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return {
        content: "",
        error: apiTimeoutMessage(locale, API_TIMEOUTS.REFLECTION_MS / 1000),
      };
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Failed to fetch") {
      return { content: "", error: apiNetworkUnreachableMessage(locale) };
    }
    return { content: "", error: msg };
  }
}

export interface TextCompletionResponse {
  content: string;
  error?: string;
}

/**
 * Call Gemini for text-only generation (profile, reflection style)
 */
export async function generateTextGemini(
  systemPrompt: string,
  userPrompt: string,
  locale: UiLocale = "en"
): Promise<TextCompletionResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getHeadersForProvider("gemini"),
  };
  try {
    const response = await fetchWithRetry(
      `${GEMINI_BASE}/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            {
              parts: [{ text: userPrompt }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.95,
            thinkingConfig: {
              thinkingBudget: 2048,
            },
          },
        }),
        timeoutMs: API_TIMEOUTS.TEXT_MS,
      }
    );

    if (!response.ok) {
      let err = await response.text();
      if (response.status === 504 && err.startsWith("{")) {
        try {
          const o = JSON.parse(err);
          if (o?.error) err = o.error;
        } catch {
          // Ignore parse errors and fall back to raw upstream message.
        }
      } else {
        const hint = [429, 500, 503].includes(response.status)
          ? apiRetriesExhaustedHint(locale)
          : "";
        err = apiHttpStatusErrorMessage(locale, "Gemini", response.status, err, hint);
      }
      return { content: "", error: err };
    }

    const data = await response.json();
    const content = extractTextFromGeminiResponse(data);
    if (!content) {
      const pf = data.promptFeedback as { blockReason?: string; block_reason?: string } | undefined;
      const blockReason = pf?.blockReason ?? pf?.block_reason;
      const hint = blockReason ? ` (blocked: ${blockReason})` : "";
      if (import.meta.env.DEV) {
        console.warn("[Gemini] Empty content response:", data);
      }
      return {
        content: "",
        error: apiNoContentReturnedMessage(locale, "Gemini", hint),
      };
    }
    return { content };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return {
        content: "",
        error: apiTimeoutMessage(locale, API_TIMEOUTS.TEXT_MS / 1000),
      };
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Failed to fetch") {
      return { content: "", error: apiNetworkUnreachableMessage(locale) };
    }
    return { content: "", error: msg };
  }
}

/**
 * Extract text from Gemini API response.
 * Gemini 2.5 Pro uses thinking by default; response may have multiple parts.
 * We want the actual answer (non-thought parts). Fall back to all text if structure differs.
 */
function extractTextFromGeminiResponse(data: Record<string, unknown>): string {
  const candidates = data.candidates as unknown[] | undefined;
  const candidate = candidates?.[0] as Record<string, unknown> | undefined;
  if (!candidate) return "";

  const content = candidate.content as { parts?: unknown[] } | undefined;
  const parts = content?.parts;
  if (!Array.isArray(parts)) return "";

  const textParts: string[] = [];
  for (const part of parts) {
    const p = part as { text?: string; thought?: boolean };
    const text = p.text;
    if (!text || typeof text !== "string") continue;
    if (p.thought) continue; // Skip thinking blocks
    textParts.push(text);
  }
  const result = textParts.join("").trim();
  if (result) return result;
  // Fallback: concat all text from all parts (covers different API formats)
  return parts
    .map((p) => (p as Record<string, unknown>).text as string | undefined)
    .filter((t): t is string => typeof t === "string")
    .join("")
    .trim();
}
