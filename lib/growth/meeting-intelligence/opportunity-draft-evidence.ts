/** Opportunity Draft evidence helpers — client-safe. */

import type {
  OpportunityDraftAttributionRecord,
  OpportunityDraftGeneratedArtifacts,
  OpportunityDraftQueueSnapshot,
  OpportunityDraftRow,
  OpportunityDraftSafetyFlags,
  OpportunityDraftSourceAttribution,
  OpportunityDraftStatus,
} from "@/lib/growth/meeting-intelligence/opportunity-draft-engine-types"
import {
  OPPORTUNITY_DRAFT_ENGINE_QA_MARKER,
  OPPORTUNITY_DRAFT_SOURCE_ATTRIBUTION,
} from "@/lib/growth/meeting-intelligence/opportunity-draft-engine-types"
import type { GrowthOpportunityStageKey } from "@/lib/growth/opportunity-pipeline/pipeline-types"

export const OPPORTUNITY_DRAFT_SAFETY_FLAGS: OpportunityDraftSafetyFlags = {
  opportunity_created: false,
  crm_written: false,
  deal_created: false,
  calendar_written: false,
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function buildOpportunityDraftAttributionChain(): OpportunityDraftSourceAttribution[] {
  return [...OPPORTUNITY_DRAFT_SOURCE_ATTRIBUTION]
}

export function buildOpportunityDraftAttributionRecord(
  prior?: Record<string, unknown> | null,
): OpportunityDraftAttributionRecord {
  const defaultChain = buildOpportunityDraftAttributionChain()
  let attribution_chain = defaultChain

  if (Array.isArray(prior?.attribution_chain)) {
    const normalized = prior.attribution_chain as string[]
    attribution_chain = normalized.includes("Opportunity Draft")
      ? (normalized as OpportunityDraftAttributionRecord["attribution_chain"])
      : ([...normalized.filter((entry) => entry !== "Opportunity Draft"), "Opportunity Draft"] as OpportunityDraftAttributionRecord["attribution_chain"])
  }

  return {
    apollo_source: asString(prior?.apollo_source) || "Apollo Primary Contact Acquisition",
    qualification_source:
      asString(prior?.qualification_source) || "apollo_enrollment_qualification_engine",
    enrollment_source: asString(prior?.enrollment_source) || "apollo_enrollment_automation",
    account_playbook_source:
      asString(prior?.account_playbook_source) || "apollo_account_playbooks_abp_1",
    voice_drop_source: asString(prior?.voice_drop_source) || "apollo_voice_drop_automation",
    multichannel_source:
      asString(prior?.multichannel_source) || "apollo_multichannel_orchestration_engine",
    sequence_execution_source:
      asString(prior?.sequence_execution_source) || "apollo_sequence_execution_automation",
    reply_intelligence_source: asString(prior?.reply_intelligence_source) || "growth_reply_intelligence_v2",
    meeting_candidate_source:
      asString(prior?.meeting_candidate_source) || "apollo_meeting_bridge_m1a",
    meeting_source: asString(prior?.meeting_source) || "growth_meeting_intelligence",
    opportunity_draft_source: "growth_opportunity_draft_engine_m1d",
    attribution_chain,
  }
}

export function assertOpportunityDraftAttributionPreserved(
  record: OpportunityDraftAttributionRecord | Record<string, unknown> | null | undefined,
): boolean {
  if (!record || typeof record !== "object") return false
  const chain = (record as OpportunityDraftAttributionRecord).attribution_chain
  if (!Array.isArray(chain)) return false
  return OPPORTUNITY_DRAFT_SOURCE_ATTRIBUTION.every((entry) => chain.includes(entry))
}

export function evaluateOpportunityDraftDuplicateBlock(input: {
  existing_status: OpportunityDraftStatus
}): { blocked: boolean; code: string | null } {
  if (input.existing_status === "draft" || input.existing_status === "approved") {
    return { blocked: true, code: "duplicate_opportunity_draft_pending_or_approved" }
  }
  return { blocked: false, code: null }
}

export function evaluateOpportunityDraftApprovalGate(input: {
  draft: OpportunityDraftRow
}): { allowed: boolean; code: string | null } {
  if (input.draft.status !== "draft") {
    return { allowed: false, code: "invalid_draft_status" }
  }
  if (!input.draft.opportunity_summary.trim()) {
    return { allowed: false, code: "opportunity_summary_missing" }
  }
  return { allowed: true, code: null }
}

export function mapOpportunityDraftDbRow(row: Record<string, unknown>): OpportunityDraftRow {
  return {
    draft_id: asString(row.id),
    meeting_id: asString(row.meeting_id),
    lead_id: asString(row.lead_id),
    company_id: asString(row.company_id) || null,
    account_playbook_id: asString(row.account_playbook_id) || null,
    company_name: asString(row.company_name),
    opportunity_summary: asString(row.opportunity_summary),
    opportunity_type: asString(row.opportunity_type),
    estimated_value: asNumber(row.estimated_value),
    confidence_score: asNumber(row.confidence_score),
    recommended_stage: (asString(row.recommended_stage) || "discovery") as GrowthOpportunityStageKey,
    key_stakeholders: Array.isArray(row.key_stakeholders)
      ? (row.key_stakeholders as OpportunityDraftRow["key_stakeholders"])
      : [],
    buying_signals: Array.isArray(row.buying_signals)
      ? row.buying_signals.filter((entry): entry is string => typeof entry === "string")
      : [],
    risks: Array.isArray(row.risks)
      ? row.risks.filter((entry): entry is string => typeof entry === "string")
      : [],
    next_steps: Array.isArray(row.next_steps)
      ? row.next_steps.filter((entry): entry is string => typeof entry === "string")
      : [],
    reasoning: asString(row.reasoning),
    opportunity_readiness_score: asNumber(row.opportunity_readiness_score),
    opportunity_readiness_status:
      (asString(row.opportunity_readiness_status) || "Weak") as OpportunityDraftRow["opportunity_readiness_status"],
    source_attribution:
      row.source_attribution && typeof row.source_attribution === "object"
        ? (row.source_attribution as OpportunityDraftAttributionRecord)
        : null,
    status: (asString(row.status) || "draft") as OpportunityDraftStatus,
    input_hash: asString(row.input_hash) || null,
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at),
    approved_at: asString(row.approved_at) || null,
    approved_email: asString(row.approved_email) || null,
    rejection_note: asString(row.rejection_note) || null,
  }
}

export function buildOpportunityDraftQueueSnapshot(input: {
  items: OpportunityDraftRow[]
}): OpportunityDraftQueueSnapshot {
  return {
    qa_marker: OPPORTUNITY_DRAFT_ENGINE_QA_MARKER,
    queue_label: "Opportunity Drafts Ready",
    items: input.items,
    summary: {
      total: input.items.length,
      draft: input.items.filter((item) => item.status === "draft").length,
      approved: input.items.filter((item) => item.status === "approved").length,
      rejected: input.items.filter((item) => item.status === "rejected").length,
      stale: input.items.filter((item) => item.status === "stale").length,
    },
    ...OPPORTUNITY_DRAFT_SAFETY_FLAGS,
  }
}

export function mapOpportunityDraftRowToArtifacts(row: OpportunityDraftRow): OpportunityDraftGeneratedArtifacts {
  return {
    opportunity_summary: row.opportunity_summary,
    opportunity_type: row.opportunity_type,
    estimated_value: row.estimated_value,
    confidence_score: row.confidence_score,
    recommended_stage: row.recommended_stage,
    key_stakeholders: row.key_stakeholders,
    buying_signals: row.buying_signals,
    risks: row.risks,
    next_steps: row.next_steps,
    reasoning: row.reasoning,
    opportunity_readiness: {
      opportunity_readiness_score: row.opportunity_readiness_score,
      readiness_status: row.opportunity_readiness_status,
      factors: [],
    },
  }
}
