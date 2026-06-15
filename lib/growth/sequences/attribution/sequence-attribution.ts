/** SR-3 Phase 0 — sequence attribution helpers (client-safe). */

import type {
  GrowthSequenceAttributionContext,
  GrowthSequenceAttributionDbRow,
  GrowthSharePageAttributionDbRow,
} from "@/lib/growth/sequences/attribution/sequence-attribution-types"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function readUuid(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return UUID_RE.test(trimmed) ? trimmed : null
}

export function emptySequenceAttributionContext(): GrowthSequenceAttributionContext {
  return {
    sequenceEnrollmentId: null,
    sequenceEnrollmentStepId: null,
    sequenceExecutionJobId: null,
  }
}

export function buildSequenceAttributionContext(input: {
  sequenceEnrollmentId?: string | null
  sequenceEnrollmentStepId?: string | null
  sequenceExecutionJobId?: string | null
}): GrowthSequenceAttributionContext {
  return {
    sequenceEnrollmentId: readUuid(input.sequenceEnrollmentId),
    sequenceEnrollmentStepId: readUuid(input.sequenceEnrollmentStepId),
    sequenceExecutionJobId: readUuid(input.sequenceExecutionJobId),
  }
}

export function mergeSequenceAttributionContext(
  primary: GrowthSequenceAttributionContext,
  fallback: Partial<GrowthSequenceAttributionContext>,
): GrowthSequenceAttributionContext {
  return {
    sequenceEnrollmentId: primary.sequenceEnrollmentId ?? readUuid(fallback.sequenceEnrollmentId) ?? null,
    sequenceEnrollmentStepId:
      primary.sequenceEnrollmentStepId ?? readUuid(fallback.sequenceEnrollmentStepId) ?? null,
    sequenceExecutionJobId:
      primary.sequenceExecutionJobId ?? readUuid(fallback.sequenceExecutionJobId) ?? null,
  }
}

export function sequenceAttributionFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): GrowthSequenceAttributionContext {
  if (!metadata) return emptySequenceAttributionContext()
  return buildSequenceAttributionContext({
    sequenceEnrollmentId:
      metadata.sequence_enrollment_id ?? metadata.sequenceEnrollmentId ?? metadata.enrollment_id,
    sequenceEnrollmentStepId:
      metadata.sequence_enrollment_step_id ??
      metadata.sequenceEnrollmentStepId ??
      metadata.sequence_step_id,
    sequenceExecutionJobId:
      metadata.sequence_execution_job_id ?? metadata.sequenceExecutionJobId ?? metadata.job_id,
  })
}

export function sequenceAttributionToMetadata(
  context: GrowthSequenceAttributionContext,
): Record<string, unknown> {
  return {
    sequence_enrollment_id: context.sequenceEnrollmentId,
    sequence_enrollment_step_id: context.sequenceEnrollmentStepId,
    sequence_execution_job_id: context.sequenceExecutionJobId,
  }
}

export function sequenceAttributionToDbRow(
  context: GrowthSequenceAttributionContext,
): GrowthSequenceAttributionDbRow {
  return {
    sequence_enrollment_id: context.sequenceEnrollmentId,
    sequence_enrollment_step_id: context.sequenceEnrollmentStepId,
    sequence_execution_job_id: context.sequenceExecutionJobId,
  }
}

export function sharePageAttributionToDbRow(input: {
  enrollmentId?: string | null
  sequenceEnrollmentStepId?: string | null
  sequenceStepId?: string | null
  sequenceExecutionJobId?: string | null
}): GrowthSharePageAttributionDbRow {
  return {
    enrollment_id: readUuid(input.enrollmentId),
    sequence_enrollment_step_id: readUuid(input.sequenceEnrollmentStepId),
    sequence_step_id: readUuid(input.sequenceStepId),
    sequence_execution_job_id: readUuid(input.sequenceExecutionJobId),
  }
}

export function isCompleteSequenceAttribution(context: GrowthSequenceAttributionContext): boolean {
  return Boolean(
    context.sequenceEnrollmentId && context.sequenceEnrollmentStepId && context.sequenceExecutionJobId,
  )
}

export function hasAnySequenceAttribution(context: GrowthSequenceAttributionContext): boolean {
  return Boolean(
    context.sequenceEnrollmentId || context.sequenceEnrollmentStepId || context.sequenceExecutionJobId,
  )
}
