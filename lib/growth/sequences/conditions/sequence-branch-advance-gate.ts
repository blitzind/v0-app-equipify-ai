import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { SequenceExecutionPauseGateResult } from "@/lib/growth/sequences/attribution/sequence-attribution-types"
import { recordSequenceEnrollmentChannelEvent } from "@/lib/growth/sequence-orchestration/sequence-multi-channel-state-repository"
import type { GrowthSequenceChannelEventKind } from "@/lib/growth/sequence-orchestration/sequence-multi-channel-state-types"
import {
  evaluateSequenceExecutionPauseGate,
} from "@/lib/growth/sequences/execution/sequence-pause-gate"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"
import { emitSequenceOperatorNotificationSafely } from "@/lib/growth/sequences/conditions/sequence-operator-notifications"

export const GROWTH_SEQUENCE_ADVANCEMENT_GATE_QA_MARKER =
  "growth-sequence-advancement-gate-sr3-phase3-safety-v1" as const

export async function evaluateSequenceBranchAdvanceGate(
  admin: SupabaseClient,
  input: { sequenceEnrollmentId: string },
): Promise<SequenceExecutionPauseGateResult> {
  return evaluateSequenceExecutionPauseGate(admin, input)
}

export async function recordSequenceAdvancementBlockedAudit(
  admin: SupabaseClient,
  input: {
    enrollmentId: string
    enrollmentStepId: string
    leadId: string
    stepOrder: number
    gate: SequenceExecutionPauseGateResult
    occurredAt?: string
  },
): Promise<void> {
  const metadata = {
    qa_marker: GROWTH_SEQUENCE_ADVANCEMENT_GATE_QA_MARKER,
    pause_gate_code: input.gate.code,
    pause_gate_reason: input.gate.reason,
    step_order: input.stepOrder,
    blocked_paths: ["branch", "linear", "materialize", "execution_job"],
  }

  await recordSequenceEnrollmentChannelEvent(admin, {
    enrollmentId: input.enrollmentId,
    enrollmentStepId: input.enrollmentStepId,
    leadId: input.leadId,
    channel: "sequence",
    eventKind: "advancement_blocked" as GrowthSequenceChannelEventKind,
    title: "Sequence advancement blocked",
    summary: input.gate.reason ?? input.gate.code ?? "Advancement blocked by pause gate.",
    metadata,
    occurredAt: input.occurredAt,
  })

  await appendGrowthLeadTimelineEvent(admin, {
    leadId: input.leadId,
    eventType: "sequence_step_blocked",
    title: "Sequence advancement blocked",
    summary: input.gate.reason ?? input.gate.code ?? "Advancement blocked by pause gate.",
    payload: {
      ...metadata,
      sequence_enrollment_id: input.enrollmentId,
      sequence_enrollment_step_id: input.enrollmentStepId,
      source: "growth_sequence_advancement_gate",
    },
    occurredAt: input.occurredAt,
  })

  await emitSequenceOperatorNotificationSafely(admin, {
    event: "sequence_advancement_blocked",
    enrollmentId: input.enrollmentId,
    enrollmentStepId: input.enrollmentStepId,
    leadId: input.leadId,
    blockReason: input.gate.reason ?? input.gate.code ?? "Advancement blocked by pause gate.",
    occurredAt: input.occurredAt,
  })
}

export type SequenceAdvancementGateSafetyProbeResult = {
  pausedBlocksAdvancement: boolean
  exitCandidateBlocksAdvancement: boolean
  auditRecorded: boolean
  exitCandidateProbeSkipped: boolean
}

export async function runSequenceAdvancementGateSafetyProbes(
  admin: SupabaseClient,
  input: {
    enrollmentId: string
    enrollmentStepId: string
    leadId: string
    marker: string
  },
): Promise<SequenceAdvancementGateSafetyProbeResult> {
  const {
    fetchGrowthSequenceEnrollmentById,
    fetchGrowthSequenceEnrollmentStepById,
    updateGrowthSequenceEnrollment,
    updateGrowthSequenceEnrollmentStep,
  } = await import("@/lib/growth/sequence-enrollment/sequence-enrollment-repository")
  const { advanceGrowthSequenceEnrollmentAfterStep } = await import(
    "@/lib/growth/sequence-enrollment/sequence-enrollment-orchestrator"
  )

  const actingUserId = "00000000-0000-4000-8000-000000000001"
  const actingUserEmail = "sr3-advancement-gate-cert@equipify.internal"

  async function snapshot() {
    const step = await fetchGrowthSequenceEnrollmentStepById(admin, input.enrollmentStepId)
    const enrollment = await fetchGrowthSequenceEnrollmentById(admin, input.enrollmentId)
    const { count: jobCount } = await admin
      .schema("growth")
      .from("sequence_execution_jobs")
      .select("id", { count: "exact", head: true })
      .eq("sequence_enrollment_id", input.enrollmentId)
    const { count: auditCount } = await admin
      .schema("growth")
      .from("sequence_enrollment_channel_events")
      .select("id", { count: "exact", head: true })
      .eq("enrollment_id", input.enrollmentId)
      .eq("enrollment_step_id", input.enrollmentStepId)
      .eq("event_kind", "advancement_blocked")
    return {
      stepStatus: step?.status ?? null,
      currentStepOrder: enrollment?.currentStepOrder ?? null,
      jobCount: jobCount ?? 0,
      auditCount: auditCount ?? 0,
    }
  }

  await updateGrowthSequenceEnrollment(admin, input.enrollmentId, {
    status: "active",
    pauseReason: null,
  })
  await updateGrowthSequenceEnrollmentStep(admin, input.enrollmentStepId, {
    status: "queued",
    completedAt: null,
  })

  const beforePaused = await snapshot()
  await updateGrowthSequenceEnrollment(admin, input.enrollmentId, {
    status: "paused",
    pauseReason: `${input.marker}-paused`,
  })

  await advanceGrowthSequenceEnrollmentAfterStep(admin, {
    enrollmentStepId: input.enrollmentStepId,
    actingUserId,
    actingUserEmail,
  })

  const afterPaused = await snapshot()
  const pausedBlocksAdvancement =
    afterPaused.stepStatus === beforePaused.stepStatus &&
    afterPaused.currentStepOrder === beforePaused.currentStepOrder &&
    afterPaused.jobCount === beforePaused.jobCount &&
    afterPaused.auditCount > beforePaused.auditCount

  await updateGrowthSequenceEnrollment(admin, input.enrollmentId, {
    status: "active",
    pauseReason: null,
  })
  await updateGrowthSequenceEnrollmentStep(admin, input.enrollmentStepId, {
    status: "queued",
    completedAt: null,
  })

  const beforeExit = await snapshot()
  let exitCandidateEventId: string | null = null

  const { data: threadRow } = await admin
    .schema("growth")
    .from("inbox_threads")
    .select("id")
    .eq("lead_id", input.leadId)
    .limit(1)
    .maybeSingle()

  if (threadRow?.id) {
    const { data: exitEvent, error: exitError } = await admin
      .schema("growth")
      .from("reply_intelligence_events")
      .insert({
        thread_id: threadRow.id,
        severity: "high",
        event_type: "sequence_exit_candidate",
        title: "SR-3 advancement gate cert probe",
        description: input.marker,
        metadata: {
          sequence_enrollment_id: input.enrollmentId,
          cert_marker: input.marker,
          human_review_required: true,
        },
      })
      .select("id")
      .single()

    if (!exitError && exitEvent?.id) {
      exitCandidateEventId = exitEvent.id as string
      await advanceGrowthSequenceEnrollmentAfterStep(admin, {
        enrollmentStepId: input.enrollmentStepId,
        actingUserId,
        actingUserEmail,
      })
    }
  }

  const afterExit = await snapshot()
  const exitCandidateBlocksAdvancement = exitCandidateEventId
    ? afterExit.stepStatus === beforeExit.stepStatus &&
      afterExit.currentStepOrder === beforeExit.currentStepOrder &&
      afterExit.jobCount === beforeExit.jobCount &&
      afterExit.auditCount > beforeExit.auditCount
    : false

  if (exitCandidateEventId) {
    await admin.schema("growth").from("reply_intelligence_events").delete().eq("id", exitCandidateEventId)
  }

  await updateGrowthSequenceEnrollment(admin, input.enrollmentId, {
    status: "draft",
    pauseReason: null,
  })

  return {
    pausedBlocksAdvancement,
    exitCandidateBlocksAdvancement,
    auditRecorded: afterPaused.auditCount > beforePaused.auditCount,
    exitCandidateProbeSkipped: !exitCandidateEventId,
  }
}
