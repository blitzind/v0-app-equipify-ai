/** Client-safe Growth Engine calendar booking intelligence types (Phase 2O). */

export const GROWTH_CALENDAR_BOOKING_INTELLIGENCE_QA_MARKER = "growth-calendar-booking-intelligence-v1" as const

export const GROWTH_CALENDAR_BOOKING_INTELLIGENCE_PRIVACY_NOTE =
  "Booking intelligence provides evidence-backed meeting recommendations only. Human approval required — no autonomous booking, calendar writes, or sequence stop."

export const GROWTH_BOOKING_INTENT_TYPES = [
  "meeting_request",
  "demo_request",
  "pricing_call",
  "technical_call",
  "follow_up_call",
  "decision_maker_call",
  "referral_intro",
] as const
export type GrowthBookingIntentType = (typeof GROWTH_BOOKING_INTENT_TYPES)[number]

export const GROWTH_BOOKING_RECOMMENDATION_STATUSES = [
  "pending_review",
  "approved",
  "dismissed",
  "completed",
  "expired",
] as const
export type GrowthBookingRecommendationStatus = (typeof GROWTH_BOOKING_RECOMMENDATION_STATUSES)[number]

export const GROWTH_CALENDAR_ROUTING_RULE_TYPES = [
  "owner",
  "round_robin",
  "territory",
  "industry",
  "account_priority",
  "manual",
] as const
export type GrowthCalendarRoutingRuleType = (typeof GROWTH_CALENDAR_ROUTING_RULE_TYPES)[number]

export const GROWTH_BOOKING_SIGNAL_CONFIDENCE_LEVELS = ["low", "medium", "high", "verified"] as const
export type GrowthBookingSignalConfidence = (typeof GROWTH_BOOKING_SIGNAL_CONFIDENCE_LEVELS)[number]

export type GrowthBookingEvidenceSnippet = {
  source: string
  snippet: string
  intentType?: GrowthBookingIntentType
  confidence?: GrowthBookingSignalConfidence
}

export type GrowthBookingIntentSignal = {
  id: string
  leadId: string
  leadLabel: string
  inboxThreadId: string | null
  intentType: GrowthBookingIntentType
  confidence: GrowthBookingSignalConfidence
  evidenceSnippet: string
  source: string
  detectedAt: string
  metadata: Record<string, unknown>
}

export type GrowthBookingRecommendation = {
  id: string
  leadId: string
  leadLabel: string
  inboxThreadId: string | null
  intentSignalId: string | null
  recommendationType: string
  status: GrowthBookingRecommendationStatus
  title: string
  description: string
  evidence: GrowthBookingEvidenceSnippet[]
  routingRuleType: GrowthCalendarRoutingRuleType | null
  suggestedOwnerLabel: string | null
  availabilityHint: string | null
  requiresHumanApproval: true
  approvedBy: string | null
  dismissedBy: string | null
  completedBy: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
  metadata: Record<string, unknown>
}

export type GrowthCalendarRoutingRule = {
  id: string
  ruleType: GrowthCalendarRoutingRuleType
  label: string
  priority: number
  isActive: boolean
  matchCriteria: Record<string, unknown>
  targetOwnerLabel: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type GrowthBookingAttributionEvent = {
  id: string
  leadId: string
  leadLabel: string
  recommendationId: string | null
  intentSignalId: string | null
  eventType: string
  attributionSource: string
  sequenceEnrollmentId: string | null
  weightedScore: number
  occurredAt: string
}

export type GrowthMeetingConversionEvent = {
  id: string
  leadId: string | null
  recommendationId: string | null
  eventType: string
  severity: "info" | "low" | "medium" | "high" | "critical"
  title: string
  description: string
  createdAt: string
}

export type GrowthSequenceMeetingExitCandidate = {
  id: string
  leadId: string
  leadLabel: string
  reason: string
  evidenceSnippet: string
  recommendationId: string | null
  detectedAt: string
}

export type GrowthBookingIntelligenceDashboard = {
  qa_marker: typeof GROWTH_CALENDAR_BOOKING_INTELLIGENCE_QA_MARKER
  meetingIntentCount: number
  pendingBookingReviews: GrowthBookingRecommendation[]
  approvedBookingActions: GrowthBookingRecommendation[]
  completedMeetings: GrowthBookingRecommendation[]
  sequenceStopCandidates: GrowthSequenceMeetingExitCandidate[]
  conversionAttribution: GrowthBookingAttributionEvent[]
  bookingRecommendations: GrowthBookingRecommendation[]
  intentSignals: GrowthBookingIntentSignal[]
  routingRules: GrowthCalendarRoutingRule[]
  attributionEvents: GrowthBookingAttributionEvent[]
  recentConversionEvents: GrowthMeetingConversionEvent[]
}

export function maskBookingLeadLabel(leadId: string, companyName?: string | null): string {
  if (companyName?.trim()) return companyName.trim().slice(0, 80)
  return `Account ${leadId.slice(0, 8)}…`
}

export function intentTypeLabel(type: GrowthBookingIntentType): string {
  return type.replace(/_/g, " ")
}

export function routingRuleTypeLabel(type: GrowthCalendarRoutingRuleType): string {
  return type.replace(/_/g, " ")
}

export function sanitizeBookingEvidenceSnippet(text: string, maxLength = 280): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
}
