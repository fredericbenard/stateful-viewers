/**
 * Generate v2 public profiles (EN + FR)
 *
 * Run: npx tsx scripts/generate-v2-profiles.ts [count]
 *
 * Requires OPENAI_API_KEY in .env or environment.
 *
 * Generates [count] EN profiles (default 4) with parametric hints, then
 * translates each to FR. Each profile includes: profile, style, initial
 * state, short descriptions for each, and a label.
 */

import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), ".env") });

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  VIEWER_PROFILE_PROMPT,
  VIEWER_PROFILE_USER_SPEC,
  REFLECTION_STYLE_PROMPT,
  REFLECTION_STYLE_USER_SPEC,
  INITIAL_STATE_PROMPT,
  INITIAL_STATE_USER_SPEC,
  PROFILE_LABEL_PROMPT,
  SHORT_DESCRIPTION_PROMPT,
  outputLanguageInstruction,
  generateProfileHint,
  generateStyleHint,
  generateStateHint,
  getProfileLabelUserPrompt,
  getShortProfileUserPrompt,
  getShortStyleUserPrompt,
  getShortStateUserPrompt,
  type OutputLocale,
} from "../src/prompts.ts";

const PUBLIC_DIR = path.join(process.cwd(), "data", "profiles", "public");

const OPENAI_MODEL = "gpt-5.2";

interface GeneratedProfile {
  id: string;
  generatedAt: string;
  locale: OutputLocale;
  llm: "openai";
  llmModelLabel: string;
  label: string;
  profile: string;
  profileShort: string;
  reflectionStyle: string;
  reflectionStyleShort: string;
  initialState: string;
  initialStateShort: string;
}

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1024,
  temperature = 0.95
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY required");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_completion_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

function cleanText(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1");
  const introPatterns = [
    /^(Here is|Here's) (the |a )?(profile|style|state|label|summary)[:\s]*\n?/i,
    /^(The|This) (profile|style|state|label) (is|:)[:\s]*\n?/i,
  ];
  for (const p of introPatterns) cleaned = cleaned.replace(p, "");
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned.trim();
}

function normalizeLabelSentenceCase(label: string): string {
  const cleaned = label.trim().replace(/\s+/g, " ");
  if (!cleaned) return cleaned;
  const words = cleaned.split(" ");
  return words
    .map((w, i) => i === 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())
    .join(" ");
}

async function generateOneProfile(
  locale: OutputLocale,
  sourceProfile?: GeneratedProfile
): Promise<GeneratedProfile> {
  const langInstr = outputLanguageInstruction(locale);

  let profile: string;
  let style: string;
  let state: string;

  if (sourceProfile && locale === "fr") {
    const translateSys = "You are a professional translator. Translate the following text from English to French. Preserve the tone, register, and style. Output only the translation.";
    console.log(`  Translating profile to FR...`);
    profile = await callOpenAI(translateSys, sourceProfile.profile);
    console.log(`  Translating style to FR...`);
    style = await callOpenAI(translateSys, sourceProfile.reflectionStyle);
    console.log(`  Translating initial state to FR...`);
    state = await callOpenAI(translateSys, sourceProfile.initialState);
  } else {
    const profileHint = generateProfileHint();
    const styleHint = generateStyleHint();
    const stateHint = generateStateHint();
    console.log(`  Profile hint: ${profileHint}`);
    console.log(`  Style hint: ${styleHint}`);
    console.log(`  State hint: ${stateHint}`);

    console.log(`  Generating profile...`);
    profile = cleanText(await callOpenAI(
      VIEWER_PROFILE_PROMPT,
      `${VIEWER_PROFILE_USER_SPEC}\n\n${langInstr}\n\n${profileHint}`,
    ));

    console.log(`  Generating style...`);
    style = cleanText(await callOpenAI(
      REFLECTION_STYLE_PROMPT,
      `${REFLECTION_STYLE_USER_SPEC}\n\n${langInstr}\n\n${styleHint}`,
    ));

    console.log(`  Generating initial state...`);
    state = cleanText(await callOpenAI(
      INITIAL_STATE_PROMPT,
      `${INITIAL_STATE_USER_SPEC}\n\n${langInstr}\n\n${stateHint}`,
    ));
  }

  console.log(`  Generating label...`);
  const labelRaw = await callOpenAI(
    PROFILE_LABEL_PROMPT,
    getProfileLabelUserPrompt(profile, style, locale),
    64,
  );
  const label = normalizeLabelSentenceCase(cleanText(labelRaw));

  console.log(`  Generating short descriptions...`);
  const [profileShortRaw, styleShortRaw, stateShortRaw] = await Promise.all([
    callOpenAI(SHORT_DESCRIPTION_PROMPT, getShortProfileUserPrompt(profile, locale), 256),
    callOpenAI(SHORT_DESCRIPTION_PROMPT, getShortStyleUserPrompt(style, locale), 256),
    callOpenAI(SHORT_DESCRIPTION_PROMPT, getShortStateUserPrompt(state, locale), 128),
  ]);

  return {
    id: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    locale,
    llm: "openai",
    llmModelLabel: "GPT-5.2",
    label,
    profile,
    profileShort: cleanText(profileShortRaw),
    reflectionStyle: style,
    reflectionStyleShort: cleanText(styleShortRaw),
    initialState: state,
    initialStateShort: cleanText(stateShortRaw),
  };
}

async function main() {
  const count = Math.max(1, parseInt(process.argv[2] ?? "4", 10) || 4);
  console.log(`Generating ${count} v2 public profiles (EN + FR)...\n`);

  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  const enProfiles: GeneratedProfile[] = [];

  for (let i = 0; i < count; i++) {
    console.log(`\n=== EN Profile ${i + 1}/${count} ===`);
    const profile = await generateOneProfile("en");
    enProfiles.push(profile);

    const filePath = path.join(PUBLIC_DIR, `${profile.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(profile, null, 2), "utf-8");
    console.log(`  Saved: ${filePath}`);
    console.log(`  Label: ${profile.label}`);
  }

  for (let i = 0; i < count; i++) {
    console.log(`\n=== FR Profile ${i + 1}/${count} (translating from EN) ===`);
    const frProfile = await generateOneProfile("fr", enProfiles[i]);

    const filePath = path.join(PUBLIC_DIR, `${frProfile.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(frProfile, null, 2), "utf-8");
    console.log(`  Saved: ${filePath}`);
    console.log(`  Label: ${frProfile.label}`);
  }

  console.log(`\n\nDone! Generated ${count} EN + ${count} FR profiles in data/profiles/public/`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
