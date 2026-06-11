/** Opportunity Approval Engine (M1-E) types — client-safe. */

import type { GrowthOpportunityStageKey } from "@/lib/growth/opportunity-pipeline/pipeline-types"
import type {
  OpportunityDraftAttributionRecord,
  OpportunityDraftStatus,
} from "@/lib/growth/meeting-intelligence/opportunity-draft-engine-types"
import { OPPORTUNITY_DRAFT_SOURCE_ATTRIBUTION } from "@/lib/growth/meeting-intelligence/opportunity-draft-engine-types"

export const OPPORTUNITY_APPROVAL_ENGINE_QA_MARKER =
  "growth-opportunity-approval-engine-m1e-v1" as const

export const OPPORTUNITY_APPROVAL_ENGINE_ID = "growth-opportunity-approval-engine-m1e-v1" as const

export const OPPORTUNITY_APPROVAL_ENGINE_MIGRATION =
  "20270822120000_growth_engine_opportunity_approval_m1e.sql" as const

export const OPPORTUNITY_APPROVAL_ATTRIBUTION_CHAIN = [
  ...OPPORTUNITY_DRAFT_SOURCE_ATTRIBUTION,
  "Opportunity",
] as const

export type OpportunityApprovalAttributionStage = (typeof OPPORTUNITY_APPROVAL_ATTRIBUTION_CHAIN)[number]

export type OpportunityApprovalAttributionRecord = OpportunityDraftAttributionRecord & {
  opportunity_source: string
  attribution_chain: OpportunityApprovalAttributionStage[]
}

export type OpportunityApprovalSafetyFlags = {
  auto_created: false
  human_confirmed: true
  operator_required: true
}

export type OpportunityApprovalDraftEdits = {
  name?: string | null
  estimated_value?: number | null
  stage?: GrowthOpportunityStageKey | null
  next_steps?: string[] | null
  close_date?: string | null
  owner_id?: string | null
}

export type ConfirmCreateOpportunityFromDraftResult = {
  ok: boolean
  opportunity_created: boolean
  opportunity_id: string | null
  draft_id: string | null
  draft_status: OpportunityDraftStatus | null
  attribution_chain: OpportunityApprovalAttributionStage[]
  error?: string | null
} & OpportunityApprovalSafetyFlags

export type OpportunityApprovalActionResult = ConfirmCreateOpportunityFromDraftResult & {
  action: "create_opportunity"
}

export type OpportunityApprovalEngineCertificationReport = {
  qa_marker: typeof OPPORTUNITY_APPROVAL_ENGINE_QA_MARKER
  certified: boolean
  blockers: string[]
  checks: Array<{ id: string; satisfied: boolean; detail: string }>
} & OpportunityApprovalSafetyFlags

export type OpportunityApprovalEngineAutomationReport = {
  qa_marker: typeof OPPORTUNITY_APPROVAL_ENGINE_QA_MARKER
  automation_id: typeof OPPORTUNITY_APPROVAL_ENGINE_ID
  execution_id: string
  draft_id: string | null
  opportunity_id: string | null
  draft_status: OpportunityDraftStatus | null
  attribution_chain: OpportunityApprovalAttributionStage[]
  blockers: string[]
  completed_at: string
  opportunity_created: boolean
} & OpportunityApprovalSafetyFlags
