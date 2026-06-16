/** Growth Engine S2-J — meeting readiness scoring model (foundation only, no calendar execution). Client-safe. */

export const GROWTH_MEDIA_MEETING_READINESS_QA_MARKER = "growth-media-meeting-readiness-s2j-v1" as const

export const GROWTH_MEDIA_MEETING_READINESS_TIERS = [
  "not_ready",
  "early_interest",
  "qualified",
  "meeting_ready",
  "high_intent",
] as const

export type GrowthMediaMeetingReadinessTier = (typeof GROWTH_MEDIA_MEETING_READINESS_TIERS)[number]

export type GrowthMediaMeetingReadinessSnapshot = {
  fitScore: number
  buyingCommitteeCoverage: number
  decisionMakerIdentified: boolean
  timelineKnown: boolean
  budgetKnown: boolean
  meetingIntent: "exploratory" | "evaluation" | "decision" | "unknown"
  engagementSignals: string[]
  qaConfidence: number
  conversationConfidence: number
  readinessTier: GrowthMediaMeetingReadinessTier
  readinessScore: number
}

export type GrowthMediaMeetingReadinessInput = {
  qualificationGoal?: string | null
  prospectName?: string | null
  companyName?: string | null
  aiQaEnabled?: boolean
  conversationEnabled?: boolean
  bookingHandoffEnabled?: boolean
}
