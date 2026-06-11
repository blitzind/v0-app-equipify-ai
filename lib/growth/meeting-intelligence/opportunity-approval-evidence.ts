/** Opportunity Approval Engine evidence helpers — client-safe. */

import type { OpportunityDraftRow } from "@/lib/growth/meeting-intelligence/opportunity-draft-engine-types"
import type {
  OpportunityApprovalAttributionRecord,
  OpportunityApprovalAttributionStage,
  OpportunityApprovalSafetyFlags,
} from "@/lib/growth/meeting-intelligence/opportunity-approval-engine-types"
import {
  OPPORTUNITY_APPROVAL_ATTRIBUTION_CHAIN,
  OPPORTUNITY_APPROVAL_ENGINE_QA_MARKER,
} from "@/lib/growth/meeting-intelligence/opportunity-approval-engine-types"
import { buildOpportunityDraftAttributionRecord } from "@/lib/growth/meeting-intelligence/opportunity-draft-evidence"
import type { GrowthOpportunityStageKey } from "@/lib/growth/opportunity-pipeline/pipeline-types"

export const OPPORTUNITY_APPROVAL_SAFETY_FLAGS: OpportunityApprovalSafetyFlags = {
  auto_created: false,
  human_confirmed: true,
  operator_required: true,
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export function buildOpportunityApprovalAttributionRecord(
  prior?: Record<string, unknown> | null,
): OpportunityApprovalAttributionRecord {
  const draftRecord = buildOpportunityDraftAttributionRecord(prior)
  let attribution_chain: OpportunityApprovalAttributionStage[] = [...OPPORTUNITY_APPROVAL_ATTRIBUTION_CHAIN]

  if (Array.isArray(prior?.attribution_chain)) {
    const normalized = prior.attribution_chain as string[]
    attribution_chain = normalized.includes("Opportunity")
      ? (normalized as OpportunityApprovalAttributionStage[])
      : ([...normalized.filter((entry) => entry !== "Opportunity"), "Opportunity"] as OpportunityApprovalAttributionStage[])
  }

  return {
    ...draftRecord,
    opportunity_source: "growth_opportunity_approval_engine_m1e",
    attribution_chain,
  }
}

export function assertOpportunityApprovalAttributionPreserved(
  record: OpportunityApprovalAttributionRecord | Record<string, unknown> | null | undefined,
): boolean {
  if (!record || typeof record !== "object") return false
  const chain = (record as OpportunityApprovalAttributionRecord).attribution_chain
  if (!Array.isArray(chain)) return false
  return OPPORTUNITY_APPROVAL_ATTRIBUTION_CHAIN.every((entry) => chain.includes(entry))
}

export function evaluateOpportunityDraftCreateOpportunityGate(input: {
  draft: OpportunityDraftRow
}): { allowed: boolean; code: string | null } {
  if (input.draft.status !== "approved") {
    return { allowed: false, code: "draft_not_approved" }
  }
  if (input.draft.opportunity_id) {
    return { allowed: false, code: "draft_already_converted" }
  }
  if (!input.draft.opportunity_summary.trim()) {
    return { allowed: false, code: "opportunity_summary_missing" }
  }
  return { allowed: true, code: null }
}

export function evaluateOpportunityDraftConversionDuplicateBlock(input: {
  draft: OpportunityDraftRow
  lead_has_opportunity: boolean
}): { blocked: boolean; code: string | null } {
  if (input.draft.status === "converted" || input.draft.opportunity_id) {
    return { blocked: true, code: "draft_already_converted" }
  }
  if (input.lead_has_opportunity) {
    return { blocked: true, code: "opportunity_already_exists_for_lead" }
  }
  return { blocked: false, code: null }
}

export function resolveOpportunityFieldsFromDraft(input: {
  draft: OpportunityDraftRow
  edits?: {
    name?: string | null
    estimated_value?: number | null
    stage?: GrowthOpportunityStageKey | null
    next_steps?: string[] | null
    close_date?: string | null
    owner_id?: string | null
  }
}): {
  title: string
  amount: number
  stageKey: GrowthOpportunityStageKey
  expectedCloseDate: string | null
  ownerUserId: string | null
  nextSteps: string[]
} {
  const title =
    asString(input.edits?.name) ||
    `${input.draft.company_name} — ${input.draft.opportunity_type || "post-meeting opportunity"}`.trim()
  const amount =
    input.edits?.estimated_value != null && Number.isFinite(input.edits.estimated_value)
      ? input.edits.estimated_value
      : input.draft.estimated_value
  const stageKey = input.edits?.stage ?? input.draft.recommended_stage
  const nextSteps =
    input.edits?.next_steps && input.edits.next_steps.length > 0
      ? input.edits.next_steps
      : input.draft.next_steps

  return {
    title,
    amount,
    stageKey,
    expectedCloseDate: asString(input.edits?.close_date) || null,
    ownerUserId: asString(input.edits?.owner_id) || null,
    nextSteps,
  }
}

export function buildOpportunityApprovalConversionMetadata(input: {
  draft_id: string
  meeting_id: string
  opportunity_id: string
  operator_id?: string | null
  operator_email?: string | null
  attribution: OpportunityApprovalAttributionRecord
  next_steps: string[]
}): Record<string, unknown> {
  return {
    qa_marker: OPPORTUNITY_APPROVAL_ENGINE_QA_MARKER,
    draft_id: input.draft_id,
    meeting_id: input.meeting_id,
    opportunity_id: input.opportunity_id,
    converted_by: input.operator_id ?? null,
    converted_email: input.operator_email ?? null,
    next_steps: input.next_steps,
    source_attribution: input.attribution,
    human_confirmed: true,
    auto_created: false,
  }
}
