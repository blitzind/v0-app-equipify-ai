/** GE-AIOS-13A — Research cycle rhythm phase. */

import type { AvaOperatingPhaseEntry, AvaOperatingPhaseId, OperatingRhythmPhaseInput } from "@/lib/growth/operating-rhythm/types"

export function evaluateResearchCyclePhase(input: OperatingRhythmPhaseInput): AvaOperatingPhaseEntry {
  const researched = input.metrics.researched
  const completedResearch = input.workResult.completed_today.some((item) => item.type === "research")
  const activeResearch = input.workResult.active_work?.type === "research"
  const hasResearchWork = input.workResult.all_work_items.some((item) => item.type === "research")

  let status: AvaOperatingPhaseEntry["status"] = "pending"
  if (completedResearch || (researched > 0 && input.hour >= 14)) status = "completed"
  else if (activeResearch || input.currentPhase === "research_cycle") status = "active"
  else if (hasResearchWork && input.hour >= 9) status = input.hour >= 15 ? "completed" : "pending"

  const summary =
    researched > 0
      ? `Researched ${researched} ${researched === 1 ? "company" : "companies"}.`
      : activeResearch
        ? input.workResult.active_work?.title ?? "Continuing research."
        : null

  return { id: "research_cycle" as AvaOperatingPhaseId, label: "Research", status, summary }
}
