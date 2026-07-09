/** GE-AIOS-13A — Qualification cycle rhythm phase. */

import type { AvaOperatingPhaseEntry, AvaOperatingPhaseId, OperatingRhythmPhaseInput } from "@/lib/growth/operating-rhythm/types"

export function evaluateQualificationCyclePhase(input: OperatingRhythmPhaseInput): AvaOperatingPhaseEntry {
  const qualified = input.metrics.qualified
  const completedQual = input.workResult.completed_today.some((item) => item.type === "qualification")
  const activeQual = input.workResult.active_work?.type === "qualification"

  let status: AvaOperatingPhaseEntry["status"] = "pending"
  if (completedQual || (qualified > 0 && input.hour >= 16)) status = "completed"
  else if (activeQual || input.currentPhase === "qualification_cycle") status = "active"
  else if (qualified > 0 && input.hour >= 12) status = input.hour >= 17 ? "completed" : "pending"

  const summary =
    qualified > 0
      ? `Qualified ${qualified} ${qualified === 1 ? "company" : "companies"}.`
      : activeQual
        ? input.workResult.active_work?.title ?? "Reviewing company fit."
        : null

  return { id: "qualification_cycle" as AvaOperatingPhaseId, label: "Qualification", status, summary }
}
