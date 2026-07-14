/**
 * GE-AIOS-DECISION-ENGINE-1D — Stored closure → decision input mapping (client-safe).
 */

import type { GrowthCanonicalDecisionInput } from "@/lib/growth/aios/growth/growth-canonical-decision-engine-1a-input"
import type { GrowthCallWorkspacePostCallClosure } from "@/lib/growth/operator-assist/call-workspace-post-call-closure-types"

function extractAgreedWaitUntil(closure: GrowthCallWorkspacePostCallClosure): string | null {
  const timelineLine = closure.businessConclusions.find((row) =>
    /q[1-4]|next quarter|wait until|october/i.test(row),
  )
  if (!timelineLine) return null
  const iso = timelineLine.match(/\d{4}-\d{2}-\d{2}/)?.[0]
  if (iso) return iso
  if (/q4|october|next quarter/i.test(timelineLine)) return "2026-10-01"
  return null
}

export function mapStoredClosureToDecisionPostCall(
  closure: GrowthCallWorkspacePostCallClosure,
): NonNullable<GrowthCanonicalDecisionInput["postCall"]> {
  const businessText = closure.businessConclusions.join(" ").toLowerCase()
  const meetingBooked =
    closure.callOutcome.outcome === "meeting_booked" ||
    closure.recommendedNextAction.kind === "schedule_next_meeting" ||
    /meeting booked|workflow review/i.test(closure.meetingSummary)

  return {
    commitments: closure.commitments,
    objections: closure.objections,
    buyingSignals: closure.buyingSignals,
    businessConclusions: closure.businessConclusions,
    operatorOutcome: closure.callOutcome.outcome,
    meetingBooked,
    timelineDetected:
      closure.recommendedNextAction.kind === "wait_until_agreed_date" ||
      /next quarter|q[1-4]|timing is/i.test(businessText),
    agreedWaitUntil: extractAgreedWaitUntil(closure),
  }
}
