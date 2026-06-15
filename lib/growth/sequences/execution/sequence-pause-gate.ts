import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { SequenceExecutionPauseGateResult } from "@/lib/growth/sequences/attribution/sequence-attribution-types"
import { evaluateEnrollmentStatusForExecutionGate } from "@/lib/growth/sequences/execution/sequence-pause-gate-types"
import {
  recordSequenceExecutionJobAuditEvent,
  recordSequenceExecutionTimelineEvent,
} from "@/lib/growth/sequences/execution/sequence-execution-events"
import { updateSequenceExecutionJob } from "@/lib/growth/sequences/execution/sequence-job-repository"
import type { GrowthSequenceExecutionJob } from "@/lib/growth/sequences/execution/sequence-execution-types"

const PAUSE_GATE_QA_MARKER = "sequence-execution-pause-gate-sr3-phase0-v1" as const

export { evaluateEnrollmentStatusForExecutionGate } from "@/lib/growth/sequences/execution/sequence-pause-gate-types"

function allowed(): SequenceExecutionPauseGateResult {
  return { allowed: true, blocked: false, code: null, reason: null }
}

export async function hasPendingSequenceExitCandidateForEnrollment(
  admin: SupabaseClient,
  enrollmentId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .schema("growth")
    .from("reply_intelligence_events")
    .select("id, metadata")
    .eq("event_type", "sequence_exit_candidate")
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    const metadata = (row as Record<string, unknown>).metadata
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) continue
    const record = metadata as Record<string, unknown>
    if (String(record.sequence_enrollment_id ?? "") !== enrollmentId) continue
    const resolution = typeof record.operator_resolution === "string" ? record.operator_resolution.trim() : ""
    if (!resolution) return true
  }

  return false
}

export async function evaluateSequenceExecutionPauseGate(
  admin: SupabaseClient,
  input: { sequenceEnrollmentId: string },
): Promise<SequenceExecutionPauseGateResult> {
  const { data, error } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("id, status")
    .eq("id", input.sequenceEnrollmentId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) {
    return {
      allowed: false,
      blocked: true,
      code: "enrollment_not_active",
      reason: "Sequence enrollment not found — transport execution blocked.",
    }
  }

  const statusGate = evaluateEnrollmentStatusForExecutionGate(
    String((data as Record<string, unknown>).status ?? ""),
  )
  if (statusGate) return statusGate

  const exitPending = await hasPendingSequenceExitCandidateForEnrollment(admin, input.sequenceEnrollmentId)
  if (exitPending) {
    return {
      allowed: false,
      blocked: true,
      code: "exit_candidate_pending",
      reason: "Pending sequence exit candidate — transport execution blocked until operator review.",
    }
  }

  return allowed()
}

export async function blockSequenceExecutionJobForPauseGate(
  admin: SupabaseClient,
  input: {
    job: Pick<
      GrowthSequenceExecutionJob,
      "id" | "leadId" | "sequenceEnrollmentId" | "sequenceStepId" | "attemptCount"
    >
    gate: SequenceExecutionPauseGateResult
  },
): Promise<void> {
  if (!input.gate.blocked || !input.gate.code) return

  await updateSequenceExecutionJob(admin, input.job.id, {
    status: "blocked",
    lastError: input.gate.code,
    lockedAt: null,
    lockedBy: null,
    attemptCount: input.job.attemptCount + 1,
  })

  await recordSequenceExecutionJobAuditEvent(admin, {
    jobId: input.job.id,
    eventType: "job_blocked",
    title: "Execution blocked — enrollment pause gate",
    description: input.gate.reason ?? input.gate.code,
    severity: "high",
    metadata: {
      qa_marker: PAUSE_GATE_QA_MARKER,
      pause_gate_code: input.gate.code,
      sequence_enrollment_id: input.job.sequenceEnrollmentId,
      sequence_step_id: input.job.sequenceStepId,
    },
  })

  await recordSequenceExecutionTimelineEvent(admin, {
    leadId: input.job.leadId,
    eventType: "sequence_step_blocked",
    title: "Sequence step blocked",
    summary: input.gate.reason ?? input.gate.code,
    jobId: input.job.id,
    enrollmentId: input.job.sequenceEnrollmentId,
    stepId: input.job.sequenceStepId,
  })
}

export async function assertSequenceExecutionPauseGate(
  admin: SupabaseClient,
  job: Pick<
    GrowthSequenceExecutionJob,
    "id" | "leadId" | "sequenceEnrollmentId" | "sequenceStepId" | "attemptCount"
  >,
): Promise<SequenceExecutionPauseGateResult> {
  const gate = await evaluateSequenceExecutionPauseGate(admin, {
    sequenceEnrollmentId: job.sequenceEnrollmentId,
  })
  if (gate.blocked) {
    await blockSequenceExecutionJobForPauseGate(admin, { job, gate })
  }
  return gate
}
