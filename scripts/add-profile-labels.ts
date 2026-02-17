/**
 * Add profile labels to profiles that are missing them
 * Run: npm run add-labels
 * 
 * This script:
 * 1. Reads all profile files from data/profiles/
 * 2. Identifies profiles missing the 'label' field
 * 3. Generates labels using the same LLM provider that created the profile
 * 4. Updates the profile files with the new labels
 */

// Load environment variables from .env file
import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), ".env") });

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PROFILE_LABEL_PROMPT as PROFILE_LABEL_SYSTEM_PROMPT,
  getProfileLabelUserPrompt,
} from "../src/prompts.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROFILE_DIR = path.join(__dirname, "..", "data", "profiles");

interface Profile {
  id: string;
  generatedAt: string;
  llm: "ollama" | "openai" | "gemini" | "anthropic";
  modelLabel: string;
  label?: string;
  profile: string;
  reflectionStyle: string;
  [key: string]: unknown;
}

function cleanGeneratedText(text: string): string {
  let cleaned = text.trim();
  
  // Remove common introductory phrases
  const introPatterns = [
    /^(Here is|Here's) (the |a )?label[:\s]*\n?/i,
    /^(The|This) label (is|:)[:\s]*\n?/i,
    /^Label[:\s]*\n?/i,
  ];
  
  for (const pattern of introPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }
  
  // Remove markdown formatting
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, "$1");
  
  // Remove quotes if the entire label is quoted (handles both single and double quotes)
  // Try multiple patterns to catch different quote styles
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  // Handle escaped quotes
  if ((cleaned.startsWith('\\"') && cleaned.endsWith('\\"')) ||
      (cleaned.startsWith("\\'") && cleaned.endsWith("\\'"))) {
    cleaned = cleaned.slice(2, -2).trim();
  }
  
  return cleaned.trim();
}

function normalizeLabelSentenceCase(label: string): string {
  const cleaned = label.trim().replace(/\s+/g, " ");
  if (!cleaned) return cleaned;
  const words = cleaned.split(" ");
  return words
    .map((word, idx) =>
      idx === 0
        ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        : word.toLowerCase()
    )
    .join(" ");
}

async function generateLabelOpenAI(profile: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-5.2",
      messages: [
        { role: "system", content: PROFILE_LABEL_SYSTEM_PROMPT },
        { role: "user", content: getProfileLabelUserPrompt(profile) },
      ],
      max_completion_tokens: 64,
      temperature: 0.95,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "";
  return content ? cleanGeneratedText(content) : null;
}

async function generateLabelOllama(profile: string): Promise<string | null> {
  const ollamaBase = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

  const response = await fetch(`${ollamaBase}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama3.1:8b-instruct-q5_K_M",
      messages: [
        { role: "system", content: PROFILE_LABEL_SYSTEM_PROMPT },
        { role: "user", content: getProfileLabelUserPrompt(profile) },
      ],
      stream: false,
      options: { temperature: 0.95 },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Ollama error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const content = data.message?.content ?? "";
  return content ? cleanGeneratedText(content) : null;
}

/**
 * Extract text from Gemini API response.
 * Gemini may return multiple parts (including thinking blocks).
 * We want the actual answer (non-thought parts).
 */
function extractTextFromGeminiResponse(data: Record<string, unknown>): string {
  const candidate = data.candidates?.[0] as Record<string, unknown> | undefined;
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

async function generateLabelGemini(profile: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY environment variable is required");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: PROFILE_LABEL_SYSTEM_PROMPT }],
        },
        contents: [
          {
            parts: [{ text: getProfileLabelUserPrompt(profile) }],
          },
        ],
        generationConfig: {
          temperature: 0.95,
          maxOutputTokens: 256, // Increased to ensure complete labels (2-5 words should be ~10-30 tokens)
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  
  // Check for finish reason (might indicate truncation)
  const candidate = data.candidates?.[0] as { finishReason?: string; finish_reason?: string } | undefined;
  const finishReason = candidate?.finishReason ?? candidate?.finish_reason;
  if (finishReason === "MAX_TOKENS" || finishReason === "STOP") {
    // MAX_TOKENS means response was truncated, but we'll still use what we got
    // STOP is normal completion
  }
  
  const content = extractTextFromGeminiResponse(data);
  
  if (!content) {
    // Check for blocking reasons
    const pf = data.promptFeedback as { blockReason?: string; block_reason?: string } | undefined;
    const blockReason = pf?.blockReason ?? pf?.block_reason;
    if (blockReason) {
      throw new Error(`Gemini blocked response: ${blockReason}`);
    }
    return null;
  }
  
  // Check if content looks truncated (ends with comma or incomplete)
  const cleaned = cleanGeneratedText(content);
  if (finishReason === "MAX_TOKENS" && cleaned.length < 10) {
    // If it was truncated and we got very little, it's likely incomplete
    console.warn(`  ⚠ Gemini response appears truncated (finishReason: ${finishReason}), got: "${cleaned}"`);
    // Try again with higher token limit or return null to retry
    return null;
  }
  
  return cleaned;
}

async function generateLabelAnthropic(profile: string): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 64,
      temperature: 0.95,
      system: PROFILE_LABEL_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: getProfileLabelUserPrompt(profile),
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const contentArray = data.content as { type: string; text?: string }[] | undefined;
  if (!Array.isArray(contentArray)) return null;
  const textBlock = contentArray.find((b) => b.type === "text" && b.text);
  const content = textBlock && typeof textBlock.text === "string" ? textBlock.text : "";
  return content ? cleanGeneratedText(content) : null;
}

function checkApiKeyAvailable(provider: string): boolean {
  switch (provider) {
    case "openai":
      return !!process.env.OPENAI_API_KEY;
    case "ollama":
      // Ollama doesn't require an API key, but we check if the base URL is accessible
      return true; // We'll handle connection errors separately
    case "gemini":
      return !!process.env.GOOGLE_API_KEY;
    case "anthropic":
      return !!process.env.ANTHROPIC_API_KEY;
    default:
      return false;
  }
}

async function generateLabel(
  profile: Profile
): Promise<{ label: string; rawLabel: string } | null> {
  const profileText = profile.profile;
  if (!profileText) {
    console.warn(`  ⚠ Profile ${profile.id} has no profile text`);
    return null;
  }

  // Check if API key is available for this provider
  if (!checkApiKeyAvailable(profile.llm)) {
    console.warn(
      `  ⚠ Skipping ${profile.id}: ${profile.llm.toUpperCase()}_API_KEY not set`
    );
    return null;
  }

  let rawLabel: string | null = null;

  try {
    switch (profile.llm) {
      case "openai":
        rawLabel = await generateLabelOpenAI(profileText);
        break;
      case "ollama":
        rawLabel = await generateLabelOllama(profileText);
        break;
      case "gemini":
        rawLabel = await generateLabelGemini(profileText);
        break;
      case "anthropic":
        rawLabel = await generateLabelAnthropic(profileText);
        break;
      default:
        console.warn(`  ⚠ Unknown LLM provider: ${profile.llm}`);
        return null;
    }

    if (!rawLabel || rawLabel.length === 0) {
      console.warn(`  ⚠ Failed to generate label for ${profile.id}`);
      return null;
    }

    return {
      label: normalizeLabelSentenceCase(rawLabel),
      rawLabel: rawLabel,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("API_KEY") || errorMessage.includes("environment variable")) {
      console.warn(
        `  ⚠ Skipping ${profile.id}: ${errorMessage}`
      );
    } else {
      console.error(`  ✗ Error generating label for ${profile.id}:`, errorMessage);
    }
    return null;
  }
}

async function main() {
  if (!fs.existsSync(PROFILE_DIR)) {
    console.error(`Profile directory not found: ${PROFILE_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(PROFILE_DIR)
    .filter((f) => f.endsWith(".json"));

  if (files.length === 0) {
    console.log("No profile files found.");
    return;
  }

  console.log(`Found ${files.length} profile file(s)\n`);

  const profilesToUpdate: Array<{ file: string; profile: Profile }> = [];
  const profilesWithLabels: string[] = [];

  // First pass: identify profiles missing labels
  for (const file of files) {
    const filePath = path.join(PROFILE_DIR, file);
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const profile: Profile = JSON.parse(content);

      // Check if label is missing, undefined, null, empty string, or only whitespace
      const labelValue = profile.label;
      const hasLabel = labelValue !== undefined && 
                       labelValue !== null &&
                       typeof labelValue === "string" && 
                       labelValue.trim().length > 0;

      if (!hasLabel) {
        profilesToUpdate.push({ file, profile });
      } else {
        profilesWithLabels.push(profile.id);
      }
    } catch (error) {
      console.error(`✗ Error reading ${file}:`, error);
    }
  }

  console.log(
    `${profilesWithLabels.length} profile(s) already have labels`
  );
  console.log(
    `${profilesToUpdate.length} profile(s) need labels`
  );
  
  if (profilesToUpdate.length > 0) {
    console.log("\nProfiles that need labels:");
    for (const { profile } of profilesToUpdate) {
      const labelStatus = profile.label === undefined 
        ? "missing" 
        : profile.label === null 
        ? "null" 
        : `empty ("${profile.label}")`;
      console.log(`  - ${profile.id} (${profile.llm}): label is ${labelStatus}`);
    }
    console.log();
  }

  if (profilesToUpdate.length === 0) {
    console.log("All profiles have labels. Nothing to do!");
    return;
  }

  // Check API key availability
  const availableProviders = new Set<string>();
  const unavailableProviders = new Set<string>();
  
  for (const provider of ["openai", "ollama", "gemini", "anthropic"] as const) {
    if (checkApiKeyAvailable(provider)) {
      availableProviders.add(provider);
    } else {
      unavailableProviders.add(provider);
    }
  }

  console.log("Available providers:", Array.from(availableProviders).join(", ") || "none");
  if (unavailableProviders.size > 0) {
    console.log(
      "⚠ Unavailable providers (will be skipped):",
      Array.from(unavailableProviders).join(", ")
    );
  }
  console.log();

  // Filter out profiles that require unavailable providers
  const processableProfiles = profilesToUpdate.filter(({ profile }) =>
    checkApiKeyAvailable(profile.llm)
  );
  const skippedProfiles = profilesToUpdate.filter(
    ({ profile }) => !checkApiKeyAvailable(profile.llm)
  );

  if (skippedProfiles.length > 0) {
    console.log(
      `⚠ Skipping ${skippedProfiles.length} profile(s) due to missing API keys:\n`
    );
    for (const { profile } of skippedProfiles) {
      console.log(
        `  - ${profile.id} (${profile.llm.toUpperCase()}_API_KEY not set)`
      );
    }
    console.log();
  }

  if (processableProfiles.length === 0) {
    console.log(
      "No profiles can be processed with available API keys. Please set the required environment variables."
    );
    return;
  }

  console.log(
    `Processing ${processableProfiles.length} profile(s) with available providers...\n`
  );

  // Second pass: generate labels and update files
  let successCount = 0;
  let failCount = 0;
  const skippedCount = skippedProfiles.length;

  for (const { file, profile } of processableProfiles) {
    console.log(`Processing ${file} (${profile.id})...`);

    const result = await generateLabel(profile);
    if (!result) {
      failCount++;
      console.log(`  ✗ Failed to generate label\n`);
      continue;
    }

    // Update profile with label
    profile.label = result.label;
    profile.rawLabel = result.rawLabel;

    // Write updated profile back to file
    const filePath = path.join(PROFILE_DIR, file);
    fs.writeFileSync(
      filePath,
      JSON.stringify(profile, null, 2),
      "utf-8"
    );

    console.log(`  ✓ Generated label: "${result.label}"\n`);
    successCount++;

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log("\n=== Summary ===");
  console.log(`✓ Successfully added labels: ${successCount}`);
  console.log(`✗ Failed: ${failCount}`);
  console.log(`⚠ Skipped (missing API keys): ${skippedCount}`);
  console.log(`Already had labels: ${profilesWithLabels.length}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
