/** Apollo Full Pipeline materialization + safety evidence — client-safe. */

import type { ApolloSequenceExecutionAutomationActionResult } from "@/lib/growth/apollo/apollo-sequence-execution-automation-types"
import type { ApolloMultichannelSequenceCandidateRow } from "@/lib/growth/apollo/apollo-multichannel-orchestration-types"
import type { ApolloCertificationMultichannelTemplateOverrideEvidence } from "@/lib/growth/apollo/apollo-certification-multichannel-template-override"
import type { ApolloPipelineGrowthLeadResolutionEvidence } from "@/lib/growth/apollo/apollo-pipeline-growth-lead-resolution-evidence"

export const APOLLO_FULL_PIPELINE_MATERIALIZATION_EVIDENCE_QA_MARKER =
  "apollo-full-pipeline-materialization-evidence-v1" as const

export const APOLLO_FULL_PIPELINE_SAFETY_FLAG_FIELDS = [
  "outreach_sent",
  "jobs_scheduled",
  "email_sent",
  "sms_sent",
  "voice_drop_sent",
  "call_placed",
] as const

export type ApolloFullPipelineSafetyFlagField =
  (typeof APOLLO_FULL_PIPELINE_SAFETY_FLAG_FIELDS)[number]

export type ApolloFullPipelineSafetyViolation = {
  stage: string
  field: ApolloFullPipelineSafetyFlagField
  value: unknown
}

export type ApolloFullPipelineMaterializationEvidence = {
  materialization_attempted: boolean
  materialization_error: string | null
  materialization_error_table: string | null
  materialization_error_operation: string | null
  sequence_execution_candidate_id: string | null
  sequence_enrollment_id: string | null
  steps_created: number
  draft_placeholders_created: number
  pending_approval_jobs_created: number
  selected_sequence_key: string | null
  selected_sequence_template: string | null
  unsupported_channel_or_template_blockers: string[]
  materialization_reused: boolean
  growth_lead_resolution_attempted: boolean
  growth_lead_resolution_source: string | null
  growth_lead_id: string | null
  growth_lead_id_before: string | null
  growth_lead_id_after: string | null
  growth_lead_backfilled_rows: string[]
  growth_lead_resolution_blockers: string[]
  certification_sequence_template_override_used: boolean
  original_sequence_key: string | null
  materialized_sequence_key: string | null
  materializable_steps_before: number
  materializable_steps_after: number
  template_override_blockers: string[]
}

const UNSAFE_JOB_STATUSES = new Set([
  "scheduled",
  "running",
  "completed",
  "sent",
  "executed",
  "delivered",
])

export function resolveUnsupportedSequenceMaterializationBlockers(input: {
  sequence_key: string
  sequence_label: string
  scheduling_touches: Array<{ channel: string }>
  materialized_step_count: number
}): string[] {
  const blockers: string[] = []
  if (input.sequence_key === "custom_future" && input.materialized_step_count === 0) {
    blockers.push("unsupported_template:custom_future")
  }

  const unsupportedChannels = input.scheduling_touches
    .map((touch) => touch.channel)
    .filter((channel) => channel === "future_channel" || channel === "linkedin")
  if (unsupportedChannels.length > 0 && input.materialized_step_count === 0) {
    blockers.push(`unsupported_channel:${[...new Set(unsupportedChannels)].join(",")}`)
  }

  if (input.materialized_step_count === 0 && blockers.length === 0) {
    blockers.push(`unsupported_sequence:${input.sequence_key || "unknown"}`)
  }

  return blockers
}

export function parseMaterializationErrorEvidence(error: string | null | undefined): {
  materialization_error_table: string | null
  materialization_error_operation: string | null
  unsupported_channel_or_template_blockers: string[]
} {
  const normalized = typeof error === "string" ? error.trim() : ""
  if (!normalized) {
    return {
      materialization_error_table: null,
      materialization_error_operation: null,
      unsupported_channel_or_template_blockers: [],
    }
  }

  const unsupported_channel_or_template_blockers: string[] = []
  if (normalized.startsWith("unsupported_template:")) {
    unsupported_channel_or_template_blockers.push(normalized)
  } else if (normalized.startsWith("unsupported_channel:")) {
    unsupported_channel_or_template_blockers.push(normalized)
  } else if (normalized.startsWith("unsupported_sequence:")) {
    unsupported_channel_or_template_blockers.push(normalized)
  }

  let materialization_error_table: string | null = null
  let materialization_error_operation: string | null = null

  if (/invalid input syntax for type uuid/i.test(normalized)) {
    materialization_error_table = "growth.sequence_enrollments"
    materialization_error_operation = "insert"
  } else if (/sequence_pattern_not_found/i.test(normalized)) {
    materialization_error_table = "growth.sequence_patterns"
    materialization_error_operation = "lookup"
  } else if (/growth_lead_id_required/i.test(normalized)) {
    materialization_error_table = "growth.apollo_sequence_execution_candidates"
    materialization_error_operation = "precheck"
  } else if (/execution_candidate_insert_failed/i.test(normalized)) {
    materialization_error_table = "growth.apollo_sequence_execution_candidates"
    materialization_error_operation = "insert"
  } else if (/sequence_steps_empty/i.test(normalized)) {
    materialization_error_table = "growth.apollo_sequence_execution_candidates"
    materialization_error_operation = "materialize"
  }

  return {
    materialization_error_table,
    materialization_error_operation,
    unsupported_channel_or_template_blockers,
  }
}

export function evaluateApolloFullPipelineStageSafety(
  row: Record<string, unknown> | null | undefined,
  stage: string,
): ApolloFullPipelineSafetyViolation[] {
  if (!row) return []

  const violations: ApolloFullPipelineSafetyViolation[] = []
  for (const field of APOLLO_FULL_PIPELINE_SAFETY_FLAG_FIELDS) {
    if (row[field] === true) {
      violations.push({ stage, field, value: row[field] })
    }
  }

  return violations
}

export function evaluateApolloFullPipelineExecutionJobSafety(input: {
  jobs: Array<{ status: string }>
}): ApolloFullPipelineSafetyViolation[] {
  const violations: ApolloFullPipelineSafetyViolation[] = []
  for (const job of input.jobs) {
    const status = typeof job.status === "string" ? job.status.trim().toLowerCase() : ""
    if (UNSAFE_JOB_STATUSES.has(status)) {
      violations.push({
        stage: "sequence_execution_jobs",
        field: "jobs_scheduled",
        value: status,
      })
    }
  }
  return violations
}

export function summarizeApolloFullPipelineSafetyViolations(
  violations: ApolloFullPipelineSafetyViolation[],
): string {
  if (violations.length === 0) {
    return "All stage records report outreach_sent=false, jobs_scheduled=false, and no channel sends."
  }
  return violations
    .map((violation) => `${violation.stage}.${violation.field}=${String(violation.value)}`)
    .join(" | ")
}

export function buildApolloFullPipelineMaterializationEvidence(input: {
  attempted: boolean
  reused: boolean
  handoff?: ApolloSequenceExecutionAutomationActionResult | null
  sequence_execution_candidate_id?: string | null
  sequence_enrollment_id?: string | null
  steps_created?: number
  draft_placeholders_created?: number
  pending_approval_jobs_created?: number
  multichannel?: Pick<
    ApolloMultichannelSequenceCandidateRow,
    "sequence_template" | "scheduling_plan"
  > | null
  growth_lead_resolution?: ApolloPipelineGrowthLeadResolutionEvidence | null
  template_override?: ApolloCertificationMultichannelTemplateOverrideEvidence | null
}): ApolloFullPipelineMaterializationEvidence {
  const error = input.handoff?.ok === false ? input.handoff.error ?? "materialization_failed" : null
  const parsed = parseMaterializationErrorEvidence(error)
  const blockers =
    parsed.unsupported_channel_or_template_blockers.length > 0
      ? parsed.unsupported_channel_or_template_blockers
      : error
        ? resolveUnsupportedSequenceMaterializationBlockers({
            sequence_key: input.multichannel?.sequence_template.sequence_key ?? "unknown",
            sequence_label: input.multichannel?.sequence_template.sequence_label ?? "unknown",
            scheduling_touches: input.multichannel?.scheduling_plan.touches ?? [],
            materialized_step_count: input.steps_created ?? 0,
          }).filter((blocker) => error.includes(blocker) || blocker.startsWith("unsupported_"))
        : []

  return {
    materialization_attempted: input.attempted,
    materialization_error: error,
    materialization_error_table: parsed.materialization_error_table,
    materialization_error_operation: parsed.materialization_error_operation,
    sequence_execution_candidate_id:
      input.sequence_execution_candidate_id ?? input.handoff?.candidate_id ?? null,
    sequence_enrollment_id:
      input.sequence_enrollment_id ?? input.handoff?.sequence_enrollment_id ?? null,
    steps_created: input.steps_created ?? input.handoff?.steps_created ?? 0,
    draft_placeholders_created:
      input.draft_placeholders_created ?? input.handoff?.draft_placeholders_created ?? 0,
    pending_approval_jobs_created:
      input.pending_approval_jobs_created ?? input.handoff?.pending_approval_jobs_created ?? 0,
    selected_sequence_key: input.multichannel?.sequence_template.sequence_key ?? null,
    selected_sequence_template: input.multichannel?.sequence_template.sequence_label ?? null,
    unsupported_channel_or_template_blockers: blockers,
    materialization_reused: input.reused,
    growth_lead_resolution_attempted:
      input.growth_lead_resolution?.growth_lead_resolution_attempted ?? false,
    growth_lead_resolution_source:
      input.growth_lead_resolution?.growth_lead_resolution_source ?? null,
    growth_lead_id: input.growth_lead_resolution?.growth_lead_id ?? null,
    growth_lead_id_before: input.growth_lead_resolution?.growth_lead_id_before ?? null,
    growth_lead_id_after: input.growth_lead_resolution?.growth_lead_id_after ?? null,
    growth_lead_backfilled_rows: input.growth_lead_resolution?.growth_lead_backfilled_rows ?? [],
    growth_lead_resolution_blockers:
      input.growth_lead_resolution?.growth_lead_resolution_blockers ?? [],
    certification_sequence_template_override_used:
      input.template_override?.certification_sequence_template_override_used ?? false,
    original_sequence_key: input.template_override?.original_sequence_key ?? null,
    materialized_sequence_key: input.template_override?.materialized_sequence_key ?? null,
    materializable_steps_before: input.template_override?.materializable_steps_before ?? 0,
    materializable_steps_after: input.template_override?.materializable_steps_after ?? 0,
    template_override_blockers: input.template_override?.template_override_blockers ?? [],
  }
}
