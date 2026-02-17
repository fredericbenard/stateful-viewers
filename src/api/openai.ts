/**
 * OpenAI API client for vision (GPT-5.2)
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

const OPENAI_BASE = "/api/openai";

export interface ReflectionResponse {
  content: string;
  error?: string;
}

/**
 * Call GPT-5.2 to reflect on an image
 */
export async function reflectOnImageOpenAI(
  imageUrl: string,
  prompt: string,
  previousState?: string,
  caption?: string,
  locale: UiLocale = "en"
): Promise<ReflectionResponse> {
  const base64 = await imageUrlToBase64(imageUrl);
  const mimeType = imageUrl.endsWith(".png") ? "image/png" : "image/jpeg";
  const dataUrl = `data:${mimeType};base64,${base64}`;

  let userContent = prompt;
  if (caption) {
    userContent = `${userContent}\n\nThe image caption: "${caption}"`;
  }
  if (previousState) {
    userContent = `${userContent}\n\nYour current internal state (carry this into your response):\n${previousState}`;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getHeadersForProvider("openai"),
  };
  try {
    const response = await fetchWithTimeout(`${OPENAI_BASE}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "gpt-5.2",
        messages: [
          {
            role: "system",
            content: REFLECTION_SYSTEM_INSTRUCTION,
          },
          {
            role: "user",
            content: [
              { type: "text", text: userContent },
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
        max_completion_tokens: 2048,
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
      }
      return {
        content: "",
        error:
          err ||
          apiHttpStatusErrorMessage(locale, "OpenAI", response.status, "Try again."),
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";
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
