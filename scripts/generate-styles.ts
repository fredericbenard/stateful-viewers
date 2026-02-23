/**
 * Generate v2 public reflection styles (EN, optional FR)
 *
 * Run: npx tsx scripts/generate-styles.ts [count]
 *
 * Generates [count] EN styles (default 1) with parametric hints, then
 * optionally translates each to FR when `--translate-fr` is provided.
 *
 * Output format is style-only (no embedding in profiles):
 * - data/styles/public/<id>.json
 */

import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), ".env") });

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { callLlm, type LlmProvider } from "./lib/llm.ts";
import {
  REFLECTION_STYLE_PROMPT,
  PROFILE_LABEL_PROMPT,
  SHORT_DESCRIPTION_PROMPT,
  getReflectionStyleUserPrompt,
  getStyleLabelUserPrompt,
  getShortStyleUserPrompt,
  type OutputLocale,
} from "../src/prompts.ts";
import {
  cleanText,
  hasCliFlag,
  normalizeLabelSentenceCase,
  parseGenerateCli,
  TRANSLATE_EN_TO_FR_SYSTEM_PROMPT,
  sleep,
} from "./lib/publicGen.ts";

const PUBLIC_DIR = path.join(process.cwd(), "data", "styles", "public");

interface GeneratedStylePayload {
  id: string;
  generatedAt: string;
  locale: OutputLocale;
  llm: LlmProvider;
  llmModelLabel: string;
  label: string;
  reflectionStyle: string;
  reflectionStyleShort: string;
  rawReflectionStyle?: string;
}

async function generateOneStyle(
  locale: OutputLocale,
  llmProvider: LlmProvider,
  model: string,
  temperature: number,
  maxTokens: number,
  sourceStyle?: GeneratedStylePayload
): Promise<GeneratedStylePayload> {
  const callText = (
    systemPrompt: string,
    userPrompt: string,
    maxTokensOverride: number = maxTokens
  ): Promise<string> =>
    callLlm({
      provider: llmProvider,
      model,
      system: systemPrompt,
      user: userPrompt,
      maxTokens: maxTokensOverride,
      temperature,
    });

  let style: string;
  let rawReflectionStyle: string;
  let reflectionStyleShort: string;

  if (sourceStyle && locale === "fr") {
    console.log(`  Translating style to FR...`);
    rawReflectionStyle = await callText(
      TRANSLATE_EN_TO_FR_SYSTEM_PROMPT,
      sourceStyle.reflectionStyle
    );
    style = cleanText(rawReflectionStyle);
    console.log(`  Translating style short to FR...`);
    reflectionStyleShort = cleanText(
      await callText(TRANSLATE_EN_TO_FR_SYSTEM_PROMPT, sourceStyle.reflectionStyleShort)
    );
  } else {
    console.log(`  Generating style...`);
    rawReflectionStyle = await callText(
      REFLECTION_STYLE_PROMPT,
      getReflectionStyleUserPrompt(locale)
    );
    style = cleanText(rawReflectionStyle);
    console.log(`  Generating style short...`);
    reflectionStyleShort = cleanText(
      await callText(
        SHORT_DESCRIPTION_PROMPT,
        getShortStyleUserPrompt(style, locale),
        llmProvider === "gemini" ? maxTokens : 256
      )
    );
  }

  console.log(`  Generating label...`);
  const labelRaw = await callText(
    PROFILE_LABEL_PROMPT,
    getStyleLabelUserPrompt(style, locale),
    llmProvider === "gemini" ? maxTokens : 64
  );
  const label = normalizeLabelSentenceCase(cleanText(labelRaw));

  return {
    id: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    locale,
    llm: llmProvider,
    llmModelLabel: model,
    label,
    reflectionStyle: style,
    reflectionStyleShort,
    rawReflectionStyle,
  };
}

async function main() {
  const translateFr = hasCliFlag("--translate-fr");
  const { count, llmProvider, model, temperature, maxTokens } = parseGenerateCli({
    helpHeader: "Generate v2 public reflection styles (EN, optional FR).",
    usageLine:
      "npx tsx scripts/generate-styles.ts [count] [--translate-fr] [--llm <openai|anthropic|gemini|ollama>] [--model <model>] [--temperature <n>] [--max-tokens <n>]",
    examples: [
      "npx tsx scripts/generate-styles.ts",
      "npx tsx scripts/generate-styles.ts 2 --translate-fr",
      "npx tsx scripts/generate-styles.ts 8 --llm openai --model gpt-5.2",
      "npx tsx scripts/generate-styles.ts 6 --llm anthropic --model claude-sonnet-4-6",
      "npx tsx scripts/generate-styles.ts 6 --llm gemini --model gemini-3-pro-preview",
      "npx tsx scripts/generate-styles.ts 2 --llm ollama --model llama3.1:8b-instruct-q5_K_M",
      "npx tsx scripts/generate-styles.ts 4 --llm gemini --max-tokens 2048",
    ],
    defaultCount: 1,
  });

  console.log(
    `Generating ${count} v2 public styles (EN${translateFr ? " + FR" : ""}) with ${llmProvider}/${model} (temperature=${temperature}, maxTokens=${maxTokens})...\n`,
  );

  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  const enStyles: GeneratedStylePayload[] = [];

  for (let i = 0; i < count; i++) {
    console.log(`\n=== EN Style ${i + 1}/${count} ===`);
    const style = await generateOneStyle("en", llmProvider, model, temperature, maxTokens);
    enStyles.push(style);

    const filePath = path.join(PUBLIC_DIR, `${style.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(style, null, 2), "utf-8");
    console.log(`  Saved: ${filePath}`);
    console.log(`  Label: ${style.label}`);
    await sleep(250);
  }

  if (translateFr) {
    for (let i = 0; i < count; i++) {
      console.log(`\n=== FR Style ${i + 1}/${count} (translating from EN) ===`);
      const frStyle = await generateOneStyle(
        "fr",
        llmProvider,
        model,
        temperature,
        maxTokens,
        enStyles[i]
      );

      const filePath = path.join(PUBLIC_DIR, `${frStyle.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(frStyle, null, 2), "utf-8");
      console.log(`  Saved: ${filePath}`);
      console.log(`  Label: ${frStyle.label}`);
      await sleep(250);
    }
  }

  console.log(
    `\n\nDone! Generated ${count} EN${translateFr ? ` + ${count} FR` : ""} style(s) in data/styles/public/`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

