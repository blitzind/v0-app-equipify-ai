/** Client-safe Live Guidance types (Growth Engine slice 6.10A). */

export const GROWTH_LIVE_GUIDANCE_EVENT_TYPES = [
  "objection_guidance",
  "discovery_gap_guidance",
  "competitor_response",
  "talking_too_much",
  "ask_followup_question",
  "buying_signal_detected",
  "urgency_detected",
  "pricing_pressure",
  "executive_risk",
  "close_attempt_recommended",
  "meeting_lock_prompt",
  "silence_recovery",
  "momentum_drop",
  "relationship_recovery",
] as const

export type GrowthLiveGuidanceEventType = (typeof GROWTH_LIVE_GUIDANCE_EVENT_TYPES)[number]

export const GROWTH_LIVE_GUIDANCE_SEVERITIES = ["low", "medium", "high"] as const
export type GrowthLiveGuidanceSeverity = (typeof GROWTH_LIVE_GUIDANCE_SEVERITIES)[number]

export const GROWTH_LIVE_EXECUTION_BADGES = [
  "elite_operator",
  "strong",
  "good",
  "recoverable",
  "at_risk",
] as const

export type GrowthLiveExecutionBadge = (typeof GROWTH_LIVE_EXECUTION_BADGES)[number]

export const GROWTH_LIVE_EXECUTION_BADGE_LABELS: Record<GrowthLiveExecutionBadge, string> = {
  elite_operator: "Elite Operator",
  strong: "Strong",
  good: "Good",
  recoverable: "Recoverable",
  at_risk: "At Risk",
}

export type GrowthLiveGuidanceEvent = {
  id: string
  organizationId: string | null
  leadId: string
  realtimeCallSessionId: string
  eventType: GrowthLiveGuidanceEventType
  severity: GrowthLiveGuidanceSeverity
  title: string
  operatorPrompt: string
  recommendation: string
  supportingReason: string
  confidenceScore: number
  surfacedAt: string
  dismissedAt: string | null
  acceptedAt: string | null
  createdAt: string
}

export type GrowthLiveGuidanceCandidate = {
  dedupeKey: string
  eventType: GrowthLiveGuidanceEventType
  severity: GrowthLiveGuidanceSeverity
  title: string
  operatorPrompt: string
  recommendation: string
  supportingReason: string
  confidenceScore: number
}

export type GrowthLiveExecutionScore = {
  score: number
  badge: GrowthLiveExecutionBadge
  badgeLabel: string
  factors: {
    talkRatio: number
    discoveryCoverage: number
    objectionsHandled: number
    buyingSignalsCaptured: number
    timelineDiscovered: boolean
    decisionMakerIdentified: boolean
    nextStepSecured: boolean
  }
}

export type GrowthLiveCoachingState = {
  executionScore: GrowthLiveExecutionScore
  suggestedNextQuestion: string | null
  riskLevel: "low" | "medium" | "high"
  momentum: "building" | "stable" | "slowing" | "at_risk"
  activeGuidance: GrowthLiveGuidanceEvent[]
  guidanceLatencyMs: number
}

/** Guidance never triggers autonomous actions — navigation/coaching only. */
export const LIVE_GUIDANCE_AUTONOMOUS_ACTIONS: string[] = []
