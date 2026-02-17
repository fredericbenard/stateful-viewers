/**
 * Anthropic API client for vision and text (Claude Sonnet 4.5)
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
  apiTimeoutMessage,
} from "../lib/apiErrorMessages";

const ANTHROPIC_BASE = "/api/anthropic";
const MODEL = "claude-sonnet-4-5-20250929";

// System instruction imported from prompts.ts

export interface ReflectionResponse {
  content: string;
  error?: string;
}

/**
 * Call Claude Sonnet 4.5 to reflect on an image
 */
export async function reflectOnImageAnthropic(
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
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
    ...getHeadersForProvider("anthropic"),
  };
  try {
    const response = await fetchWithTimeout(`${ANTHROPIC_BASE}/v1/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: REFLECTION_SYSTEM_INSTRUCTION,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mimeType,
                  data: base64,
                },
              },
              { type: "text", text: userText },
            ],
          },
        ],
      }),
      timeoutMs: API_TIMEOUTS.REFLECTION_MS,
    });

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
        err = apiHttpStatusErrorMessage(locale, "Anthropic", response.status, err);
      }
      return { content: "", error: err };
    }

    const data = await response.json();
    const content = extractTextFromMessage(data);
    return { content };
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
 * Call Claude Sonnet 4.5 for text-only generation (profile, reflection style)
 */
export async function generateTextAnthropic(
  systemPrompt: string,
  userPrompt: string,
  locale: UiLocale = "en"
): Promise<TextCompletionResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
    ...getHeadersForProvider("anthropic"),
  };
  try {
    const response = await fetchWithTimeout(`${ANTHROPIC_BASE}/v1/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        temperature: 0.95,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
      timeoutMs: API_TIMEOUTS.TEXT_MS,
    });

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
        err = apiHttpStatusErrorMessage(locale, "Anthropic", response.status, err);
      }
      return { content: "", error: err };
    }

    const data = await response.json();
    const content = extractTextFromMessage(data);
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

function extractTextFromMessage(data: Record<string, unknown>): string {
  const content = data.content as { type: string; text?: string }[] | undefined;
  if (!Array.isArray(content)) return "";
  const textBlock = content.find((b) => b.type === "text" && b.text);
  return textBlock && typeof textBlock.text === "string" ? textBlock.text : "";
}
