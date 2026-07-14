/** Growth Engine — Lead Operator Workspace types (Prompt 18). Client-safe. */

import type { GrowthLeadEnginePipelineRun } from "@/lib/growth/lead-engine/orchestrator/lead-engine-run-types"
import type { GrowthIntentPixelVisitHistory } from "@/lib/growth/intent-pixel/intent-pixel-types"
import type { RevenueQueueRow } from "@/lib/growth/lead-inbox/lead-inbox-types"
import type { GrowthOperatorHandoffOutput } from "@/lib/growth/operator-handoff/operator-handoff-types"
import type { GrowthOperatorHandoffPriorityHints } from "@/lib/growth/operator-handoff/operator-handoff-priority"

export const GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER =
  "growth-lead-operator-workspace-v1" as const

export const GROWTH_REVENUE_QUEUE_DASHBOARD_SECTIONS = [
  "high_priority",
  "needs_review",
  "enrichment_needed",
  "approved",
  "pipeline_running",
  "archived",
] as const

/** @deprecated Use GROWTH_REVENUE_QUEUE_DASHBOARD_SECTIONS */
export const GROWTH_LEAD_INBOX_DASHBOARD_SECTIONS = GROWTH_REVENUE_QUEUE_DASHBOARD_SECTIONS

export type RevenueQueueDashboardSection =
  (typeof GROWTH_REVENUE_QUEUE_DASHBOARD_SECTIONS)[number]

/** @deprecated Use RevenueQueueDashboardSection */
export type GrowthLeadInboxDashboardSection = RevenueQueueDashboardSection

export const GROWTH_REVENUE_QUEUE_SORT_MODES = [
  "priority",
  "intent",
  "confidence",
  "recent_activity",
] as const

/** @deprecated Use GROWTH_REVENUE_QUEUE_SORT_MODES */
export const GROWTH_LEAD_INBOX_SORT_MODES = GROWTH_REVENUE_QUEUE_SORT_MODES

export type RevenueQueueSortMode = (typeof GROWTH_REVENUE_QUEUE_SORT_MODES)[number]

/** @deprecated Use RevenueQueueSortMode */
export type GrowthLeadInboxSortMode = RevenueQueueSortMode

export type RevenueQueueCardView = {
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
  buying_stage: string | null
  buying_stage_confidence: number | null
  company_match_confidence: number | null
  search_intent_category: string | null
  search_intent_keyword: string | null
  evidence_strength: "strong" | "moderate" | "weak" | "minimal"
  evidence_count: number
  decision_maker_confidence: number | null
  is_purchase_ready: boolean
  is_high_intent_visitor: boolean
  is_returning_account: boolean
  needs_review: boolean
}

/** @deprecated Use RevenueQueueCardView (GE-LEADS-CANONICAL-4G). */
export type GrowthLeadInboxCardView = RevenueQueueCardView

export type RevenueQueueDashboardSectionPayload = {
  id: RevenueQueueDashboardSection
  label: string
  items: RevenueQueueCardView[]
}

/** @deprecated Use RevenueQueueDashboardSectionPayload */
export type GrowthLeadInboxDashboardSectionPayload = RevenueQueueDashboardSectionPayload

export type RevenueQueueDashboardPayload = {
  qa_marker: typeof GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER
  sort: RevenueQueueSortMode
  sections: RevenueQueueDashboardSectionPayload[]
  total: number
}

/** @deprecated Use RevenueQueueDashboardPayload */
export type GrowthLeadInboxDashboardPayload = RevenueQueueDashboardPayload

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

export type GrowthLeadOperatorBuyingStageSummary = {
  id: string
  detected_stage: string
  stage_confidence: number
  stage_score: number
  evidence: string
  signal_count: number
  is_candidate_assessment: boolean
}

export type RevenueQueueRowPublic = Omit<
  RevenueQueueRow,
  "email" | "phone" | "contact_name" | "linkedin_url"
> & {
  email: string | null
  phone: string | null
  contact_name: string | null
  linkedin_url: string | null
  contact_identified: boolean
}

/** @deprecated Use RevenueQueueRowPublic */
export type GrowthLeadInboxRowPublic = RevenueQueueRowPublic

export type GrowthLeadOperatorWorkspacePayload = {
  qa_marker: typeof GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER
  row: RevenueQueueRowPublic
  card: RevenueQueueCardView
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
  buying_stage: GrowthLeadOperatorBuyingStageSummary | null
  /** GE-AIOS-DECISION-ENGINE-1B — canonical next-best decision for this lead */
  canonical_decision?: import("@/lib/growth/aios/growth/growth-canonical-decision-engine-1b-types").GrowthCanonicalDecisionResolution | null
}

export const GROWTH_LEAD_ENGINE_RUN_METADATA_KEY = "lead_engine_run" as const

export const GROWTH_REVENUE_QUEUE_ACTIONS = [
  "claim",
  "assign_owner",
  "approve",
  "archive",
  "mark_duplicate",
  "run_lead_engine",
] as const

/** @deprecated Use GROWTH_REVENUE_QUEUE_ACTIONS */
export const GROWTH_LEAD_INBOX_ACTIONS = GROWTH_REVENUE_QUEUE_ACTIONS

export type RevenueQueueAction = (typeof GROWTH_REVENUE_QUEUE_ACTIONS)[number]

/** @deprecated Use RevenueQueueAction */
export type GrowthLeadInboxAction = RevenueQueueAction
