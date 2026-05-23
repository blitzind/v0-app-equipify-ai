import type { GrowthLeadCallDisposition } from "@/lib/growth/call-types"

export function computeCallOutcomeConfidence(input: {
  buyingSignalCount: number
  commitmentSignalCount: number
  objectionCount: number
  suggestedDisposition?: string | null
  highRiskCall?: boolean
}): number {
  let score = 40
  score += Math.min(input.buyingSignalCount * 8, 24)
  score += Math.min(input.commitmentSignalCount * 10, 30)
  score -= Math.min(input.objectionCount * 4, 16)
  if (input.suggestedDisposition === "interested") score += 12
  if (input.suggestedDisposition === "not_a_fit") score -= 10
  if (input.highRiskCall) score -= 8
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function suggestCallDisposition(input: {
  commitmentSignals: Array<{ key: string }>
  buyingSignals: Array<{ key: string }>
  liveNotes: string
}): GrowthLeadCallDisposition {
  const commitmentKeys = new Set(input.commitmentSignals.map((s) => s.key))
  if (
    commitmentKeys.has("meeting_scheduled") ||
    commitmentKeys.has("send_proposal") ||
    commitmentKeys.has("trial_interest")
  ) {
    return "interested"
  }
  if (commitmentKeys.has("call_back_date") || input.buyingSignals.some((s) => s.key === "requested_follow_up")) {
    return "follow_up_later"
  }
  if (/not a fit|disqualif/i.test(input.liveNotes)) return "not_a_fit"
  if (/voicemail|no answer/i.test(input.liveNotes)) return "left_voicemail"
  return "call_attempted"
}

export function computeBriefEffectivenessScore(outcome: string, callOutcomeConfidence: number): number {
  const base: Record<string, number> = {
    briefing_viewed: 50,
    session_started: 55,
    objection_captured: 60,
    signal_captured: 65,
    session_completed: 70,
    summary_approved: 85,
    disposition_approved: 95,
    session_discarded: 20,
  }
  const raw = (base[outcome] ?? 50) + Math.round(callOutcomeConfidence * 0.15)
  return Math.max(0, Math.min(100, raw))
}
