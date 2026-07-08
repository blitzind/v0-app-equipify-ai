/** GE-LEADS-CANONICAL-3A — Canonical Revenue Queue projection types (client-safe). */

import type { GrowthLeadInboxCardView } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"
import type { GrowthLeadSourceKind, GrowthLeadStatus } from "@/lib/growth/types"

export const GROWTH_REVENUE_QUEUE_PROJECTION_QA_MARKER =
  "growth-revenue-queue-canonical-projection-v1" as const

export const GROWTH_REVENUE_QUEUE_PROJECTION_CERT_QA_MARKER =
  "growth-revenue-queue-projection-cert-v1" as const

/** Full canonical projection for Revenue Queue (superset of legacy card view). */
export type RevenueQueueLeadProjection = {
  qa_marker: typeof GROWTH_REVENUE_QUEUE_PROJECTION_QA_MARKER
  /** Canonical growth.leads id — primary queue identity after migration. */
  growth_lead_id: string
  company_name: string
  domain: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  source_kind: GrowthLeadSourceKind
  source_channel: string | null
  source_campaign: string | null
  /** Native canonical CRM status. */
  lead_status: GrowthLeadStatus
  /** Inbox-compatible display status for section/KPI parity during migration. */
  queue_display_status: string
  queue_display_pipeline_status: string
  priority: string
  confidence: number
  intent_score: number
  lead_score: number | null
  next_best_action: string | null
  next_best_action_reason: string | null
  workflow_stage: string | null
  workflow_health: string | null
  assignment_owner_id: string | null
  recommended_owner: string
  recommended_motion: string
  recommended_urgency: string
  communication_health_tier: string | null
  communication_health_score: number | null
  research_completion: {
    latest_research_run_id: string | null
    last_researched_at: string | null
    has_lead_engine_run: boolean
  }
  buying_committee_status: string | null
  decision_maker_confidence: number | null
  sequence_state: {
    active_enrollment_id: string | null
    recommended_pattern_id: string | null
    recommended_next_step: string | null
    fatigue_risk: string | null
  }
  buying_stage: string | null
  buying_stage_confidence: number | null
  last_activity_at: string
  created_at: string
  updated_at: string
  human_review_required: boolean
  evidence_strength: GrowthLeadInboxCardView["evidence_strength"]
  evidence_count: number
  intent_indicators: string[]
  is_purchase_ready: boolean
  is_high_intent_visitor: boolean
  is_returning_account: boolean
  needs_review: boolean
  /** Legacy card-shaped slice for dashboard parity certification. */
  card_view: GrowthLeadInboxCardView
  /** Fields that could not be populated from growth.leads alone. */
  missing_projection_fields: string[]
}

export type RevenueQueueProjectionLoadFilters = {
  limit?: number
  offset?: number
  status?: GrowthLeadStatus
  assignedTo?: string | null
  unassigned?: boolean
  includeArchived?: boolean
  sourceKinds?: GrowthLeadSourceKind[]
}

export type RevenueQueueProjectionLoadResult = {
  qa_marker: typeof GROWTH_REVENUE_QUEUE_PROJECTION_QA_MARKER
  items: RevenueQueueLeadProjection[]
  total: number
}

export type RevenueQueueProjectionFieldParity = {
  field: string
  legacy_present: boolean
  canonical_present: boolean
  match: boolean
  legacy_value?: string | number | boolean | null
  canonical_value?: string | number | boolean | null
}

export type RevenueQueueProjectionCertRecord = {
  legacy_inbox_id: string | null
  growth_lead_id: string
  linked_via_metadata: boolean
  field_parity: RevenueQueueProjectionFieldParity[]
  missing_canonical_fields: string[]
  missing_legacy_record: boolean
}

export type RevenueQueueProjectionCertReport = {
  qa_marker: typeof GROWTH_REVENUE_QUEUE_PROJECTION_CERT_QA_MARKER
  generated_at: string
  legacy_inbox_total: number
  canonical_projection_total: number
  matching_linked_records: number
  legacy_without_canonical_link: number
  canonical_without_legacy_inbox: number
  field_parity_summary: {
    compared_fields: number
    fully_matching_records: number
    records_with_gaps: number
  }
  missing_projection_dependencies: string[]
  records: RevenueQueueProjectionCertRecord[]
  orphan_legacy_inbox_ids: string[]
  orphan_canonical_lead_ids: string[]
}
