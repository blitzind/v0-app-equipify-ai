/** GE-AIOS-13A — Outreach preparation rhythm phase. */

import type { AvaOperatingPhaseEntry, AvaOperatingPhaseId, OperatingRhythmPhaseInput } from "@/lib/growth/operating-rhythm/types"

export function evaluateOutreachCyclePhase(input: OperatingRhythmPhaseInput): AvaOperatingPhaseEntry {
  const readyForReview = input.metrics.readyForReview
  const hasOutreachWork = input.workResult.all_work_items.some((item) => item.type === "outreach")
  const activeOutreach = input.workResult.active_work?.type === "outreach"
  const outreachBlocked = input.workResult.blocked.some((item) => item.type === "outreach")

  let status: AvaOperatingPhaseEntry["status"] = "pending"
  if (readyForReview > 0 && input.workResult.operator_queue.some((item) => item.type === "approval")) {
    status = "completed"
  } else if (outreachBlocked) {
    status = "blocked"
  } else if (activeOutreach || input.currentPhase === "outreach_preparation") {
    status = "active"
  } else if (hasOutreachWork && input.hour >= 14) {
    status = readyForReview > 0 ? "completed" : "pending"
  }

  const summary =
    readyForReview > 0
      ? `Prepared ${readyForReview} ${readyForReview === 1 ? "opportunity" : "opportunities"} for review.`
      : activeOutreach
        ? input.workResult.active_work?.title ?? "Preparing outreach."
        : null

  return { id: "outreach_preparation" as AvaOperatingPhaseId, label: "Outreach Preparation", status, summary }
}
