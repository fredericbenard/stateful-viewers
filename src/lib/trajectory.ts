/**
 * Experiential trajectory: a normalized view of one run through a gallery.
 * Used as the object of analysis (narrative summary, transition detection,
 * comparison) without reducing experience to numbers.
 */

import type { ReflectionSessionPayload, SessionReflection } from "./saveReflectionSession";
import { parseReflection } from "./parseReflection";

/** One step in the trajectory: one image encounter and the resulting state. */
export interface TrajectoryStep {
  imageIndex: number;
  imageId: string;
  /** The reflection text (emotional response) for this image. */
  reflectionText: string;
  /** The internal state after this image (mood, tension, energy, openness). */
  internalState: string;
  /** Locale for this step (reflections can be mixed-language within one run). */
  locale?: SessionReflection["locale"];
}

/** Minimal gallery context for analysis (no images). */
export interface TrajectoryGallery {
  id: string;
  name: string;
  era: string;
  description: string;
}

/**
 * An experiential trajectory: who (profile), where (gallery), and the ordered
 * path of internal states and reflections. No scores—only qualitative sequence.
 */
export interface ExperientialTrajectory {
  /** Unique id for this run: profileId_galleryId_sessionStartedAt (ISO). */
  id: string;
  profileId: string;
  galleryId: string;
  sessionStartedAt: string;
  lastUpdatedAt: string;
  /** Locale active when this session snapshot was saved. Individual steps may differ. */
  locale?: ReflectionSessionPayload["locale"];
  gallery: TrajectoryGallery;
  /** Ordered steps: first image to last. */
  steps: TrajectoryStep[];
  /** Final internal state after the last image. */
  lastInternalState: string;
  /** Viewer profile text (for context in comparative or narrative analysis). */
  profile: string;
  /** Reflection style text (for voice-level / linguistic analysis). */
  reflectionStyle: string;
}

/**
 * Build an experiential trajectory from a saved reflection session.
 * Normalizes steps (extracts reflection vs state from content when needed).
 */
export function trajectoryFromSession(
  session: ReflectionSessionPayload
): ExperientialTrajectory {
  const steps: TrajectoryStep[] = session.reflections
    .slice()
    .sort((a, b) => {
      // Primary sort: by generatedAt/timestamp (chronological order)
      // If timestamps exist, use them; otherwise fall back to imageIndex
      const ta = a.generatedAt ?? a.timestamp;
      const tb = b.generatedAt ?? b.timestamp;
      if (ta && tb) {
        return ta.localeCompare(tb);
      }
      // If only one has a time, prioritize it
      if (ta && !tb) return -1;
      if (!ta && tb) return 1;
      // Fallback: sort by imageIndex, then by array order
      return a.imageIndex - b.imageIndex;
    })
    .map((r) => stepFromReflection(r));

  const id = [
    session.profileId,
    session.galleryId,
    session.sessionStartedAt,
  ].join("_");

  return {
    id,
    profileId: session.profileId,
    galleryId: session.galleryId,
    sessionStartedAt: session.sessionStartedAt,
    lastUpdatedAt: session.lastUpdatedAt,
    locale: session.locale,
    gallery: session.gallery,
    steps,
    lastInternalState: session.lastInternalState,
    profile: session.profile,
    reflectionStyle: session.reflectionStyle,
  };
}

function stepFromReflection(r: SessionReflection): TrajectoryStep {
  const parsed = parseReflection(r.content);
  const internalState = r.internalState ?? parsed.internalState;
  const reflectionText = parsed.reaction || "(no reflection text)";
  return {
    imageIndex: r.imageIndex,
    imageId: r.imageId,
    reflectionText,
    internalState: internalState || "",
    locale: r.locale,
  };
}
