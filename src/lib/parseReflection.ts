/**
 * Parse output from the stateful VLM
 */

export interface ParsedReflection {
  reaction: string;
  internalState: string;
  raw: string;
}

/**
 * Extract [REFLECTION] and [STATE] blocks from model output.
 * Falls back gracefully if format isn't followed.
 */
export function parseReflection(content: string): ParsedReflection {
  const raw = content.trim();

  // Try new format first: [REFLECTION] and [STATE] blocks
  // Handle both plain [REFLECTION] and markdown-formatted **[REFLECTION]**
  // Match 0-2 asterisks before and after the brackets
  // Handle tags on same line or new line
  const reflectionMatch = raw.match(
    /\*{0,2}\[REFLECTION\]\*{0,2}\s*:?\s*\n?([\s\S]*?)(?=\n\s*\*{0,2}\[STATE\]\*{0,2}|$)/i
  );
  const stateMatch = raw.match(/\*{0,2}\[STATE\]\*{0,2}\s*:?\s*\n?([\s\S]*?)$/im);

  if (reflectionMatch && stateMatch) {
    return {
      reaction: reflectionMatch[1].trim(),
      internalState: stateMatch[1].trim(),
      raw,
    };
  }

  // Fallback to old format: "Reaction:" and "Internal state after this image:"
  const oldReactionMatch = raw.match(
    /Reaction:\s*\n([\s\S]*?)(?=\n\s*Internal state|$)/i
  );
  const oldStateMatch = raw.match(
    /Internal state after this image:\s*\n([\s\S]*?)$/im
  );

  return {
    reaction: oldReactionMatch?.[1]?.trim() ?? raw,
    internalState: oldStateMatch?.[1]?.trim() ?? "",
    raw,
  };
}
