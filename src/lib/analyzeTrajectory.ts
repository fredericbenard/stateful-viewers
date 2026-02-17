/**
 * Phenomenological analysis of experiential trajectories.
 *
 * Tools here stay descriptive, support comparison without reduction,
 * and work at the level of patterns, not scores. They analyze experience
 * without collapsing it into affective metrics.
 *
 * Implemented:
 * - generateNarrativeSummary: end-of-sequence reflective summary of how
 *   the experience moved (settling, oscillation, depletion, drift, etc.).
 *
 * Natural extensions (same trajectory type, same philosophy):
 * - Transition moment detection: detect qualitative shifts (e.g. "guarded →
 *   receptive", "engagement → fatigue") via language change in state
 *   summaries or reorientation phrases ("I'm less…", "now I notice…").
 * - Comparative overlays: same gallery / different profiles, or same
 *   profile / different orderings; output aligned state snapshots or
 *   annotated divergence points.
 * - Linguistic drift: sentence length, fragmentation, qualifiers, certainty
 *   over steps (expressive texture, not sentiment).
 * - Trajectory typology: classify shape (gradual settling, oscillation, etc.)
 *   via clustering or LLM naming, then tag runs post hoc.
 *
 * Data: load a saved session (data/reflections/*.json) and pass it through
 * trajectoryFromSession() in ./trajectory.ts to get an ExperientialTrajectory.
 */

import type { VisionProvider } from "../api/vision";
import { generateText } from "../api/llm";
import type { ExperientialTrajectory } from "./trajectory";
import {
  TRAJECTORY_SUMMARY_SYSTEM_PROMPT,
  type OutputLocale,
  getTrajectorySummaryUserPrompt,
} from "../prompts";

export interface NarrativeSummaryResult {
  summary: string;
  error?: string;
}

/**
 * Generate a short narrative summary of how the experience moved through
 * the gallery. Analysis as secondary reflection — describes the trajectory
 * (settling, oscillation, depletion, drift, etc.) without reducing to numbers.
 */
export async function generateNarrativeSummary(
  trajectory: ExperientialTrajectory,
  provider: VisionProvider,
  locale: OutputLocale
): Promise<NarrativeSummaryResult> {
  const internalStates = trajectory.steps.map((s) => s.internalState);
  if (internalStates.length === 0) {
    return {
      summary: "No steps in this trajectory; cannot summarize.",
      error: "Empty trajectory",
    };
  }
  const userPrompt = getTrajectorySummaryUserPrompt(
    trajectory.gallery.name,
    trajectory.profile,
    internalStates,
    locale
  );

  const { content, error } = await generateText(
    provider,
    TRAJECTORY_SUMMARY_SYSTEM_PROMPT,
    userPrompt,
    locale
  );

  return {
    summary: content.trim(),
    error,
  };
}
