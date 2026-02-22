/**
 * Generate v2 public profiles (EN, optional FR)
 *
 * Run: npx tsx scripts/generate-profiles.ts [count]
 *
 * Generates [count] EN profiles (default 1) with parametric hints, then
 * optionally translates each to FR when `--translate-fr` is provided.
 *
 * Output format is profile-only (no embedded style/state):
 * - data/profiles/public/<id>.json
 */

import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), ".env") });

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { callLlm, type LlmProvider } from "./lib/llm.ts";
import {
  VIEWER_PROFILE_PROMPT,
  PROFILE_LABEL_PROMPT,
  SHORT_DESCRIPTION_PROMPT,
  getViewerProfileUserPrompt,
  getProfileLabelFromProfileUserPrompt,
  getShortProfileUserPrompt,
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

const PUBLIC_DIR = path.join(process.cwd(), "data", "profiles", "public");

interface GeneratedProfilePayload {
  id: string;
  generatedAt: string;
  locale: OutputLocale;
  llm: LlmProvider;
  llmModelLabel: string;
  label: string;
  profile: string;
  profileShort: string;
  rawProfile?: string;
}

async function generateOneProfile(
  locale: OutputLocale,
  llmProvider: LlmProvider,
  model: string,
  temperature: number,
  maxTokens: number,
  sourceProfile?: GeneratedProfilePayload
): Promise<GeneratedProfilePayload> {

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

  let profile: string;
  let rawProfile: string;
  let profileShort: string;
  if (sourceProfile && locale === "fr") {
    console.log(`  Translating profile to FR...`);
    rawProfile = await callText(TRANSLATE_EN_TO_FR_SYSTEM_PROMPT, sourceProfile.profile);
    profile = cleanText(rawProfile);
    console.log(`  Translating profile short to FR...`);
    profileShort = cleanText(
      await callText(TRANSLATE_EN_TO_FR_SYSTEM_PROMPT, sourceProfile.profileShort)
    );
  } else {
    console.log(`  Generating profile...`);
    rawProfile = await callText(
      VIEWER_PROFILE_PROMPT,
      getViewerProfileUserPrompt(locale),
    );
    profile = cleanText(rawProfile);

    console.log(`  Generating profile short...`);
    profileShort = cleanText(
      await callText(
        SHORT_DESCRIPTION_PROMPT,
        getShortProfileUserPrompt(profile, locale),
        llmProvider === "gemini" ? maxTokens : 256
      )
    );
  }

  console.log(`  Generating label...`);
  const labelRaw = await callText(
    PROFILE_LABEL_PROMPT,
    getProfileLabelFromProfileUserPrompt(profile, locale),
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
    profile,
    profileShort,
    rawProfile,
  };
}

async function main() {
  const translateFr = hasCliFlag("--translate-fr");
  const { count, llmProvider, model, temperature, maxTokens } = parseGenerateCli({
    helpHeader: "Generate v2 public profiles (EN, optional FR).",
    usageLine:
      "npx tsx scripts/generate-profiles.ts [count] [--translate-fr] [--llm <openai|anthropic|gemini|ollama>] [--model <model>] [--temperature <n>] [--max-tokens <n>]",
    examples: [
      "npx tsx scripts/generate-profiles.ts",
      "npx tsx scripts/generate-profiles.ts 2 --translate-fr",
      "npx tsx scripts/generate-profiles.ts 8 --llm openai --model gpt-5.2",
      "npx tsx scripts/generate-profiles.ts 6 --llm anthropic --model claude-sonnet-4-5-20250929",
      "npx tsx scripts/generate-profiles.ts 6 --llm gemini --model gemini-3-pro-preview",
      "npx tsx scripts/generate-profiles.ts 2 --llm ollama --model llama3.1:8b-instruct-q5_K_M",
      "npx tsx scripts/generate-profiles.ts 4 --llm gemini --max-tokens 2048",
    ],
    defaultCount: 1,
  });
  console.log(
    `Generating ${count} v2 public profiles (EN${translateFr ? " + FR" : ""}) with ${llmProvider}/${model} (temperature=${temperature}, maxTokens=${maxTokens})...\n`,
  );

  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  const enProfiles: GeneratedProfilePayload[] = [];

  for (let i = 0; i < count; i++) {
    console.log(`\n=== EN Profile ${i + 1}/${count} ===`);
    const profile = await generateOneProfile("en", llmProvider, model, temperature, maxTokens);
    enProfiles.push(profile);

    const filePath = path.join(PUBLIC_DIR, `${profile.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), "utf-8");
    console.log(`  Saved: ${filePath}`);
    console.log(`  Label: ${profile.label}`);
    await sleep(250);
  }

  if (translateFr) {
    for (let i = 0; i < count; i++) {
      console.log(`\n=== FR Profile ${i + 1}/${count} (translating from EN) ===`);
      const frProfile = await generateOneProfile(
        "fr",
        llmProvider,
        model,
        temperature,
        maxTokens,
        enProfiles[i]
      );

      const filePath = path.join(PUBLIC_DIR, `${frProfile.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(frProfile, null, 2), "utf-8");
      console.log(`  Saved: ${filePath}`);
      console.log(`  Label: ${frProfile.label}`);
      await sleep(250);
    }
  }

  console.log(
    `\n\nDone! Generated ${count} EN${translateFr ? ` + ${count} FR` : ""} profile(s) in data/profiles/public/`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
