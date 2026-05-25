/** Client-safe human-approved multi-channel execution types (slice 6.32A). */

export const GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER = "human-approved-execution-v1" as const

export const HUMAN_EXECUTION_READINESS_BANDS = ["critical", "high", "normal", "low"] as const
export type HumanExecutionReadinessBand = (typeof HUMAN_EXECUTION_READINESS_BANDS)[number]

export const HUMAN_EXECUTION_APPROVAL_STATUSES = [
  "draft",
  "review",
  "approved",
  "executed",
  "complete",
  "cancelled",
] as const
export type HumanExecutionApprovalStatus = (typeof HUMAN_EXECUTION_APPROVAL_STATUSES)[number]

export const HUMAN_EXECUTION_PLAN_STATUSES = ["draft", "active", "paused", "completed", "cancelled"] as const
export type HumanExecutionPlanStatus = (typeof HUMAN_EXECUTION_PLAN_STATUSES)[number]

export const HUMAN_EXECUTION_CHANNELS = [
  "email",
  "sms",
  "manual_call",
  "voicemail",
  "linkedin_message",
  "manual_task",
] as const
export type HumanExecutionChannel = (typeof HUMAN_EXECUTION_CHANNELS)[number]

export const HUMAN_EXECUTION_SEQUENCE_TEMPLATES = [
  "standard_outreach",
  "high_touch",
  "re_engagement",
  "meeting_push",
] as const
export type HumanExecutionSequenceTemplate = (typeof HUMAN_EXECUTION_SEQUENCE_TEMPLATES)[number]

export const HUMAN_EXECUTION_REPLY_ROUTES = [
  "meeting_queue",
  "operator_queue",
  "suppression_suggestion",
  "resume_recommendation",
  "no_route",
] as const
export type HumanExecutionReplyRoute = (typeof HUMAN_EXECUTION_REPLY_ROUTES)[number]

export const HUMAN_EXECUTION_READINESS_SIGNAL_KEYS = [
  "deal_intelligence",
  "revenue_execution_score",
  "call_intelligence",
  "engagement_score",
  "reply_sentiment",
  "meeting_outcomes",
  "research_maturity",
  "opportunity_value",
  "inactivity_risk",
  "expansion_potential",
] as const
export type HumanExecutionReadinessSignalKey = (typeof HUMAN_EXECUTION_READINESS_SIGNAL_KEYS)[number]

export type HumanExecutionReadinessSignal = {
  key: HumanExecutionReadinessSignalKey
  label: string
  weight: number
  contribution: number
}

export type HumanExecutionReadinessInput = {
  dealCloseProbability?: number | null
  dealRiskScore?: number | null
  revenueExecutionScore?: number | null
  callOverallScore?: number | null
  callNextStepScore?: number | null
  engagementScore?: number | null
  replyIntent?: string | null
  replyPriority?: string | null
  meetingOutcome?: string | null
  meetingFollowUpOverdue?: boolean
  researchMaturityScore?: number | null
  opportunityAmount?: number | null
  daysSinceLastTouch?: number | null
  expansionCandidate?: boolean
}

export type HumanExecutionReadinessResult = {
  readinessScore: number
  readinessBand: HumanExecutionReadinessBand
  signals: HumanExecutionReadinessSignal[]
  callNowRecommended: boolean
}

export type HumanExecutionSequenceStepDraft = {
  stepOrder: number
  dayOffset: number
  channel: HumanExecutionChannel
  title: string
  instructions: string
  cooldownHours: number
}

export type HumanExecutionSequenceRules = {
  stopOnPositiveReply: boolean
  pauseOnObjection: boolean
  pauseOnMeetingBooked: boolean
  fatigueProtection: boolean
  minCooldownHours: number
  maxTouchesPerWeek: number
}

export type HumanExecutionSequencePlan = {
  templateKey: HumanExecutionSequenceTemplate
  templateLabel: string
  rules: HumanExecutionSequenceRules
  steps: HumanExecutionSequenceStepDraft[]
}

export type HumanExecutionReplyRoutingResult = {
  route: HumanExecutionReplyRoute
  routeLabel: string
  requiresHumanApproval: boolean
  recommendation: string
  ctaHref: string | null
}

export type HumanExecutionApprovalItem = {
  id: string
  leadId: string
  companyName: string
  planId: string | null
  planStepId: string | null
  channel: HumanExecutionChannel
  channelLabel: string
  approvalStatus: HumanExecutionApprovalStatus
  readinessScore: number
  readinessBand: HumanExecutionReadinessBand
  title: string
  why: string
  suggestedChannel: HumanExecutionChannel | null
  suggestedTiming: string | null
  ownerUserId: string | null
  replyRouting: HumanExecutionReplyRoute | null
  replyRoutingLabel: string | null
  createdAt: string
  updatedAt: string
  ctaHref: string
}

export type HumanExecutionQueueItem = {
  id: string
  leadId: string
  companyName: string
  title: string
  why: string
  readinessScore: number
  readinessBand: HumanExecutionReadinessBand
  channel: HumanExecutionChannel
  channelLabel: string
  approvalStatus: HumanExecutionApprovalStatus
  suggestedTiming: string | null
  callNowRecommended: boolean
  ownerUserId: string | null
  ctaHref: string
}

export type HumanExecutionDashboardMetrics = {
  approvalPending: number
  readyNow: number
  revenueInfluenced: number
  sequencesActive: number
  replyRatePercent: number
  meetingsCreated: number
  humanApprovalSlaHours: number
  callNowOpportunities: number
  contactFatiguePrevented: number
}

export type HumanExecutionLeadView = {
  qaMarker: typeof GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER
  leadId: string
  companyName: string
  readiness: HumanExecutionReadinessResult
  recommendedSequence: HumanExecutionSequencePlan | null
  approvalStatus: HumanExecutionApprovalStatus | null
  approvalStatusLabel: string | null
  suggestedChannel: HumanExecutionChannel | null
  suggestedChannelLabel: string | null
  suggestedTiming: string | null
  pendingApprovals: HumanExecutionApprovalItem[]
  activePlanStatus: HumanExecutionPlanStatus | null
}

export type GrowthHumanExecutionDashboard = {
  qaMarker: typeof GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER
  generatedAt: string
  metrics: HumanExecutionDashboardMetrics
  approvalQueue: HumanExecutionApprovalItem[]
  readyQueue: HumanExecutionQueueItem[]
  criticalOpportunities: HumanExecutionQueueItem[]
  callNowRecommendations: HumanExecutionQueueItem[]
}

export type GrowthHumanExecutionQueue = {
  qaMarker: typeof GROWTH_HUMAN_APPROVED_EXECUTION_QA_MARKER
  generatedAt: string
  items: HumanExecutionQueueItem[]
}

export const HUMAN_EXECUTION_CHANNEL_LABELS: Record<HumanExecutionChannel, string> = {
  email: "Email",
  sms: "SMS",
  manual_call: "Call task",
  voicemail: "Voicemail task",
  linkedin_message: "LinkedIn task",
  manual_task: "Manual custom task",
}

export const HUMAN_EXECUTION_APPROVAL_STATUS_LABELS: Record<HumanExecutionApprovalStatus, string> = {
  draft: "Draft",
  review: "Review",
  approved: "Approved",
  executed: "Executed",
  complete: "Complete",
  cancelled: "Cancelled",
}

export const HUMAN_EXECUTION_REPLY_ROUTE_LABELS: Record<HumanExecutionReplyRoute, string> = {
  meeting_queue: "Meeting queue",
  operator_queue: "Operator queue",
  suppression_suggestion: "Suppression suggestion",
  resume_recommendation: "Resume recommendation",
  no_route: "No route",
}

export const HUMAN_EXECUTION_SEQUENCE_TEMPLATE_LABELS: Record<HumanExecutionSequenceTemplate, string> = {
  standard_outreach: "Standard outreach",
  high_touch: "High-touch pursuit",
  re_engagement: "Re-engagement",
  meeting_push: "Meeting push",
}
