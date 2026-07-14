/** Client-safe Growth Engine Call Copilot types. */

import type { GrowthLeadCallDisposition } from "@/lib/growth/call-types"

export const GROWTH_CALL_COPILOT_SESSION_STATUSES = [
  "pre_call",
  "in_call",
  "completed",
  "discarded",
] as const
export type GrowthCallCopilotSessionStatus = (typeof GROWTH_CALL_COPILOT_SESSION_STATUSES)[number]

export const GROWTH_CALL_COPILOT_LIVE_GUIDANCE_MODES = ["manual", "future_realtime"] as const
export type GrowthCallCopilotLiveGuidanceMode = (typeof GROWTH_CALL_COPILOT_LIVE_GUIDANCE_MODES)[number]

export const GROWTH_CALL_COPILOT_BUYING_SIGNAL_KEYS = [
  "budget_mentioned",
  "decision_maker_confirmed",
  "asked_for_demo",
  "asked_for_pricing",
  "requested_follow_up",
  "competitor_mentioned",
  "timing_discussed",
] as const
export type GrowthCallCopilotBuyingSignalKey = (typeof GROWTH_CALL_COPILOT_BUYING_SIGNAL_KEYS)[number]

export const GROWTH_CALL_COPILOT_COMMITMENT_SIGNAL_KEYS = [
  "meeting_scheduled",
  "intro_promised",
  "send_proposal",
  "call_back_date",
  "trial_interest",
  "implementation_question",
] as const
export type GrowthCallCopilotCommitmentSignalKey =
  (typeof GROWTH_CALL_COPILOT_COMMITMENT_SIGNAL_KEYS)[number]

export const GROWTH_CALL_BRIEF_EFFECTIVENESS_OUTCOMES = [
  "briefing_viewed",
  "session_started",
  "objection_captured",
  "signal_captured",
  "session_completed",
  "summary_approved",
  "disposition_approved",
  "session_discarded",
] as const
export type GrowthCallBriefEffectivenessOutcome = (typeof GROWTH_CALL_BRIEF_EFFECTIVENESS_OUTCOMES)[number]

export type GrowthCallCopilotCapturedSignal = {
  key: string
  label: string
  note?: string | null
  capturedAt: string
  capturedBy?: string | null
}

export type GrowthCallCopilotObjectionEntry = {
  id: string
  input: string
  frameworkKey?: string | null
  response?: string | null
  generationId?: string | null
  capturedAt: string
  capturedBy?: string | null
}

export type GrowthCallCopilotBriefing = {
  whoToCall: {
    contactName: string | null
    companyName: string
    phone: string | null
    decisionMakers: Array<{ name: string; title: string | null; status: string | null }>
  }
  whyNow: string
  likelyObjections: string[]
  openingLine: string
  /** Approved Growth 5F call guide when present — operator/execution authority. */
  canonicalCallGuide?: string | null
  canonicalCallGuideSource?: string | null
  channelsParityMarker?: string | null
  recommendedCta: string
  doNotSay: string[]
  riskWarnings: string[]
  highRiskCall: boolean
  playbookInfluence?: {
    score: number
    ruleTitles: string[]
  }
  relationshipMemory?: {
    available: boolean
    relationshipStage: string | null
    relationshipSummary: string | null
    topObjections: string[]
    topPreferences: string[]
    priorInteractions: string[]
    commitments: string[]
    riskFlags: string[]
  }
}

export type GrowthCallCopilotSession = {
  id: string
  leadId: string
  callSessionId: string | null
  status: GrowthCallCopilotSessionStatus
  liveGuidanceMode: GrowthCallCopilotLiveGuidanceMode
  startedAt: string | null
  endedAt: string | null
  callGoal: string | null
  callContextSnapshot: Record<string, unknown> & { briefing?: GrowthCallCopilotBriefing }
  liveNotes: string
  detectedObjections: GrowthCallCopilotObjectionEntry[]
  detectedBuyingSignals: GrowthCallCopilotCapturedSignal[]
  detectedCommitmentSignals: GrowthCallCopilotCapturedSignal[]
  recommendedResponses: Record<string, unknown>
  postCallSummary: string | null
  recommendedNextStep: string | null
  suggestedDisposition: GrowthLeadCallDisposition | null
  callOutcomeConfidence: number
  postCallGenerationId: string | null
  summaryApprovedAt: string | null
  summaryApprovedBy: string | null
  dispositionApprovedAt: string | null
  dispositionApprovedBy: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export const GROWTH_CALL_COPILOT_BUYING_SIGNAL_LABELS: Record<GrowthCallCopilotBuyingSignalKey, string> = {
  budget_mentioned: "Budget Mentioned",
  decision_maker_confirmed: "Decision Maker Confirmed",
  asked_for_demo: "Asked For Demo",
  asked_for_pricing: "Asked For Pricing",
  requested_follow_up: "Requested Follow-Up",
  competitor_mentioned: "Competitor Mentioned",
  timing_discussed: "Timing Discussed",
}

export const GROWTH_CALL_COPILOT_COMMITMENT_SIGNAL_LABELS: Record<
  GrowthCallCopilotCommitmentSignalKey,
  string
> = {
  meeting_scheduled: "Meeting Scheduled",
  intro_promised: "Intro Promised",
  send_proposal: "Send Proposal",
  call_back_date: "Call Back Date",
  trial_interest: "Trial Interest",
  implementation_question: "Implementation Question",
}
