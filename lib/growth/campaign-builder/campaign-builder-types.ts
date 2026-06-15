/** Phase GS-5D — Campaign Builder Wizard types (client-safe). */

export const CAMPAIGN_BUILDER_QA_MARKER = "growth-campaign-builder-gs5d-v1" as const

export const CAMPAIGN_BUILDER_CONFIRM = "RUN_CAMPAIGN_BUILDER_CERTIFICATION" as const

export const CAMPAIGN_BUILDER_STATUSES = [
  "draft",
  "needs_review",
  "blocked",
  "ready_for_human_approval",
] as const

export type CampaignBuilderWizardStatus = (typeof CAMPAIGN_BUILDER_STATUSES)[number]

export const CAMPAIGN_BUILDER_CHANNELS = ["email", "sms", "voice_drop", "call", "manual"] as const
export type CampaignBuilderChannel = (typeof CAMPAIGN_BUILDER_CHANNELS)[number]

export const CAMPAIGN_BUILDER_STEP_IDS = [
  "readiness_review",
  "sequence_selection",
  "channel_planning",
  "follow_up_alignment",
  "playbook_knowledge",
  "approval_checklist",
] as const

export type CampaignBuilderWizardStepId = (typeof CAMPAIGN_BUILDER_STEP_IDS)[number]

export const CAMPAIGN_BUILDER_FILTERS = ["all", "blocked", "needs_review", "ready"] as const
export type CampaignBuilderFilter = (typeof CAMPAIGN_BUILDER_FILTERS)[number]

export const CAMPAIGN_BUILDER_ACTIONS = ["mark_reviewed", "dismiss", "view_details"] as const
export type CampaignBuilderActionType = (typeof CAMPAIGN_BUILDER_ACTIONS)[number]

export const CAMPAIGN_BUILDER_STATUS_LABELS: Record<CampaignBuilderWizardStatus, string> = {
  draft: "Draft",
  needs_review: "Needs review",
  blocked: "Blocked",
  ready_for_human_approval: "Ready for human approval",
}

export const CAMPAIGN_BUILDER_STEP_LABELS: Record<CampaignBuilderWizardStepId, string> = {
  readiness_review: "Campaign readiness",
  sequence_selection: "Sequence structure",
  channel_planning: "Channel plan",
  follow_up_alignment: "Follow-up policies",
  playbook_knowledge: "Playbooks & knowledge",
  approval_checklist: "Approval checklist",
}

export type CampaignBuilderWizardStep = {
  step_id: CampaignBuilderWizardStepId
  label: string
  status: "pending" | "complete" | "blocked" | "needs_review"
  summary: string
  details: string[]
  related_href: string | null
}

export type CampaignBuilderWizardConfiguration = {
  recommended_channels: CampaignBuilderChannel[]
  suggested_pattern_id: string | null
  suggested_pattern_label: string | null
  suggested_sequence_structure: string[]
  timing_recommendations: string[]
  required_assets: string[]
  personalization_coverage: "covered" | "partial" | "missing"
}

export type CampaignBuilderWizardRisk = {
  risk_id: string
  severity: "low" | "medium" | "high" | "critical"
  title: string
  description: string
  source: string
}

export type CampaignBuilderWizardRecommendation = {
  recommendation_id: string
  title: string
  description: string
  priority: "low" | "medium" | "high"
  related_href: string | null
  action_type: "view_details" | "open_related" | "mark_reviewed" | "dismiss"
}

export type CampaignBuilderWizardApprovalRequirement = {
  requirement_id: string
  label: string
  description: string
  status: "pending" | "satisfied" | "blocked"
}

export type CampaignBuilderWizard = {
  qa_marker: typeof CAMPAIGN_BUILDER_QA_MARKER
  wizard_id: string
  wizard_status: CampaignBuilderWizardStatus
  configuration_score: number
  configuration: CampaignBuilderWizardConfiguration
  steps: CampaignBuilderWizardStep[]
  recommendations: CampaignBuilderWizardRecommendation[]
  risks: CampaignBuilderWizardRisk[]
  approval_requirements: CampaignBuilderWizardApprovalRequirement[]
  review_status: "pending" | "reviewed" | "dismissed"
  lead_id: string | null
  company_name: string | null
  related_href: string | null
  requires_human_review: true
  autonomous_execution_enabled: false
  generated_at: string
}

export type CampaignBuilderWizardResponse = {
  qa_marker: typeof CAMPAIGN_BUILDER_QA_MARKER
  generated_at: string
  total: number
  blocked_count: number
  needs_review_count: number
  ready_count: number
  status_counts: Record<CampaignBuilderWizardStatus, number>
  wizards: CampaignBuilderWizard[]
  requires_human_review: true
  autonomous_execution_enabled: false
}

export const CAMPAIGN_BUILDER_AUDIT_EVENTS = [
  "campaign_builder_generated",
  "campaign_builder_reviewed",
  "campaign_builder_dismissed",
  "campaign_builder_viewed",
] as const

export type CampaignBuilderAuditEvent = (typeof CAMPAIGN_BUILDER_AUDIT_EVENTS)[number]

export type CampaignBuilderGenerateRequest = {
  lead_id?: string | null
  pattern_id?: string | null
  filter?: CampaignBuilderFilter
  limit?: number
  include_campaign_readiness?: boolean
}
