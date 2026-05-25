/** Client-safe reply intent + inbox types (Growth Engine slice 6.22A). */

export const GROWTH_REPLY_INTELLIGENCE_QA_MARKER = "reply-intelligence-v1"

export const GROWTH_REPLY_INTENTS = [
  "positive_interest",
  "meeting_request",
  "pricing_question",
  "timing_delay",
  "objection",
  "not_interested",
  "unsubscribe",
  "referral",
  "wrong_contact",
  "out_of_office",
  "competitor_mention",
  "support_request",
  "unknown",
] as const

export type GrowthReplyIntent = (typeof GROWTH_REPLY_INTENTS)[number]

export const GROWTH_REPLY_PRIORITIES = ["critical", "high", "medium", "low"] as const
export type GrowthReplyPriority = (typeof GROWTH_REPLY_PRIORITIES)[number]

export const GROWTH_REPLY_NEXT_ACTIONS = [
  "call_prospect",
  "reply_email",
  "schedule_meeting",
  "update_opportunity",
  "follow_up_later",
  "verify_contact",
  "manual_review",
] as const

export type GrowthReplyNextAction = (typeof GROWTH_REPLY_NEXT_ACTIONS)[number]

export const GROWTH_REPLY_INBOX_VIEWS = [
  "my_inbox",
  "needs_action",
  "unanswered",
  "meeting_intent",
  "objections",
  "high_priority",
  "competitor_mentions",
  "waiting_on_prospect",
] as const

export type GrowthReplyInboxView = (typeof GROWTH_REPLY_INBOX_VIEWS)[number]

export const GROWTH_REPLY_BUYING_SIGNALS = [
  "pricing_asked",
  "timeline_urgency",
  "stakeholder_mention",
  "implementation_question",
  "integration_question",
] as const

export type GrowthReplyBuyingSignal = (typeof GROWTH_REPLY_BUYING_SIGNALS)[number]

export const GROWTH_REPLY_OBJECTION_SIGNALS = [
  "too_expensive",
  "no_time",
  "already_have_solution",
  "internal_resistance",
] as const

export type GrowthReplyObjectionSignal = (typeof GROWTH_REPLY_OBJECTION_SIGNALS)[number]

export const GROWTH_REPLY_ESCALATION_SIGNALS = [
  "competitor_mentioned",
  "multiple_stakeholders",
  "contract_timing",
  "executive_involvement",
] as const

export type GrowthReplyEscalationSignal = (typeof GROWTH_REPLY_ESCALATION_SIGNALS)[number]

export const GROWTH_REPLY_INTENT_LABELS: Record<GrowthReplyIntent, string> = {
  positive_interest: "Positive interest",
  meeting_request: "Meeting request",
  pricing_question: "Pricing question",
  timing_delay: "Timing delay",
  objection: "Objection",
  not_interested: "Not interested",
  unsubscribe: "Unsubscribe",
  referral: "Referral",
  wrong_contact: "Wrong contact",
  out_of_office: "Out of office",
  competitor_mention: "Competitor mention",
  support_request: "Support request",
  unknown: "Unknown",
}

export const GROWTH_REPLY_NEXT_ACTION_LABELS: Record<GrowthReplyNextAction, string> = {
  call_prospect: "Call Prospect",
  reply_email: "Reply Email",
  schedule_meeting: "Schedule Meeting",
  update_opportunity: "Update Opportunity",
  follow_up_later: "Follow Up Later",
  verify_contact: "Verify Contact",
  manual_review: "Manual Review",
}

export type GrowthReplyIntelligenceRecord = {
  replyId: string
  leadId: string
  ownerUserId: string | null
  intent: GrowthReplyIntent
  priority: GrowthReplyPriority
  nextAction: GrowthReplyNextAction
  threadReplyCount: number
  firstReplyAt: string | null
  lastReplyAt: string
  responseLatencyMs: number | null
  unanswered: boolean
  ownerWaiting: boolean
  replySlaDueAt: string | null
  buyingSignals: GrowthReplyBuyingSignal[]
  objectionSignals: GrowthReplyObjectionSignal[]
  escalationSignals: GrowthReplyEscalationSignal[]
  companyName?: string | null
  bodyPreview?: string | null
  receivedAt: string
  classification: string
  confidence: number
}

export type GrowthReplyInboxItem = GrowthReplyIntelligenceRecord & {
  connectionId: string
  messageEventId: string
  classification: string
  sentiment: string
  classificationLocked: boolean
}

export type GrowthReplyInboxFeed = {
  items: GrowthReplyInboxItem[]
  total: number
}

export type GrowthReplyInboxDashboard = {
  qaMarker: typeof GROWTH_REPLY_INTELLIGENCE_QA_MARKER
  totalReplies: number
  highPriorityCount: number
  criticalCount: number
  meetingRequestCount: number
  competitorMentionCount: number
  unansweredCount: number
  ownerWaitingCount: number
  overdueCount: number
  averageResponseLatencyMs: number
  replyTrend: Array<{ label: string; count: number }>
}
