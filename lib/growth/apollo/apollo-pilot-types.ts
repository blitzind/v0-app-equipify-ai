/** Apollo Pilot Operations — client-safe types (Phase 12). */

export const APOLLO_PILOT_OPERATIONS_QA_MARKER = "apollo-pilot-operations-v12" as const

export const APOLLO_PILOT_COHORT_STATUSES = [
  "draft",
  "active",
  "paused",
  "completed",
  "cancelled",
] as const

export type ApolloPilotCohortStatus = (typeof APOLLO_PILOT_COHORT_STATUSES)[number]

export const APOLLO_PILOT_COHORT_SIZES = [25, 50, 100] as const
export type ApolloPilotCohortSize = (typeof APOLLO_PILOT_COHORT_SIZES)[number]

export const APOLLO_PILOT_COHORT_COMPANY_STATUSES = ["active", "removed", "completed"] as const
export type ApolloPilotCohortCompanyStatus = (typeof APOLLO_PILOT_COHORT_COMPANY_STATUSES)[number]

export const APOLLO_PILOT_COHORT_ACTIONS = [
  "activate",
  "pause",
  "resume",
  "complete",
  "cancel",
] as const

export type ApolloPilotCohortAction = (typeof APOLLO_PILOT_COHORT_ACTIONS)[number]

export type ApolloPilotCohortRow = {
  id: string
  created_at: string
  updated_at: string
  cohort_name: string
  target_company_count: ApolloPilotCohortSize
  company_count: number
  contact_count: number
  created_by: string | null
  created_by_email: string | null
  status: ApolloPilotCohortStatus
  started_at: string | null
  paused_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  metadata: Record<string, unknown>
}

export type ApolloPilotCohortCompanyRow = {
  id: string
  cohort_id: string
  company_candidate_id: string
  company_name: string
  domain: string | null
  qualification_status: string
  sequence_ready_count: number
  enrollment_candidate_count: number
  sequence_enrollment_count: number
  status: ApolloPilotCohortCompanyStatus
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type ApolloPilotDashboardCounts = {
  companies_processed: number
  contacts_found: number
  qualified_contacts: number
  enrollment_candidates: number
  voice_drop_candidates: number
  multichannel_candidates: number
  sequence_enrollments: number
  draft_approvals: number
  job_approvals: number
  emails_sent: number
  sms_sent: number
  voice_drops_sent: number
  calls_completed: number
  replies_received: number
  meetings_booked: number
  opportunities_created: number
  revenue_attributed: number
}

export const APOLLO_PILOT_FUNNEL_STAGES = [
  "companies",
  "contacts",
  "qualified",
  "enrolled",
  "draft_approved",
  "job_approved",
  "sent",
  "replied",
  "meeting",
  "opportunity",
  "revenue",
] as const

export type ApolloPilotFunnelStage = (typeof APOLLO_PILOT_FUNNEL_STAGES)[number]

export type ApolloPilotFunnelStageMetric = {
  stage: ApolloPilotFunnelStage
  label: string
  count: number
  stage_conversion_pct: number | null
  cumulative_conversion_pct: number | null
  drop_off_pct: number | null
}

export type ApolloPilotFunnelMetrics = {
  qa_marker: typeof APOLLO_PILOT_OPERATIONS_QA_MARKER
  cohort_id: string
  stages: ApolloPilotFunnelStageMetric[]
  computed_at: string
}

export type ApolloPilotChannelAttributionRow = {
  channel: string
  first_touch_meetings: number
  last_touch_meetings: number
  assisting_meetings: number
  replies: number
  opportunities: number
}

export type ApolloPilotChannelAttributionMetrics = {
  qa_marker: typeof APOLLO_PILOT_OPERATIONS_QA_MARKER
  cohort_id: string
  channels: ApolloPilotChannelAttributionRow[]
  top_meeting_channel: string | null
  computed_at: string
}

export type ApolloPilotContentPerformanceRow = {
  channel: string
  variant_key: string
  sends: number
  replies: number
  meetings: number
  reply_rate_pct: number
  meeting_rate_pct: number
}

export type ApolloPilotContentPerformanceMetrics = {
  qa_marker: typeof APOLLO_PILOT_OPERATIONS_QA_MARKER
  cohort_id: string
  rows: ApolloPilotContentPerformanceRow[]
  computed_at: string
}

export type ApolloPilotOperatorAnalytics = {
  qa_marker: typeof APOLLO_PILOT_OPERATIONS_QA_MARKER
  cohort_id: string
  draft_approval_pct: number
  draft_rejection_pct: number
  draft_regeneration_pct: number
  job_approval_pct: number
  average_review_time_minutes: number | null
  queue_aging_hours_max: number | null
  operator_throughput_per_day: number | null
  computed_at: string
}

export type ApolloPilotRoiEstimate = {
  metric_key: string
  label: string
  value: number | null
  estimate_source: string
  confidence: "high" | "medium" | "low"
}

export type ApolloPilotRoiMetrics = {
  qa_marker: typeof APOLLO_PILOT_OPERATIONS_QA_MARKER
  cohort_id: string
  apollo_credits_consumed: number | null
  estimates: ApolloPilotRoiEstimate[]
  computed_at: string
}

export type ApolloPilotReadinessPayload = {
  qa_marker: typeof APOLLO_PILOT_OPERATIONS_QA_MARKER
  ready: boolean
  blockers: string[]
  certified_pipeline: string[]
  recommended_cohort_sizes: ApolloPilotCohortSize[]
}
