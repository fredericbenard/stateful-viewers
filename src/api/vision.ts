/**
 * Unified vision API - routes to Ollama (LLaVA-1.6 7B), OpenAI (GPT-5.2), Gemini, or Anthropic (Claude Sonnet 4.5)
 */

import { reflectOnImage as reflectOllama } from "./ollama";
import { reflectOnImageOpenAI } from "./openai";
import { reflectOnImageGemini } from "./gemini";
import { reflectOnImageAnthropic } from "./anthropic";
import type { ReflectionResponse } from "./ollama";
import type { UiLocale } from "../i18n";

export type VisionProvider = "ollama" | "openai" | "gemini" | "anthropic";

export async function reflectOnImage(
  provider: VisionProvider,
  imageUrl: string,
  prompt: string,
  previousState?: string,
  caption?: string,
  locale: UiLocale = "en"
): Promise<ReflectionResponse> {
  if (provider === "openai") {
    return reflectOnImageOpenAI(imageUrl, prompt, previousState, caption, locale);
  }
  if (provider === "gemini") {
    return reflectOnImageGemini(imageUrl, prompt, previousState, caption, locale);
  }
  if (provider === "anthropic") {
    return reflectOnImageAnthropic(imageUrl, prompt, previousState, caption, locale);
  }
  return reflectOllama(imageUrl, prompt, previousState, caption, locale);
}
