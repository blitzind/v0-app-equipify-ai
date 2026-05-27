/** Client-safe Growth Engine AI reply drafting types (Phase 2J). */

export const GROWTH_AI_REPLY_DRAFTING_QA_MARKER = "growth-ai-reply-drafting-v1" as const

export const GROWTH_AI_REPLY_DRAFTING_PRIVACY_NOTE =
  "AI reply drafts require human approval before send. No autonomous replies, no client-side AI, no raw provider payloads in UI."

export const GROWTH_REPLY_DRAFT_STATUSES = ["draft", "approved", "discarded", "sent", "blocked"] as const
export type GrowthReplyDraftStatus = (typeof GROWTH_REPLY_DRAFT_STATUSES)[number]

export const GROWTH_REPLY_DRAFT_RISK_LEVELS = ["low", "medium", "high", "blocked"] as const
export type GrowthReplyDraftRiskLevel = (typeof GROWTH_REPLY_DRAFT_RISK_LEVELS)[number]

export const GROWTH_REPLY_DRAFT_TYPES = [
  "positive_interest_reply",
  "objection_reply",
  "meeting_booking_reply",
  "not_interested_acknowledgement",
  "referral_reply",
  "question_answer_reply",
  "generic_follow_up_reply",
] as const
export type GrowthReplyDraftType = (typeof GROWTH_REPLY_DRAFT_TYPES)[number]

export const GROWTH_REPLY_DRAFT_TIMELINE_EVENT_TYPES = [
  "reply_draft_generated",
  "reply_draft_approved",
  "reply_draft_discarded",
  "reply_draft_sent",
  "reply_draft_blocked",
] as const
export type GrowthReplyDraftTimelineEventType = (typeof GROWTH_REPLY_DRAFT_TIMELINE_EVENT_TYPES)[number]

export const GROWTH_REPLY_DRAFT_AI_TASK = "growth_reply_draft_generation" as const

export type GrowthReplyDraft = {
  id: string
  inboxThreadId: string
  inboxMessageId: string | null
  leadId: string | null
  sequenceEnrollmentId: string | null
  aiGenerationId: string | null
  status: GrowthReplyDraftStatus
  draftSubject: string | null
  draftBody: string
  classification: string | null
  tone: string
  confidence: number
  riskLevel: GrowthReplyDraftRiskLevel
  requiresHumanReview: boolean
  approvedAt: string | null
  approvedBy: string | null
  discardedAt: string | null
  discardedBy: string | null
  sentDeliveryAttemptId: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export type GrowthReplyDraftView = GrowthReplyDraft & {
  leadLabel: string
  threadSubject: string
}

export type GrowthReplyDraftEvent = {
  id: string
  replyDraftId: string
  eventType: string
  severity: "info" | "low" | "medium" | "high" | "critical"
  title: string
  description: string
  metadata: Record<string, unknown>
  createdAt: string
}

export type GrowthReplyDraftContext = {
  companyLabel: string
  contactLabel: string
  threadSubject: string
  inboundPreview: string
  classification: string
  engagementSummary: string
  complianceFlags: string[]
  sequenceActive: boolean
  playbookInfluence: string[]
  marketSignals: string[]
  draftType: GrowthReplyDraftType
}

export type GrowthReplyDraftDashboard = {
  qa_marker: typeof GROWTH_AI_REPLY_DRAFTING_QA_MARKER
  pendingReview: number
  approved: number
  sent: number
  blocked: number
  topClassifications: Array<{ label: string; count: number }>
  riskDistribution: Record<GrowthReplyDraftRiskLevel, number>
  drafts: GrowthReplyDraftView[]
}

export type GrowthReplyRiskGuardResult = {
  allowed: boolean
  riskLevel: GrowthReplyDraftRiskLevel
  blockCode?: string
  message?: string
}

export function maskReplyDraftLeadLabel(leadId: string | null, companyName?: string | null): string {
  if (companyName?.trim()) return companyName.trim().slice(0, 80)
  if (!leadId) return "Lead"
  return `Lead ${leadId.slice(0, 8)}…`
}

export function replyDraftStatusLabel(status: GrowthReplyDraftStatus): string {
  return status.replace(/_/g, " ")
}

export function resolveReplyDraftTypeFromClassification(classification: string): GrowthReplyDraftType {
  switch (classification) {
    case "positive_interest":
      return "positive_interest_reply"
    case "meeting_intent":
      return "meeting_booking_reply"
    case "not_interested":
    case "unsubscribe":
      return "not_interested_acknowledgement"
    case "referral":
      return "referral_reply"
    case "question":
    case "budget":
    case "timeline":
    case "competitor":
      return "objection_reply"
    default:
      return "generic_follow_up_reply"
  }
}
