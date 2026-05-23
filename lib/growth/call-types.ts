/** Client-safe Growth Engine call queue types. */

export const GROWTH_LEAD_CALL_DISPOSITIONS = [
  "call_attempted",
  "left_voicemail",
  "interested",
  "not_a_fit",
  "follow_up_later",
  "no_answer",
] as const

export type GrowthLeadCallDisposition = (typeof GROWTH_LEAD_CALL_DISPOSITIONS)[number]

export const GROWTH_CALL_PRIORITY_TIERS = ["low", "medium", "high", "critical"] as const

export type GrowthCallPriorityTier = (typeof GROWTH_CALL_PRIORITY_TIERS)[number]

export const GROWTH_CALL_QUEUE_FILTERS = [
  "call_ready",
  "high_fit",
  "needs_research",
  "needs_website_research",
  "hot",
  "engaged",
  "dormant",
  "recently_active",
  "decision_maker_engaged",
] as const

export type GrowthCallQueueFilter = (typeof GROWTH_CALL_QUEUE_FILTERS)[number]

export type GrowthLeadCallEvent = {
  id: string
  leadId: string
  disposition: GrowthLeadCallDisposition
  note: string | null
  followUpAt: string | null
  callPriorityScore: number | null
  createdBy: string | null
  createdAt: string
}

export type GrowthCallQueueRow = {
  leadId: string
  rank: number
  companyName: string
  contactName: string | null
  contactPhone: string | null
  city: string | null
  state: string | null
  status: string
  researchPriority: string
  score: number | null
  callPriorityScore: number | null
  callPriorityTier: GrowthCallPriorityTier | null
  callPriorityOverride: number | null
  callDisposition: GrowthLeadCallDisposition | null
  followUpAt: string | null
  lastResearchedAt: string | null
  lastCallAt: string | null
  lastHumanTouchAt: string | null
  recommendedNextAction: string | null
  websiteFetchStatus: string | null
  whySummary: string
  nextBestAction: string | null
  nextBestActionReason: string | null
  decisionMakerStatus: string | null
  primaryDecisionMakerName: string | null
  momentumScore: number | null
  momentumTier: string | null
  workflowHealth: string | null
  sourceChannel: string | null
  sourceCampaign: string | null
  sourceKind: string
  agingDays: number | null
  agingBucket: string | null
  engagementScore: number | null
  engagementTier: string | null
  engagementLastActivityAt: string | null
  engagementSummary: string | null
}
