/** Growth Engine — Lead Operator Workspace types (Prompt 18). Client-safe. */

import type { GrowthLeadEnginePipelineRun } from "@/lib/growth/lead-engine/orchestrator/lead-engine-run-types"
import type { GrowthIntentPixelVisitHistory } from "@/lib/growth/intent-pixel/intent-pixel-types"
import type { GrowthLeadInboxRow } from "@/lib/growth/lead-inbox/lead-inbox-types"
import type { GrowthOperatorHandoffOutput } from "@/lib/growth/operator-handoff/operator-handoff-types"
import type { GrowthOperatorHandoffPriorityHints } from "@/lib/growth/operator-handoff/operator-handoff-priority"

export const GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER =
  "growth-lead-operator-workspace-v1" as const

export const GROWTH_LEAD_INBOX_DASHBOARD_SECTIONS = [
  "high_priority",
  "needs_review",
  "enrichment_needed",
  "approved",
  "pipeline_running",
  "archived",
] as const

export type GrowthLeadInboxDashboardSection =
  (typeof GROWTH_LEAD_INBOX_DASHBOARD_SECTIONS)[number]

export const GROWTH_LEAD_INBOX_SORT_MODES = [
  "priority",
  "intent",
  "confidence",
  "recent_activity",
] as const

export type GrowthLeadInboxSortMode = (typeof GROWTH_LEAD_INBOX_SORT_MODES)[number]

export type GrowthLeadInboxCardView = {
  id: string
  company_name: string
  domain: string | null
  lead_score: number | null
  intent_score: number
  intent_grade: string
  verification_state: string
  candidate_type: string
  candidate_priority: string
  recommended_motion: string
  recommended_urgency: string
  recommended_owner: string
  human_approval_state: string
  owner_id: string | null
  status: string
  pipeline_status: string
  human_review_required: boolean
  session_count: number
  visit_count: number
  candidate_confidence: number
  last_activity_at: string
  time_since_activity_label: string
  intent_indicators: string[]
  has_operator_handoff: boolean
  has_lead_engine_run: boolean
}

export type GrowthLeadInboxDashboardSectionPayload = {
  id: GrowthLeadInboxDashboardSection
  label: string
  items: GrowthLeadInboxCardView[]
}

export type GrowthLeadInboxDashboardPayload = {
  qa_marker: typeof GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER
  sort: GrowthLeadInboxSortMode
  sections: GrowthLeadInboxDashboardSectionPayload[]
  total: number
}

export type GrowthLeadOperatorEvidenceCard = {
  claim: string
  evidence: string
  source: string
  confidence: number | null
}

export type GrowthLeadOperatorAttributionCard = {
  source: string
  section: string
  signal: string
  evidence: string
  confidence: number
}

export type GrowthLeadOperatorOverview = {
  executive_summary: string
  pain_points: GrowthLeadOperatorEvidenceCard[]
  buying_signals: GrowthLeadOperatorEvidenceCard[]
  growth_signals: GrowthLeadOperatorEvidenceCard[]
  decision_maker_summary: string
  contact_summary: string
  verification_summary: string
  lead_score_summary: string
}

export type GrowthLeadOperatorHistoryEntry = {
  at: string
  action: string
  note: string
}

export type GrowthLeadOperatorCompanyMatchSummary = {
  id: string
  company_name: string
  company_domain: string | null
  matched_source: string
  match_type: string
  match_confidence: number
  match_score: number
  evidence: string
  is_candidate_match: boolean
}

export type GrowthLeadOperatorSearchIntentSummary = {
  id: string
  intent_topic: string
  intent_category: string
  intent_stage: string
  intent_score: number
  keyword: string
  source_type: string
  evidence: string
}

export type GrowthLeadInboxRowPublic = Omit<
  GrowthLeadInboxRow,
  "email" | "phone" | "contact_name" | "linkedin_url"
> & {
  email: string | null
  phone: string | null
  contact_name: string | null
  linkedin_url: string | null
  contact_identified: boolean
}

export type GrowthLeadOperatorWorkspacePayload = {
  qa_marker: typeof GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER
  row: GrowthLeadInboxRowPublic
  card: GrowthLeadInboxCardView
  operator_handoff: GrowthOperatorHandoffOutput | null
  guidance_hints: GrowthOperatorHandoffPriorityHints
  lead_engine_run: GrowthLeadEnginePipelineRun | null
  intent_activity: GrowthIntentPixelVisitHistory | null
  overview: GrowthLeadOperatorOverview
  evidence: {
    items: GrowthLeadOperatorEvidenceCard[]
    attribution: GrowthLeadOperatorAttributionCard[]
  }
  history: GrowthLeadOperatorHistoryEntry[]
  search_intent_signals: GrowthLeadOperatorSearchIntentSummary[]
  company_match: GrowthLeadOperatorCompanyMatchSummary | null
}

export const GROWTH_LEAD_ENGINE_RUN_METADATA_KEY = "lead_engine_run" as const

export const GROWTH_LEAD_INBOX_ACTIONS = [
  "claim",
  "assign_owner",
  "approve",
  "archive",
  "mark_duplicate",
  "run_lead_engine",
] as const

export type GrowthLeadInboxAction = (typeof GROWTH_LEAD_INBOX_ACTIONS)[number]
