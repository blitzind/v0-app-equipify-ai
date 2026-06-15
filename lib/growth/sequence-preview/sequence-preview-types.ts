/** Phase GS-5B — Sequence Preview Studio types (client-safe). */

export const SEQUENCE_PREVIEW_QA_MARKER = "growth-sequence-preview-gs5b-v1" as const

export const SEQUENCE_PREVIEW_CONFIRM = "RUN_SEQUENCE_PREVIEW_CERTIFICATION" as const

export const SEQUENCE_PREVIEW_STATUSES = [
  "draft",
  "needs_review",
  "blocked",
  "ready_for_human_approval",
] as const

export type SequencePreviewStatus = (typeof SEQUENCE_PREVIEW_STATUSES)[number]

export const SEQUENCE_PREVIEW_CHANNELS = ["email", "sms", "voice_drop", "call", "manual", "other"] as const
export type SequencePreviewChannel = (typeof SEQUENCE_PREVIEW_CHANNELS)[number]

export const SEQUENCE_PREVIEW_FILTERS = ["all", "blocked", "needs_review", "ready"] as const
export type SequencePreviewFilter = (typeof SEQUENCE_PREVIEW_FILTERS)[number]

export const SEQUENCE_PREVIEW_ACTIONS = ["mark_reviewed", "dismiss", "view_details"] as const
export type SequencePreviewActionType = (typeof SEQUENCE_PREVIEW_ACTIONS)[number]

export const SEQUENCE_PREVIEW_STATUS_LABELS: Record<SequencePreviewStatus, string> = {
  draft: "Draft",
  needs_review: "Needs review",
  blocked: "Blocked",
  ready_for_human_approval: "Ready for human approval",
}

export type SequencePreviewStep = {
  step_id: string
  step_order: number
  channel: SequencePreviewChannel
  raw_channel: string
  label: string
  delay_days_min: number
  delay_days_max: number
  timing_gap_days: number
  cumulative_day_min: number
  cumulative_day_max: number
  scheduled_window_label: string
  channel_status: "ready" | "conditional" | "blocked"
  personalization_status: "covered" | "partial" | "missing"
  playbook_category: string | null
  requires_human_approval: boolean
  blockers: string[]
  notes: string[]
}

export type SequencePreviewRisk = {
  risk_id: string
  severity: "low" | "medium" | "high" | "critical"
  title: string
  description: string
  related_step_order: number | null
}

export type SequencePreviewRecommendation = {
  recommendation_id: string
  title: string
  description: string
  priority: "low" | "medium" | "high"
  related_href: string | null
  action_type: "view_details" | "open_related" | "mark_reviewed" | "dismiss"
}

export type SequencePreviewApprovalRequirement = {
  requirement_id: string
  label: string
  description: string
  status: "pending" | "satisfied" | "blocked"
}

export type SequencePreview = {
  qa_marker: typeof SEQUENCE_PREVIEW_QA_MARKER
  preview_id: string
  pattern_id: string
  pattern_key: string
  pattern_label: string
  lead_id: string | null
  company_name: string | null
  sequence_status: SequencePreviewStatus
  preview_score: number
  step_count: number
  steps: SequencePreviewStep[]
  risks: SequencePreviewRisk[]
  recommendations: SequencePreviewRecommendation[]
  approval_requirements: SequencePreviewApprovalRequirement[]
  review_status: "pending" | "reviewed" | "dismissed"
  related_href: string | null
  requires_human_review: true
  autonomous_execution_enabled: false
  generated_at: string
}

export type SequencePreviewStudioResponse = {
  qa_marker: typeof SEQUENCE_PREVIEW_QA_MARKER
  generated_at: string
  total: number
  blocked_count: number
  needs_review_count: number
  ready_count: number
  status_counts: Record<SequencePreviewStatus, number>
  previews: SequencePreview[]
  requires_human_review: true
  autonomous_execution_enabled: false
}

export const SEQUENCE_PREVIEW_AUDIT_EVENTS = [
  "sequence_preview_generated",
  "sequence_preview_reviewed",
  "sequence_preview_dismissed",
  "sequence_preview_viewed",
] as const

export type SequencePreviewAuditEvent = (typeof SEQUENCE_PREVIEW_AUDIT_EVENTS)[number]

export type SequencePreviewGenerateRequest = {
  pattern_id?: string | null
  lead_id?: string | null
  filter?: SequencePreviewFilter
  limit?: number
  include_campaign_readiness?: boolean
}
