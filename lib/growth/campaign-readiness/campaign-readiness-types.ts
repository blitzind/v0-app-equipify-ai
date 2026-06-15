/** Phase GS-2E — Campaign Readiness Engine types (client-safe). */

export const CAMPAIGN_READINESS_QA_MARKER = "growth-campaign-readiness-gs2e-v1" as const

export const CAMPAIGN_READINESS_CONFIRM = "RUN_CAMPAIGN_READINESS_CERTIFICATION" as const

export const CAMPAIGN_READINESS_STATUSES = ["not_ready", "partially_ready", "ready"] as const
export type CampaignReadinessStatus = (typeof CAMPAIGN_READINESS_STATUSES)[number]

export const CAMPAIGN_READINESS_SUBJECT_TYPES = ["prospect", "account", "cohort"] as const
export type CampaignReadinessSubjectType = (typeof CAMPAIGN_READINESS_SUBJECT_TYPES)[number]

export const CAMPAIGN_READINESS_DIMENSION_IDS = [
  "company_intelligence",
  "decision_maker_coverage",
  "verified_contact_channels",
  "personalization_assets",
  "knowledge_assets",
  "sequence_assets",
  "compliance_requirements",
  "channel_readiness",
  "required_approvals",
] as const

export type CampaignReadinessDimensionId = (typeof CAMPAIGN_READINESS_DIMENSION_IDS)[number]

export const CAMPAIGN_READINESS_DIMENSION_LABELS: Record<CampaignReadinessDimensionId, string> = {
  company_intelligence: "Company intelligence",
  decision_maker_coverage: "Decision maker coverage",
  verified_contact_channels: "Verified contact channels",
  personalization_assets: "Personalization assets",
  knowledge_assets: "Knowledge assets",
  sequence_assets: "Sequence assets",
  compliance_requirements: "Compliance requirements",
  channel_readiness: "Channel readiness",
  required_approvals: "Required approvals",
}

export const CAMPAIGN_READINESS_DIMENSION_LEVELS = ["ready", "partial", "blocked", "missing"] as const
export type CampaignReadinessDimensionLevel = (typeof CAMPAIGN_READINESS_DIMENSION_LEVELS)[number]

export type CampaignReadinessDimension = {
  dimension_id: CampaignReadinessDimensionId
  label: string
  score: number
  level: CampaignReadinessDimensionLevel
  summary: string
  evidence: string[]
  gaps: string[]
}

export type CampaignReadinessBlocker = {
  blocker_id: string
  dimension_id: CampaignReadinessDimensionId
  severity: "critical" | "warning"
  message: string
  resolution_hint: string
  related_asset_href: string | null
}

export type CampaignReadinessRecommendation = {
  recommendation_id: string
  dimension_id: CampaignReadinessDimensionId
  priority: "high" | "medium" | "low"
  title: string
  description: string
  related_asset_href: string | null
  action_type: "view_details" | "open_asset" | "mark_reviewed"
}

export type CampaignReadinessAssessment = {
  qa_marker: typeof CAMPAIGN_READINESS_QA_MARKER
  assessment_id: string
  subject_type: CampaignReadinessSubjectType
  subject_ref: string
  lead_id: string | null
  company_name: string | null
  execution_run_id: string | null
  generated_at: string
  readiness_score: number
  readiness_status: CampaignReadinessStatus
  dimensions: CampaignReadinessDimension[]
  blockers: CampaignReadinessBlocker[]
  recommendations: CampaignReadinessRecommendation[]
  missing_assets: string[]
  missing_channels: string[]
  required_approvals: string[]
  required_human_actions: string[]
  review_status: "pending" | "reviewed"
  requires_human_review: true
  autonomous_execution_enabled: false
}

export const CAMPAIGN_READINESS_ACTIONS = ["mark_reviewed", "view_details"] as const
export type CampaignReadinessActionType = (typeof CAMPAIGN_READINESS_ACTIONS)[number]

export const CAMPAIGN_READINESS_AUDIT_EVENTS = [
  "campaign_readiness_generated",
  "campaign_readiness_reviewed",
  "campaign_readiness_blocked",
] as const

export type CampaignReadinessAuditEvent = (typeof CAMPAIGN_READINESS_AUDIT_EVENTS)[number]
