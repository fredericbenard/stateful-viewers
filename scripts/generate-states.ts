/**
 * Generate v2 public initial states (EN, optional FR)
 *
 * Run: npx tsx scripts/generate-states.ts [count]
 *
 * Generates [count] EN initial states (default 1) with parametric hints, then
 * optionally translates each to FR when `--translate-fr` is provided.
 *
 * Output format is state-only (no embedding in profiles):
 * - data/states/public/<id>.json
 */

import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), ".env") });

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { callLlm, type LlmProvider } from "./lib/llm.ts";
import {
  INITIAL_STATE_PROMPT,
  PROFILE_LABEL_PROMPT,
  SHORT_DESCRIPTION_PROMPT,
  getInitialStateUserPrompt,
  getStateLabelUserPrompt,
  getShortStateUserPrompt,
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

const PUBLIC_DIR = path.join(process.cwd(), "data", "states", "public");

interface GeneratedStatePayload {
  id: string;
  generatedAt: string;
  locale: OutputLocale;
  llm: LlmProvider;
  llmModelLabel: string;
  label: string;
  initialState: string;
  initialStateShort: string;
  rawInitialState?: string;
}

async function generateOneState(
  locale: OutputLocale,
  llmProvider: LlmProvider,
  model: string,
  temperature: number,
  maxTokens: number,
  sourceState?: GeneratedStatePayload
): Promise<GeneratedStatePayload> {
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

  let state: string;
  let rawInitialState: string;
  let initialStateShort: string;

  if (sourceState && locale === "fr") {
    console.log(`  Translating initial state to FR...`);
    rawInitialState = await callText(
      TRANSLATE_EN_TO_FR_SYSTEM_PROMPT,
      sourceState.initialState
    );
    state = cleanText(rawInitialState);
    console.log(`  Translating state short to FR...`);
    initialStateShort = cleanText(
      await callText(TRANSLATE_EN_TO_FR_SYSTEM_PROMPT, sourceState.initialStateShort)
    );
  } else {
    console.log(`  Generating initial state...`);
    rawInitialState = await callText(
      INITIAL_STATE_PROMPT,
      getInitialStateUserPrompt(locale)
    );
    state = cleanText(rawInitialState);
    console.log(`  Generating state short...`);
    initialStateShort = cleanText(
      await callText(
        SHORT_DESCRIPTION_PROMPT,
        getShortStateUserPrompt(state, locale),
        llmProvider === "gemini" ? maxTokens : 128
      )
    );
  }

  console.log(`  Generating label...`);
  const labelRaw = await callText(
    PROFILE_LABEL_PROMPT,
    getStateLabelUserPrompt(state, locale),
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
    initialState: state,
    initialStateShort,
    rawInitialState,
  };
}

async function main() {
  const translateFr = hasCliFlag("--translate-fr");
  const { count, llmProvider, model, temperature, maxTokens } = parseGenerateCli({
    helpHeader: "Generate v2 public initial states (EN, optional FR).",
    usageLine:
      "npx tsx scripts/generate-states.ts [count] [--translate-fr] [--llm <openai|anthropic|gemini|ollama>] [--model <model>] [--temperature <n>] [--max-tokens <n>]",
    examples: [
      "npx tsx scripts/generate-states.ts",
      "npx tsx scripts/generate-states.ts 2 --translate-fr",
      "npx tsx scripts/generate-states.ts 8 --llm openai --model gpt-5.2",
      "npx tsx scripts/generate-states.ts 6 --llm anthropic --model claude-sonnet-4-5-20250929",
      "npx tsx scripts/generate-states.ts 6 --llm gemini --model gemini-3-pro-preview",
      "npx tsx scripts/generate-states.ts 2 --llm ollama --model llama3.1:8b-instruct-q5_K_M",
      "npx tsx scripts/generate-states.ts 4 --llm gemini --max-tokens 2048",
    ],
    defaultCount: 1,
  });

  console.log(
    `Generating ${count} v2 public states (EN${translateFr ? " + FR" : ""}) with ${llmProvider}/${model} (temperature=${temperature}, maxTokens=${maxTokens})...\n`,
  );

  if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  const enStates: GeneratedStatePayload[] = [];

  for (let i = 0; i < count; i++) {
    console.log(`\n=== EN State ${i + 1}/${count} ===`);
    const state = await generateOneState("en", llmProvider, model, temperature, maxTokens);
    enStates.push(state);

    const filePath = path.join(PUBLIC_DIR, `${state.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
    console.log(`  Saved: ${filePath}`);
    console.log(`  Label: ${state.label}`);
    await sleep(250);
  }

  if (translateFr) {
    for (let i = 0; i < count; i++) {
      console.log(`\n=== FR State ${i + 1}/${count} (translating from EN) ===`);
      const frState = await generateOneState(
        "fr",
        llmProvider,
        model,
        temperature,
        maxTokens,
        enStates[i]
      );

      const filePath = path.join(PUBLIC_DIR, `${frState.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(frState, null, 2), "utf-8");
      console.log(`  Saved: ${filePath}`);
      console.log(`  Label: ${frState.label}`);
      await sleep(250);
    }
  }

  console.log(
    `\n\nDone! Generated ${count} EN${translateFr ? ` + ${count} FR` : ""} state(s) in data/states/public/`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

