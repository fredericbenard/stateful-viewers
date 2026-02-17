/**
 * Ollama API client for vision (LLaVA-1.6)
 * Uses base64-encoded images as required by the REST API
 */

import { imageUrlToBase64 } from "./imageUtils";
import { REFLECTION_SYSTEM_INSTRUCTION } from "../prompts";
import type { UiLocale } from "../i18n";
import {
  apiHttpStatusErrorMessage,
  apiNetworkUnreachableMessage,
} from "../lib/apiErrorMessages";

const OLLAMA_BASE = "/api/ollama";

export interface ReflectionResponse {
  content: string;
  error?: string;
}

/**
 * Call LLaVA-1.6 to reflect on an image
 */
export async function reflectOnImage(
  imageUrl: string,
  prompt: string,
  previousState?: string,
  caption?: string,
  locale: UiLocale = "en"
): Promise<ReflectionResponse> {
  const base64 = await imageUrlToBase64(imageUrl);

  let userContent = prompt;
  if (caption) {
    userContent = `${userContent}\n\nThe image caption: "${caption}"`;
  }
  if (previousState) {
    userContent = `${userContent}\n\nYour current internal state (carry this into your response):\n${previousState}`;
  }

  let response: Response;
  try {
    response = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llava:7b",
        messages: [
          {
            role: "system",
            content: REFLECTION_SYSTEM_INSTRUCTION,
          },
          {
            role: "user",
            content: userContent,
            images: [base64],
          },
        ],
        stream: false,
      }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Failed to fetch") {
      return { content: "", error: apiNetworkUnreachableMessage(locale) };
    }
    return { content: "", error: msg };
  }

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
}
