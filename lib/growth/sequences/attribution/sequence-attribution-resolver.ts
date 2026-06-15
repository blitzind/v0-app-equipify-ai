import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getDeliveryAttempt } from "@/lib/growth/providers/transport/transport-repository"
import {
  buildSequenceAttributionContext,
  emptySequenceAttributionContext,
  mergeSequenceAttributionContext,
  sequenceAttributionFromMetadata,
} from "@/lib/growth/sequences/attribution/sequence-attribution"
import type { GrowthSequenceAttributionContext } from "@/lib/growth/sequences/attribution/sequence-attribution-types"

function readColumn(row: Record<string, unknown>, key: string): string | null {
  const value = row[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

export async function resolveSequenceAttributionFromExecutionJob(
  admin: SupabaseClient,
  jobId: string,
): Promise<GrowthSequenceAttributionContext> {
  const { data, error } = await admin
    .schema("growth")
    .from("sequence_execution_jobs")
    .select("id, sequence_enrollment_id, sequence_step_id")
    .eq("id", jobId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return emptySequenceAttributionContext()

  const row = data as Record<string, unknown>
  return buildSequenceAttributionContext({
    sequenceEnrollmentId: readColumn(row, "sequence_enrollment_id"),
    sequenceEnrollmentStepId: readColumn(row, "sequence_step_id"),
    sequenceExecutionJobId: readColumn(row, "id"),
  })
}

export async function resolveSequenceAttributionFromDeliveryAttemptId(
  admin: SupabaseClient,
  deliveryAttemptId: string,
): Promise<GrowthSequenceAttributionContext> {
  const attempt = await getDeliveryAttempt(admin, deliveryAttemptId)
  if (!attempt) return emptySequenceAttributionContext()

  const { data: attemptRow, error: attemptError } = await admin
    .schema("growth")
    .from("delivery_attempts")
    .select("sequence_enrollment_id, sequence_enrollment_step_id, sequence_execution_job_id, metadata")
    .eq("id", deliveryAttemptId)
    .maybeSingle()
  if (attemptError) throw new Error(attemptError.message)

  const row = (attemptRow as Record<string, unknown> | null) ?? {}
  let context = mergeSequenceAttributionContext(
    buildSequenceAttributionContext({
      sequenceEnrollmentId: attempt.sequence_enrollment_id ?? readColumn(row, "sequence_enrollment_id"),
      sequenceEnrollmentStepId: readColumn(row, "sequence_enrollment_step_id"),
      sequenceExecutionJobId: readColumn(row, "sequence_execution_job_id"),
    }),
    sequenceAttributionFromMetadata(
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : attempt.metadata,
    ),
  )

  if (!context.sequenceExecutionJobId || !context.sequenceEnrollmentStepId) {
    const { data: job, error: jobError } = await admin
      .schema("growth")
      .from("sequence_execution_jobs")
      .select("id, sequence_enrollment_id, sequence_step_id")
      .eq("delivery_attempt_id", deliveryAttemptId)
      .maybeSingle()
    if (jobError) throw new Error(jobError.message)
    if (job) {
      const jobRow = job as Record<string, unknown>
      context = mergeSequenceAttributionContext(context, {
        sequenceEnrollmentId: readColumn(jobRow, "sequence_enrollment_id"),
        sequenceEnrollmentStepId: readColumn(jobRow, "sequence_step_id"),
        sequenceExecutionJobId: readColumn(jobRow, "id"),
      })
    }
  }

  return context
}

export async function resolveSequenceAttributionFromSmsDeliveryAttemptId(
  admin: SupabaseClient,
  smsDeliveryAttemptId: string,
): Promise<GrowthSequenceAttributionContext> {
  const { data, error } = await admin
    .schema("growth")
    .from("sms_delivery_attempts")
    .select("sequence_enrollment_id, sequence_enrollment_step_id, sequence_execution_job_id, metadata")
    .eq("id", smsDeliveryAttemptId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return emptySequenceAttributionContext()

  const row = data as Record<string, unknown>
  let context = mergeSequenceAttributionContext(
    buildSequenceAttributionContext({
      sequenceEnrollmentId: readColumn(row, "sequence_enrollment_id"),
      sequenceEnrollmentStepId: readColumn(row, "sequence_enrollment_step_id"),
      sequenceExecutionJobId: readColumn(row, "sequence_execution_job_id"),
    }),
    sequenceAttributionFromMetadata(
      row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {},
    ),
  )

  if (!context.sequenceExecutionJobId) {
    const { data: job, error: jobError } = await admin
      .schema("growth")
      .from("sequence_execution_jobs")
      .select("id, sequence_enrollment_id, sequence_step_id")
      .eq("sms_delivery_attempt_id", smsDeliveryAttemptId)
      .maybeSingle()
    if (jobError) throw new Error(jobError.message)
    if (job) {
      const jobRow = job as Record<string, unknown>
      context = mergeSequenceAttributionContext(context, {
        sequenceEnrollmentId: readColumn(jobRow, "sequence_enrollment_id"),
        sequenceEnrollmentStepId: readColumn(jobRow, "sequence_step_id"),
        sequenceExecutionJobId: readColumn(jobRow, "id"),
      })
    }
  }

  return context
}

export async function resolveSequenceAttributionFromEnrollmentStepId(
  admin: SupabaseClient,
  enrollmentStepId: string,
): Promise<GrowthSequenceAttributionContext> {
  const { data, error } = await admin
    .schema("growth")
    .from("sequence_enrollment_steps")
    .select("id, enrollment_id")
    .eq("id", enrollmentStepId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return emptySequenceAttributionContext()

  const row = data as Record<string, unknown>
  let context = buildSequenceAttributionContext({
    sequenceEnrollmentId: readColumn(row, "enrollment_id"),
    sequenceEnrollmentStepId: readColumn(row, "id"),
  })

  const { data: job, error: jobError } = await admin
    .schema("growth")
    .from("sequence_execution_jobs")
    .select("id")
    .eq("sequence_step_id", enrollmentStepId)
    .in("status", ["approved", "scheduled", "running", "sent", "blocked", "failed", "skipped"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (jobError) throw new Error(jobError.message)
  if (job && typeof (job as Record<string, unknown>).id === "string") {
    context = mergeSequenceAttributionContext(context, {
      sequenceExecutionJobId: (job as Record<string, unknown>).id as string,
    })
  }

  return context
}
