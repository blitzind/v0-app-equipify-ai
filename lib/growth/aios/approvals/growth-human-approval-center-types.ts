/** GE-AI-2H — L3 Human Approval Center types (client-safe). */

export const GROWTH_AIOS_GE_AI_2H_PHASE = "GE-AI-2H" as const

export const GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER = "growth-ge-ai-2h-human-approval-center-v1" as const

export const GROWTH_HUMAN_APPROVAL_CENTER_RULE =
  "Human Approval Center is a read-only unified operator inbox — it aggregates existing approval queues without approving, rejecting, sending, mutating Core records, or bypassing Growth Autonomy enforcement." as const

export const GROWTH_HUMAN_APPROVAL_CENTER_RANKING_FORMULA =
  "score = priorityScore * 0.45 + riskWeight * 0.30 + urgencyWeight * 0.15 + ageWeight * 0.10 (deterministic tie-break: id asc)" as const

export const GROWTH_HUMAN_APPROVAL_SOURCES = [
  "ai_work_order",
  "execution_plan",
  "outreach_package",
  "email_sequence",
  "sms_sequence",
  "voice_drop",
  "ai_voice",
  "meeting_prep",
  "automation",
  "campaign",
  "meta_recommender",
  "priority_binding",
  "revenue_operator",
  "human_execution",
  "autonomous_outbound_scope",
  "adaptive_calibration",
  "future",
] as const

export type GrowthHumanApprovalSource = (typeof GROWTH_HUMAN_APPROVAL_SOURCES)[number]

export const GROWTH_HUMAN_APPROVAL_ACTION_TYPES = [
  "send_email",
  "send_sms",
  "place_call",
  "launch_voice_drop",
  "start_ai_voice_session",
  "approve_execution_plan",
  "approve_outreach_package",
  "approve_meeting_prep",
  "approve_automation",
  "approve_campaign",
  "review_recommendation",
  "review_blocker",
  "other",
] as const

export type GrowthHumanApprovalActionType = (typeof GROWTH_HUMAN_APPROVAL_ACTION_TYPES)[number]

export const GROWTH_HUMAN_APPROVAL_CHANNELS = [
  "email",
  "sms",
  "voice",
  "call",
  "video",
  "linkedin",
  "website",
  "chat",
  "none",
] as const

export type GrowthHumanApprovalChannel = (typeof GROWTH_HUMAN_APPROVAL_CHANNELS)[number]

export const GROWTH_HUMAN_APPROVAL_SUBJECT_TYPES = [
  "lead",
  "company",
  "person",
  "objective",
  "mission",
  "campaign",
  "sequence",
  "meeting",
  "call",
  "customer",
  "system",
] as const

export type GrowthHumanApprovalSubjectType = (typeof GROWTH_HUMAN_APPROVAL_SUBJECT_TYPES)[number]

export const GROWTH_HUMAN_APPROVAL_STATUSES = [
  "pending",
  "needs_review",
  "blocked",
  "approved_elsewhere",
  "expired",
] as const

export type GrowthHumanApprovalStatus = (typeof GROWTH_HUMAN_APPROVAL_STATUSES)[number]

export type GrowthHumanApprovalEvidence = {
  source: string
  label: string
  value?: string | number | boolean
  confidence?: number
}

export type GrowthHumanApprovalPolicy = {
  requiresHumanApproval: true
  autonomyCapability?: string
  blockedReason?: string
  enforcementSource: string
}

export type GrowthHumanApprovalItem = {
  id: string
  organizationId: string
  source: GrowthHumanApprovalSource
  actionType: GrowthHumanApprovalActionType
  channel?: GrowthHumanApprovalChannel
  subjectType?: GrowthHumanApprovalSubjectType
  subjectId?: string
  title: string
  summary: string
  riskLevel: "low" | "medium" | "high"
  priorityScore: number
  status: GrowthHumanApprovalStatus
  evidence: GrowthHumanApprovalEvidence[]
  policy: GrowthHumanApprovalPolicy
  route?: string
  createdAt: string
  expiresAt?: string
}

export type GrowthHumanApprovalCenterSummary = {
  totalPending: number
  smsPending: number
  emailPending: number
  voicePending: number
  highestRiskTitle: string | null
  highestRiskLevel: "low" | "medium" | "high" | null
  approvalCenterHref: string
}

export type GrowthHumanApprovalCenterReadModel = {
  readOnly: true
  qaMarker: typeof GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER
  generatedAt: string
  rule: typeof GROWTH_HUMAN_APPROVAL_CENTER_RULE
  rankingFormula: typeof GROWTH_HUMAN_APPROVAL_CENTER_RANKING_FORMULA
  items: GrowthHumanApprovalItem[]
  topItems: GrowthHumanApprovalItem[]
  summary: GrowthHumanApprovalCenterSummary
  filterCounts: {
    byChannel: Partial<Record<GrowthHumanApprovalChannel, number>>
    bySource: Partial<Record<GrowthHumanApprovalSource, number>>
    byActionType: Partial<Record<GrowthHumanApprovalActionType, number>>
    byRiskLevel: Partial<Record<"low" | "medium" | "high", number>>
  }
  sourcesIncluded: string[]
  sourcesFailed: Array<{ source: string; message: string }>
}
