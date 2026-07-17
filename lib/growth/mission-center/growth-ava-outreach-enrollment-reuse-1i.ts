/** GE-AIOS-SUPERVISED-ENROLLMENT-REUSE-1I — Resume failed supervised execution from request-bound enrollment (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { pickInProgressEnrollmentStep } from "@/lib/growth/sequence-enrollment/enrollment-step-progress"
import {
  fetchGrowthSequenceEnrollmentById,
  listGrowthSequenceEnrollmentSteps,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import type {
  GrowthSequenceEnrollment,
  GrowthSequenceEnrollmentStep,
} from "@/lib/growth/sequence-enrollment-types"
import type { GrowthAvaOutreachExecutionRequestChannel } from "@/lib/growth/mission-center/growth-ava-outreach-execution-request-types"
import {
  GE_AIOS_SUPERVISED_ENROLLMENT_REUSE_1I_QA_MARKER,
  type SupervisedEnrollmentReuseConflict,
} from "@/lib/growth/mission-center/growth-ava-outreach-enrollment-reuse-1i-types"

export {
  GE_AIOS_SUPERVISED_ENROLLMENT_REUSE_1I_QA_MARKER,
  SUPERVISED_ENROLLMENT_REUSE_CONFLICT_PREFIX,
  formatSupervisedEnrollmentReuseConflict,
  type SupervisedEnrollmentReuseConflict,
} from "@/lib/growth/mission-center/growth-ava-outreach-enrollment-reuse-1i-types"

export type SupervisedEnrollmentReuseValidation =
  | {
      ok: true
      enrollment: GrowthSequenceEnrollment
      steps: GrowthSequenceEnrollmentStep[]
      step: GrowthSequenceEnrollmentStep
    }
  | { ok: false; conflict: SupervisedEnrollmentReuseConflict }

const RESUMABLE_ENROLLMENT_STATUSES = new Set<GrowthSequenceEnrollment["status"]>([
  "draft",
  "active",
  "paused",
])

const RESUMABLE_STEP_STATUSES = new Set<GrowthSequenceEnrollmentStep["status"]>([
  "pending",
  "draft_created",
  "queued",
])

function buildConflict(input: {
  enrollmentId?: string | null
  requestedPatternId?: string | null
  existingPatternId?: string | null
  resumabilityStatus?: string
  blockingReason: string
}): SupervisedEnrollmentReuseConflict {
  return {
    qaMarker: GE_AIOS_SUPERVISED_ENROLLMENT_REUSE_1I_QA_MARKER,
    enrollmentId: input.enrollmentId ?? null,
    requestedPatternId: input.requestedPatternId ?? null,
    existingPatternId: input.existingPatternId ?? null,
    resumabilityStatus: input.resumabilityStatus ?? "unknown",
    blockingReason: input.blockingReason,
  }
}

function resolveChannelMatchingStep(
  steps: GrowthSequenceEnrollmentStep[],
  channel: GrowthAvaOutreachExecutionRequestChannel,
): GrowthSequenceEnrollmentStep | null {
  if (channel === "sms") {
    return steps.find((step) => step.channel === "sms") ?? null
  }
  if (channel === "email") {
    return steps.find((step) => step.channel === "email") ?? null
  }
  return steps[0] ?? null
}

export async function validateSupervisedExecutionEnrollmentReuse(
  admin: SupabaseClient,
  input: {
    organizationId: string
    leadId: string
    sequenceEnrollmentId: string
    expectedPatternId: string | null
    preferredStepId?: string | null
    channel: GrowthAvaOutreachExecutionRequestChannel
  },
): Promise<SupervisedEnrollmentReuseValidation> {
  const enrollment = await fetchGrowthSequenceEnrollmentById(admin, input.sequenceEnrollmentId)
  if (!enrollment) {
    return {
      ok: false,
      conflict: buildConflict({
        enrollmentId: input.sequenceEnrollmentId,
        requestedPatternId: input.expectedPatternId,
        resumabilityStatus: "missing",
        blockingReason: "enrollment_not_found",
      }),
    }
  }

  const lead = await fetchGrowthLeadById(admin, input.leadId)
  if (!lead) {
    return {
      ok: false,
      conflict: buildConflict({
        enrollmentId: enrollment.id,
        requestedPatternId: input.expectedPatternId,
        existingPatternId: enrollment.sequencePatternId,
        resumabilityStatus: enrollment.status,
        blockingReason: "lead_not_found",
      }),
    }
  }

  if (enrollment.leadId !== input.leadId) {
    return {
      ok: false,
      conflict: buildConflict({
        enrollmentId: enrollment.id,
        requestedPatternId: input.expectedPatternId,
        existingPatternId: enrollment.sequencePatternId,
        resumabilityStatus: enrollment.status,
        blockingReason: "enrollment_lead_mismatch",
      }),
    }
  }

  if (input.expectedPatternId && enrollment.sequencePatternId !== input.expectedPatternId) {
    return {
      ok: false,
      conflict: buildConflict({
        enrollmentId: enrollment.id,
        requestedPatternId: input.expectedPatternId,
        existingPatternId: enrollment.sequencePatternId,
        resumabilityStatus: enrollment.status,
        blockingReason: "enrollment_pattern_mismatch",
      }),
    }
  }

  if (!RESUMABLE_ENROLLMENT_STATUSES.has(enrollment.status)) {
    return {
      ok: false,
      conflict: buildConflict({
        enrollmentId: enrollment.id,
        requestedPatternId: input.expectedPatternId,
        existingPatternId: enrollment.sequencePatternId,
        resumabilityStatus: enrollment.status,
        blockingReason: "enrollment_not_resumable",
      }),
    }
  }

  const steps = await listGrowthSequenceEnrollmentSteps(admin, enrollment.id)

  let step: GrowthSequenceEnrollmentStep | null = null
  if (input.preferredStepId) {
    step = steps.find((candidate) => candidate.id === input.preferredStepId) ?? null
    if (!step) {
      return {
        ok: false,
        conflict: buildConflict({
          enrollmentId: enrollment.id,
          requestedPatternId: input.expectedPatternId,
          existingPatternId: enrollment.sequencePatternId,
          resumabilityStatus: enrollment.status,
          blockingReason: "enrollment_step_not_found",
        }),
      }
    }
  } else {
    step =
      resolveChannelMatchingStep(steps, input.channel) ??
      pickInProgressEnrollmentStep(steps, enrollment.currentStepOrder)
  }

  if (!step) {
    return {
      ok: false,
      conflict: buildConflict({
        enrollmentId: enrollment.id,
        requestedPatternId: input.expectedPatternId,
        existingPatternId: enrollment.sequencePatternId,
        resumabilityStatus: enrollment.status,
        blockingReason: "sequence_step_not_found_for_channel",
      }),
    }
  }

  if (input.channel === "email" && step.channel !== "email") {
    return {
      ok: false,
      conflict: buildConflict({
        enrollmentId: enrollment.id,
        requestedPatternId: input.expectedPatternId,
        existingPatternId: enrollment.sequencePatternId,
        resumabilityStatus: `${enrollment.status}:${step.status}`,
        blockingReason: "enrollment_step_channel_mismatch",
      }),
    }
  }

  if (input.channel === "sms" && step.channel !== "sms") {
    return {
      ok: false,
      conflict: buildConflict({
        enrollmentId: enrollment.id,
        requestedPatternId: input.expectedPatternId,
        existingPatternId: enrollment.sequencePatternId,
        resumabilityStatus: `${enrollment.status}:${step.status}`,
        blockingReason: "enrollment_step_channel_mismatch",
      }),
    }
  }

  if (!RESUMABLE_STEP_STATUSES.has(step.status)) {
    return {
      ok: false,
      conflict: buildConflict({
        enrollmentId: enrollment.id,
        requestedPatternId: input.expectedPatternId,
        existingPatternId: enrollment.sequencePatternId,
        resumabilityStatus: `${enrollment.status}:${step.status}`,
        blockingReason: "enrollment_step_not_resumable",
      }),
    }
  }

  return { ok: true, enrollment, steps, step }
}
