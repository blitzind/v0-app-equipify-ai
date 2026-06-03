/** Client-safe reply intent + inbox types (Growth Engine slice 6.22A + Phase 5). */

export const GROWTH_REPLY_INTELLIGENCE_QA_MARKER = "reply-intelligence-v1"
export const GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER = "growth-reply-intelligence-v1" as const

export const GROWTH_REPLY_INTENTS = [
  "positive_interest",
  "meeting_request",
  "demo_request",
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
  "neutral_acknowledgement",
  "angry_complaint",
  "needs_more_information",
  "unknown",
] as const

export const GROWTH_REPLY_CONFIDENCE_TIERS = ["high", "medium", "low", "uncertain"] as const
export type GrowthReplyConfidenceTier = (typeof GROWTH_REPLY_CONFIDENCE_TIERS)[number]

export const GROWTH_REPLY_UNCERTAINTY_STATES = [
  "confident",
  "partial",
  "ambiguous",
  "insufficient_evidence",
] as const
export type GrowthReplyUncertaintyState = (typeof GROWTH_REPLY_UNCERTAINTY_STATES)[number]

export const GROWTH_REPLY_INGESTION_SOURCES = [
  "provider_webhook",
  "google_mailbox_sync",
  "tracking_event",
  "manual_import",
] as const
export type GrowthReplyIngestionSource = (typeof GROWTH_REPLY_INGESTION_SOURCES)[number]

export const GROWTH_REPLY_WORKFLOW_ACTION_TYPES = [
  "create_follow_up_task",
  "create_call_task",
  "mark_interested",
  "stop_sequence",
  "suppress_outreach",
  "flag_manual_review",
  "route_demo_scheduling",
  "route_pricing_response",
  "route_wrong_person",
  "route_complaint_review",
] as const
export type GrowthReplyWorkflowActionType = (typeof GROWTH_REPLY_WORKFLOW_ACTION_TYPES)[number]

export const GROWTH_REPLY_SALES_EXECUTION_VIEWS = [
  "needs_review",
  "interested",
  "demo_requests",
  "pricing_questions",
  "objection_heavy",
  "stop_unsubscribe",
  "angry_complaint",
  "low_confidence",
  "workflow_tasks",
] as const
export type GrowthReplySalesExecutionView = (typeof GROWTH_REPLY_SALES_EXECUTION_VIEWS)[number]

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
  demo_request: "Demo request",
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
  neutral_acknowledgement: "Neutral acknowledgement",
  angry_complaint: "Angry / complaint",
  needs_more_information: "Needs more information",
  unknown: "Unknown",
}

export type GrowthReplyMatchedPhrase = {
  phrase: string
  excerpt: string
  category: string
}

export type GrowthReplyClassificationV2 = {
  intent: GrowthReplyIntent
  classificationReason: string
  matchedPhrases: GrowthReplyMatchedPhrase[]
  confidence: number
  confidenceTier: GrowthReplyConfidenceTier
  uncertaintyState: GrowthReplyUncertaintyState
  recommendedOperatorAction: string
  aiAssisted: boolean
  buyingSignals: GrowthReplyBuyingSignalEvidence[]
  objections: GrowthReplyObjectionEvidence[]
}

export type GrowthReplyBuyingSignalEvidence = {
  signal: string
  excerpt: string
  confidence: number
}

export type GrowthReplyObjectionEvidence = {
  category: string
  summary: string
  excerpt: string
  confidence: number
  suggestedResponseAngle: string
  suggestedReplyDraft: string
}

export type GrowthConversationTimelineEntry = {
  id: string
  eventKind: string
  eventSource: string
  title: string
  summary: string
  evidenceExcerpt: string | null
  occurredAt: string
  payload: Record<string, unknown>
}

export type GrowthReplyCopilotAssist = {
  qaMarker: typeof GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER
  assistedLabel: "AI-assisted"
  summary: string
  intent: GrowthReplyIntent
  objections: string[]
  suggestedNextStep: string
  suggestedReplyDraft: string
  suggestedInternalNote: string
  callPrepBullets: string[]
  confidenceTier: GrowthReplyConfidenceTier
  uncertaintyState: GrowthReplyUncertaintyState
  evidenceExcerpts: string[]
  memoryContext?: string[]
  memoryAvoidRepeating?: string[]
}

export type GrowthSalesExecutionDashboard = GrowthReplyInboxDashboard & {
  v2QaMarker: typeof GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER
  needsReviewCount: number
  interestedCount: number
  demoRequestCount: number
  pricingQuestionCount: number
  objectionHeavyCount: number
  stopUnsubscribeCount: number
  angryComplaintCount: number
  lowConfidenceCount: number
  workflowTaskCount: number
  campaignLearning: {
    positiveReplyRate: number
    objectionRate: number
    unsubscribeReplyRate: number
    demoRequestRate: number
    pricingQuestionRate: number
  }
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
  v2QaMarker?: typeof GROWTH_REPLY_INTELLIGENCE_V2_QA_MARKER
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
