/** GE-AIOS-13A — Canonical Operating Rhythm orchestrator (planning only, no execution). */

import { buildOperatingRhythm, type BuildOperatingRhythmInput } from "@/lib/growth/operating-rhythm/planner/build-operating-rhythm"
import type { AvaOperatingRhythm } from "@/lib/growth/operating-rhythm/types"

export type RunOperatingRhythmInput = BuildOperatingRhythmInput

/** Future autonomy hooks — NOT implemented in 13A. */
export function startMorningPlanning(): { started: false; reason: "planning_only" } {
  return { started: false, reason: "planning_only" }
}

export function continueCurrentPhase(): { continued: false; reason: "planning_only" } {
  return { continued: false, reason: "planning_only" }
}

export function pauseCurrentPhase(): { paused: false; reason: "planning_only" } {
  return { paused: false, reason: "planning_only" }
}

export function resumeCurrentPhase(): { resumed: false; reason: "planning_only" } {
  return { resumed: false, reason: "planning_only" }
}

export function runEndOfDayReflection(): { completed: false; reason: "planning_only" } {
  return { completed: false, reason: "planning_only" }
}

export function runOperatingRhythm(input: RunOperatingRhythmInput): AvaOperatingRhythm {
  return buildOperatingRhythm(input)
}

export { buildOperatingRhythm, type BuildOperatingRhythmInput }
