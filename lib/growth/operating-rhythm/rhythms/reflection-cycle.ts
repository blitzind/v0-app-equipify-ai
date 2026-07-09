/** GE-AIOS-13A — End-of-day reflection rhythm phase. */

import type { AvaOperatingPhaseEntry, AvaOperatingPhaseId, OperatingRhythmPhaseInput } from "@/lib/growth/operating-rhythm/types"

export function evaluateReflectionPhase(input: OperatingRhythmPhaseInput): AvaOperatingPhaseEntry {
  const isEvening = input.hour >= 17
  const hasCompleted = input.workResult.completed_today.length > 0
  const hasReflectionMemory = Boolean(input.previousMemory?.capturedAt)

  let status: AvaOperatingPhaseEntry["status"] = "pending"
  if (isEvening && (hasCompleted || hasReflectionMemory)) {
    status = input.currentPhase === "reflection" ? "active" : "completed"
  } else if (isEvening) {
    status = "active"
  }

  const summary = isEvening
    ? hasCompleted
      ? `Reflected on ${input.workResult.completed_today.length} completed ${input.workResult.completed_today.length === 1 ? "item" : "items"}.`
      : "Preparing end-of-day summary."
    : null

  return { id: "reflection" as AvaOperatingPhaseId, label: "Reflection", status, summary }
}
