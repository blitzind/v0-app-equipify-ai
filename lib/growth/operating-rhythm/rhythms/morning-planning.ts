/** GE-AIOS-13A — Morning planning rhythm phase. */

import type { AvaOperatingPhaseEntry, AvaOperatingPhaseId, OperatingRhythmPhaseInput } from "@/lib/growth/operating-rhythm/types"

export function evaluateMorningPlanningPhase(input: OperatingRhythmPhaseInput): AvaOperatingPhaseEntry {
  const hasPlan = input.workResult.work_plan.length > 0
  const isMorning = input.hour >= 5 && input.hour < 12
  const blockedCount = input.workResult.blocked.length

  let status: AvaOperatingPhaseEntry["status"] = "pending"
  if (hasPlan && !isMorning) status = "completed"
  else if (hasPlan && input.hour >= 10) status = "completed"
  else if (isMorning && input.currentPhase === "morning_planning") status = "active"
  else if (hasPlan) status = "completed"

  const summary =
    blockedCount > 0
      ? `Built today's plan with ${blockedCount} blocked ${blockedCount === 1 ? "item" : "items"} noted.`
      : hasPlan
        ? "Reviewed overnight changes and built today's plan."
        : null

  return { id: "morning_planning" as AvaOperatingPhaseId, label: "Morning Planning", status, summary }
}
