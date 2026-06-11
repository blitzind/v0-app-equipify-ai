/** Apollo Sequence Execution automation evidence — client-safe. */

import type {
  ApolloSequenceExecutionAttributionRecord,
  ApolloSequenceExecutionCandidateRow,
  ApolloSequenceExecutionCandidateStatus,
  ApolloSequenceExecutionDraftRecord,
  ApolloSequenceExecutionJobLink,
  ApolloSequenceExecutionMaterializationPlan,
  ApolloSequenceExecutionOperatorSummary,
  ApolloSequenceExecutionQueueSnapshot,
} from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
import {
  APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER,
  APOLLO_SEQUENCE_EXECUTION_SOURCE_ATTRIBUTION,
} from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
import { buildApolloPipelineAttributionDisplay } from "@/lib/growth/apollo/apollo-pipeline-attribution-display"
import type { ApolloQueuePaginationMeta } from "@/lib/growth/apollo/apollo-queue-pagination"
import { summarizeApolloSequenceCandidateDraftReadiness } from "@/lib/growth/apollo/apollo-sequence-draft-readiness"

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

export function buildApolloSequenceExecutionAttributionChain(): ApolloSequenceExecutionAttributionRecord["attribution_chain"] {
  return [...APOLLO_SEQUENCE_EXECUTION_SOURCE_ATTRIBUTION]
}

export function buildApolloSequenceExecutionAttributionRecord(
  prior?: Record<string, unknown> | null,
): ApolloSequenceExecutionAttributionRecord {
  const defaultChain = buildApolloSequenceExecutionAttributionChain()
  let attribution_chain = defaultChain

  if (Array.isArray(prior?.attribution_chain)) {
    const normalized = (prior.attribution_chain as string[]).map((entry) =>
      entry === "Multi-Channel Sequence" ? "Multi-Channel" : entry,
    )
    attribution_chain = normalized.includes("Sequence Execution")
      ? (normalized as ApolloSequenceExecutionAttributionRecord["attribution_chain"])
      : ([...normalized, "Sequence Execution"] as ApolloSequenceExecutionAttributionRecord["attribution_chain"])
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
    sequence_execution_source: "apollo_sequence_execution_automation",
    attribution_chain,
  }
}

export function assertApolloSequenceExecutionAttributionPreserved(
  record: ApolloSequenceExecutionAttributionRecord | null | undefined,
): boolean {
  if (!record) return false
  return APOLLO_SEQUENCE_EXECUTION_SOURCE_ATTRIBUTION.every((entry) =>
    record.attribution_chain.includes(entry),
  )
}

export function mapApolloSequenceExecutionCandidateDbRow(
  row: Record<string, unknown>,
): ApolloSequenceExecutionCandidateRow {
  const materialization =
    row.sequence_materialization && typeof row.sequence_materialization === "object"
      ? (row.sequence_materialization as ApolloSequenceExecutionMaterializationPlan)
      : {
          plan_version: "v1",
          sequence_key: "pending",
          sequence_label: "Pending",
          pattern_key: "pending",
          total_steps: 0,
          total_days: 0,
          steps: [],
          drafts: [],
        }

  const executionJobs =
    row.execution_jobs && Array.isArray(row.execution_jobs)
      ? (row.execution_jobs as ApolloSequenceExecutionJobLink[])
      : []

  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {}

  return {
    candidate_id: asString(row.id),
    multichannel_sequence_candidate_id: asString(row.multichannel_sequence_candidate_id),
    voice_drop_candidate_id: asString(row.voice_drop_candidate_id),
    enrollment_candidate_id: asString(row.enrollment_candidate_id),
    company_candidate_id: asString(row.company_candidate_id),
    company_contact_id: asString(row.company_contact_id) || null,
    growth_lead_id: asString(row.growth_lead_id) || null,
    sequence_enrollment_id: asString(row.sequence_enrollment_id) || null,
    status:
      (asString(row.status) as ApolloSequenceExecutionCandidateStatus) || "pending_draft_approval",
    company_name: asString(metadata.company_name) || "Unknown",
    full_name: asString(metadata.full_name) || "Unknown",
    title: asString(metadata.title) || null,
    email: asString(metadata.email) || null,
    phone: asString(metadata.phone) || null,
    qualification_score: asNumber(metadata.qualification_score),
    materialization,
    execution_jobs: executionJobs,
    source_attribution:
      row.source_attribution && typeof row.source_attribution === "object"
        ? (row.source_attribution as ApolloSequenceExecutionAttributionRecord)
        : buildApolloSequenceExecutionAttributionRecord(),
    operator_summary:
      row.operator_summary && typeof row.operator_summary === "object"
        ? (row.operator_summary as ApolloSequenceExecutionOperatorSummary)
        : {
            why_materialized: "Pending",
            sequence_label: "Pending",
            step_summary: "Pending",
            draft_summary: "Pending",
            execution_queue_summary: "Pending",
          },
    created_at: asString(row.created_at),
    drafts_approved_at: asString(row.drafts_approved_at) || null,
    drafts_approved_email: asString(row.drafts_approved_email) || null,
    draft_rejection_note: asString(row.draft_rejection_note) || null,
    draft_readiness_label: summarizeApolloSequenceCandidateDraftReadiness(materialization.drafts)
      .readiness_label,
    attribution_display: buildApolloPipelineAttributionDisplay({
      source_attribution: row.source_attribution as Record<string, unknown>,
      approved_at: asString(row.drafts_approved_at) || null,
      approved_email: asString(row.drafts_approved_email) || null,
      approved_by: asString(row.drafts_approved_by) || null,
      rejection_note: asString(row.draft_rejection_note) || null,
    }),
  }
}

export function buildApolloSequenceExecutionQueueSnapshot(input: {
  items: ApolloSequenceExecutionCandidateRow[]
  pagination?: ApolloQueuePaginationMeta
}): ApolloSequenceExecutionQueueSnapshot {
  const items = input.items
  return {
    qa_marker: APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER,
    queue_label: "Sequence Execution Queue",
    items,
    summary: {
      total: items.length,
      pending_drafts: items.filter((r) => r.status === "pending_draft_approval").length,
      execution_ready: items.filter((r) => r.status === "execution_ready").length,
      rejected: items.filter((r) => r.status === "draft_rejected").length,
      regenerated: items.filter((r) => r.status === "draft_regenerated").length,
    },
    outreach_sent: false,
    voice_drop_sent: false,
    email_sent: false,
    sms_sent: false,
    call_placed: false,
    draft_created: true,
    jobs_scheduled: false,
    pagination: input.pagination,
  }
}

export function evaluateApolloSequenceExecutionDraftApprovalGate(input: {
  candidate: ApolloSequenceExecutionCandidateRow
}): { allowed: boolean; code: string | null } {
  if (input.candidate.status !== "pending_draft_approval") {
    return { allowed: false, code: "invalid_candidate_status" }
  }
  if (!input.candidate.materialization.drafts.length) {
    return { allowed: false, code: "drafts_missing" }
  }
  if (!input.candidate.materialization.steps.length) {
    return { allowed: false, code: "sequence_steps_missing" }
  }
  if (!input.candidate.sequence_enrollment_id) {
    return { allowed: false, code: "sequence_not_materialized" }
  }
  return { allowed: true, code: null }
}

export function evaluateApolloSequenceExecutionDuplicateBlock(input: {
  existing_status: ApolloSequenceExecutionCandidateStatus | null
}): { blocked: boolean; code: string | null } {
  if (input.existing_status === "pending_draft_approval") {
    return { blocked: true, code: "duplicate_pending_execution" }
  }
  if (input.existing_status === "execution_ready") {
    return { blocked: true, code: "already_execution_ready" }
  }
  return { blocked: false, code: null }
}

export function approveAllApolloSequenceExecutionDrafts(
  drafts: ApolloSequenceExecutionDraftRecord[],
): ApolloSequenceExecutionDraftRecord[] {
  return drafts.map((draft) => ({ ...draft, approval_status: "draft_approved" as const }))
}
