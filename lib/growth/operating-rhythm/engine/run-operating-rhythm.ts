/** GE-AIOS-13A — Canonical Operating Rhythm orchestrator (planning only, no execution). */

import { buildOperatingRhythm, type BuildOperatingRhythmInput } from "@/lib/growth/operating-rhythm/planner/build-operating-rhythm"
import type { AvaOperatingRhythm } from "@/lib/growth/operating-rhythm/types"

export type RunOperatingRhythmInput = BuildOperatingRhythmInput

/** Future autonomy hooks — NOT implemented in 13A. */
export function startMorningPlanning(): { started: false; reason: "planning_only" } {
  return { started: false, reason: "planning_only" }
}

export type ContinueCurrentPhaseResult =
  | { continued: false; reason: "planning_only" | "autonomy_not_enabled" | "no_executable_work" }
  | {
      continued: true
      reason: "sales_loop_executed"
      qa_marker?: string
      iterations: number
      outcomes_completed: number
    }

/** GE-AIOS-18A — Server loop supplies loopResult; client remains planning-only. */
export function continueCurrentPhase(input?: {
  loopResult?: ContinueCurrentPhaseResult | null
}): ContinueCurrentPhaseResult {
  if (input?.loopResult?.continued) return input.loopResult
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
