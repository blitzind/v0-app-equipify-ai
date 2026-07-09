/** GE-AIOS-13A — Inbox monitoring rhythm phase. */

import type { AvaOperatingPhaseEntry, AvaOperatingPhaseId, OperatingRhythmPhaseInput } from "@/lib/growth/operating-rhythm/types"

export function evaluateInboxCyclePhase(input: OperatingRhythmPhaseInput): AvaOperatingPhaseEntry {
  const replies = input.metrics.repliesToday
  const inboxWaiting = input.workResult.all_work_items.some((item) => item.type === "reply")
  const activeReply = input.workResult.active_work?.type === "reply"
  const hasInterruption = input.workResult.interruptions.length > 0

  let status: AvaOperatingPhaseEntry["status"] = "pending"
  if (replies > 0 && (activeReply || hasInterruption)) status = "active"
  else if (replies > 0 && input.hour >= 15) status = "completed"
  else if (inboxWaiting) status = input.currentPhase === "inbox_monitoring" ? "active" : "pending"

  const summary =
    hasInterruption
      ? "Customer reply detected — lower-priority work paused."
      : replies > 0
        ? `Monitoring ${replies} ${replies === 1 ? "reply" : "replies"}.`
        : null

  return { id: "inbox_monitoring" as AvaOperatingPhaseId, label: "Inbox Monitoring", status, summary }
}
