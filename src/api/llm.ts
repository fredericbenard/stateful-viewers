/**
 * Text-only LLM API for profile and reflection style generation
 * Routes to OpenAI, Ollama, Gemini, or Anthropic (no vision)
 */

import type { VisionProvider } from "./vision";
import { generateTextGemini } from "./gemini";
import { generateTextAnthropic } from "./anthropic";
import { getHeadersForProvider } from "../lib/apiKeys";
import { fetchWithTimeout, API_TIMEOUTS } from "../lib/fetchWithTimeout";
import type { UiLocale } from "../i18n";
import {
  apiHttpStatusErrorMessage,
  apiNetworkUnreachableMessage,
  apiTimeoutMessage,
} from "../lib/apiErrorMessages";

const OPENAI_BASE = "/api/openai";
const OLLAMA_BASE = "/api/ollama";

export interface TextCompletionResponse {
  content: string;
  error?: string;
}

export async function generateText(
  provider: VisionProvider,
  systemPrompt: string,
  userPrompt: string,
  locale: UiLocale = "en"
): Promise<TextCompletionResponse> {
  if (provider === "openai") {
    return generateTextOpenAI(systemPrompt, userPrompt, locale);
  }
  if (provider === "gemini") {
    return generateTextGemini(systemPrompt, userPrompt, locale);
  }
  if (provider === "anthropic") {
    return generateTextAnthropic(systemPrompt, userPrompt, locale);
  }
  return generateTextOllama(systemPrompt, userPrompt, locale);
}

async function generateTextOpenAI(
  systemPrompt: string,
  userPrompt: string,
  locale: UiLocale
): Promise<TextCompletionResponse> {
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
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_completion_tokens: 1024,
        temperature: 0.95,
      }),
      timeoutMs: API_TIMEOUTS.TEXT_MS,
    });

    if (!response.ok) {
      const err = await response.text();
      const msg = response.status === 504 && err.startsWith("{") ? (() => { try { const o = JSON.parse(err); return o?.error ?? err; } catch { return err; } })() : err;
      return {
        content: "",
        error: msg || apiHttpStatusErrorMessage(locale, "OpenAI", response.status, "Try again."),
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    return { content };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { content: "", error: apiTimeoutMessage(locale, API_TIMEOUTS.TEXT_MS / 1000) };
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Failed to fetch") {
      return { content: "", error: apiNetworkUnreachableMessage(locale) };
    }
    return { content: "", error: msg };
  }
}

async function generateTextOllama(
  systemPrompt: string,
  userPrompt: string,
  locale: UiLocale
): Promise<TextCompletionResponse> {
  try {
    const response = await fetchWithTimeout(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.1:8b-instruct-q5_K_M",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
        options: { temperature: 0.95 },
      }),
      timeoutMs: API_TIMEOUTS.TEXT_MS,
    });

    if (!response.ok) {
      const err = await response.text();
      return {
        content: "",
        error: apiHttpStatusErrorMessage(locale, "Ollama", response.status, err),
      };
    }

    const data = await response.json();
    return {
      content: data.message?.content ?? "",
    };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { content: "", error: apiTimeoutMessage(locale, API_TIMEOUTS.TEXT_MS / 1000) };
    }
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Failed to fetch") {
      return { content: "", error: apiNetworkUnreachableMessage(locale) };
    }
    return { content: "", error: msg };
  }
}
