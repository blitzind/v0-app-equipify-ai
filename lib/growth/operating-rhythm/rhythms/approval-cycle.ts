/** GE-AIOS-13A — Approval collection rhythm phase. */

import type { AvaOperatingPhaseEntry, AvaOperatingPhaseId, OperatingRhythmPhaseInput } from "@/lib/growth/operating-rhythm/types"

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural
}

export function evaluateApprovalCyclePhase(input: OperatingRhythmPhaseInput): AvaOperatingPhaseEntry {
  const waiting = input.workResult.operator_queue.length

  let status: AvaOperatingPhaseEntry["status"] = "pending"
  if (waiting > 0) {
    status = input.currentPhase === "approval_collection" ? "active" : "blocked"
  } else if (input.hour >= 17) {
    status = "completed"
  }

  const summary =
    waiting > 0
      ? `${waiting} ${pluralize(waiting, "decision", "decisions")} bundled for your review.`
      : null

  return { id: "approval_collection" as AvaOperatingPhaseId, label: "Waiting on You", status, summary }
}
