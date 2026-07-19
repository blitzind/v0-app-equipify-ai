/** GE-AVA-AUTONOMY-EXECUTION-REQUEST-1 — Fulfill requests via existing sequence execution (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  createGrowthSequenceEnrollmentDraft,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-orchestrator"
import {
  setLeadActiveSequenceEnrollment,
  updateGrowthSequenceEnrollment,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import type { GrowthSequenceEnrollmentStep } from "@/lib/growth/sequence-enrollment-types"
import { findActiveSequenceExecutionJob } from "@/lib/growth/sequences/execution/sequence-job-repository"
import { queueSequenceStepTransportJob } from "@/lib/growth/sequences/execution/queue-sequence-step-transport-job"
import type {
  GrowthAvaOutreachExecutionRequest,
  GrowthAvaOutreachExecutionRequestChannel,
} from "@/lib/growth/mission-center/growth-ava-outreach-execution-request-types"
import { GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER } from "@/lib/growth/mission-center/growth-ava-outreach-execution-request-types"
import {
  formatSupervisedEnrollmentReuseConflict,
  GE_AIOS_SUPERVISED_ENROLLMENT_REUSE_1I_QA_MARKER,
  validateSupervisedExecutionEnrollmentReuse,
} from "@/lib/growth/mission-center/growth-ava-outreach-enrollment-reuse-1i"
import { refreshSupervisedTransportSnapshotForJob } from "@/lib/growth/sequences/execution/growth-transport-authority-job-bind-1c"
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"

const TRANSPORT_CHANNELS = new Set<GrowthAvaOutreachExecutionRequestChannel>(["email", "sms"])

const MANUAL_CHANNELS = new Set<GrowthAvaOutreachExecutionRequestChannel>([
  "linkedin",
  "call",
  "video",
  "voice",
  "marketing",
  "follow_up",
])

function normalizeRecommendedChannel(value: string | null | undefined): GrowthAvaOutreachExecutionRequestChannel {
  const normalized = (value ?? "").trim().toLowerCase()
  if (normalized.includes("sms")) return "sms"
  if (normalized.includes("email")) return "email"
  if (normalized.includes("linkedin")) return "linkedin"
  if (normalized.includes("voice")) return "voice"
  if (normalized.includes("video") || normalized.includes("sendr")) return "video"
  if (normalized.includes("call")) return "call"
  if (normalized.includes("follow")) return "follow_up"
  if (normalized.includes("marketing")) return "marketing"
  return "unknown"
}

function resolveFirstMatchingStep(
  steps: GrowthSequenceEnrollmentStep[],
  channel: GrowthAvaOutreachExecutionRequestChannel,
) {
  if (channel === "sms") {
    return steps.find((step) => step.channel === "sms") ?? null
  }
  if (channel === "email") {
    return steps.find((step) => step.channel === "email") ?? null
  }
  return steps[0] ?? null
}

async function ensureEnrollmentActive(
  admin: SupabaseClient,
  input: {
    enrollmentId: string
    leadId: string
    actingUserId: string
    status: "draft" | "active" | "paused"
  },
): Promise<string> {
  const now = new Date().toISOString()
  if (input.status === "draft") {
    await updateGrowthSequenceEnrollment(admin, input.enrollmentId, {
      status: "active",
      startedAt: now,
      ownerUserId: input.actingUserId,
      pauseReason: null,
    })
  } else if (input.status === "paused") {
    await updateGrowthSequenceEnrollment(admin, input.enrollmentId, {
      status: "active",
      pauseReason: null,
    })
  }
  await setLeadActiveSequenceEnrollment(admin, input.leadId, input.enrollmentId)
  return now
}

async function queueSupervisedTransportJob(
  admin: SupabaseClient,
  input: {
    request: GrowthAvaOutreachExecutionRequest
    enrollmentId: string
    step: GrowthSequenceEnrollmentStep
    actingUserId: string
    actingUserEmail: string
    sequencePatternId: string | null
    channel: GrowthAvaOutreachExecutionRequestChannel
    now: string
    enrollmentReuse: boolean
  },
): Promise<GrowthAvaOutreachExecutionRequest> {
  const existingJob = await findActiveSequenceExecutionJob(admin, {
    sequenceEnrollmentId: input.enrollmentId,
    sequenceStepId: input.step.id,
  })
  if (existingJob) {
    const organizationId = getGrowthEngineAiOrgId()
    if (organizationId) {
      await refreshSupervisedTransportSnapshotForJob(admin, {
        jobId: existingJob.id,
        organizationId,
        packageId: input.request.packageId,
        leadId: input.request.leadId,
        sequencePatternStepId: input.step.id,
        sequencePatternId: input.sequencePatternId,
      }).catch(() => undefined)
    }

    logGrowthEngine("ava_outreach_execution_request_fulfilled", {
      qa_marker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
      handoff_qa_marker: GE_AIOS_SUPERVISED_ENROLLMENT_REUSE_1I_QA_MARKER,
      request_id: input.request.requestId,
      package_id: input.request.packageId,
      lead_id: input.request.leadId,
      sequence_job_id: existingJob.id,
      enrollment_reused: input.enrollmentReuse,
      job_reused: true,
      channel: input.channel,
    })

    return {
      ...input.request,
      sequencePatternId: input.sequencePatternId,
      executionStatus: "queued",
      sequenceEnrollmentId: input.enrollmentId,
      sequenceStepId: input.step.id,
      sequenceJobId: existingJob.id,
      fulfillmentError: null,
      fulfilledAt: input.now,
    }
  }

  const queued = await queueSequenceStepTransportJob(admin, {
    step: input.step,
    enrollmentId: input.enrollmentId,
    actingUserId: input.actingUserId,
    actingUserEmail: input.actingUserEmail,
    dryRun: false,
    supervisedExecutionRequestFulfillment: true,
    executionRequestPackageId: input.request.packageId,
  })

  if (!queued.queued || !queued.jobId) {
    return {
      ...input.request,
      sequencePatternId: input.sequencePatternId,
      executionStatus: "failed",
      sequenceEnrollmentId: input.enrollmentId,
      sequenceStepId: input.step.id,
      fulfillmentError: queued.reason ?? "sequence_job_queue_failed",
      fulfilledAt: new Date().toISOString(),
    }
  }

  logGrowthEngine("ava_outreach_execution_request_fulfilled", {
    qa_marker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
    handoff_qa_marker: GE_AIOS_SUPERVISED_ENROLLMENT_REUSE_1I_QA_MARKER,
    request_id: input.request.requestId,
    package_id: input.request.packageId,
    lead_id: input.request.leadId,
    sequence_job_id: queued.jobId,
    enrollment_reused: input.enrollmentReuse,
    job_reused: false,
    channel: input.channel,
  })

  return {
    ...input.request,
    sequencePatternId: input.sequencePatternId,
    executionStatus: "queued",
    sequenceEnrollmentId: input.enrollmentId,
    sequenceStepId: input.step.id,
    sequenceJobId: queued.jobId,
    fulfillmentError: null,
    fulfilledAt: input.now,
  }
}

export async function fulfillAvaOutreachExecutionRequestViaSequence(
  admin: SupabaseClient,
  input: {
    request: GrowthAvaOutreachExecutionRequest
    actingUserId: string
    actingUserEmail: string
    sequencePatternId?: string | null
  },
): Promise<GrowthAvaOutreachExecutionRequest> {
  const channel = normalizeRecommendedChannel(input.request.recommendedChannel)
  const sequencePatternId = input.sequencePatternId ?? input.request.sequencePatternId ?? null

  if (MANUAL_CHANNELS.has(channel)) {
    return {
      ...input.request,
      sequencePatternId,
      executionStatus: "awaiting_manual_channel",
      fulfillmentError: null,
      fulfilledAt: new Date().toISOString(),
    }
  }

  if (!TRANSPORT_CHANNELS.has(channel)) {
    return {
      ...input.request,
      sequencePatternId,
      executionStatus: "failed",
      fulfillmentError: "unsupported_recommended_channel",
      fulfilledAt: new Date().toISOString(),
    }
  }

  try {
    if (input.request.sequenceEnrollmentId) {
      const reuse = await validateSupervisedExecutionEnrollmentReuse(admin, {
        organizationId: input.request.organizationId,
        leadId: input.request.leadId,
        sequenceEnrollmentId: input.request.sequenceEnrollmentId,
        expectedPatternId: sequencePatternId,
        preferredStepId: input.request.sequenceStepId,
        channel,
      })

      if (!reuse.ok) {
        return {
          ...input.request,
          sequencePatternId,
          executionStatus: "failed",
          sequenceEnrollmentId: input.request.sequenceEnrollmentId,
          sequenceStepId: input.request.sequenceStepId,
          fulfillmentError: formatSupervisedEnrollmentReuseConflict(reuse.conflict),
          fulfilledAt: new Date().toISOString(),
        }
      }

      const now = await ensureEnrollmentActive(admin, {
        enrollmentId: reuse.enrollment.id,
        leadId: input.request.leadId,
        actingUserId: input.actingUserId,
        status: reuse.enrollment.status,
      })

      return queueSupervisedTransportJob(admin, {
        request: input.request,
        enrollmentId: reuse.enrollment.id,
        step: reuse.step,
        actingUserId: input.actingUserId,
        actingUserEmail: input.actingUserEmail,
        sequencePatternId,
        channel,
        now,
        enrollmentReuse: true,
      })
    }

    const draft = await createGrowthSequenceEnrollmentDraft(admin, {
      leadId: input.request.leadId,
      patternId: sequencePatternId,
      actingUserId: input.actingUserId,
      actingUserEmail: input.actingUserEmail,
    })

    const step = resolveFirstMatchingStep(draft.steps, channel)
    if (!step) {
      return {
        ...input.request,
        sequencePatternId,
        executionStatus: "failed",
        sequenceEnrollmentId: draft.id,
        fulfillmentError: "sequence_step_not_found_for_channel",
        fulfilledAt: new Date().toISOString(),
      }
    }

    const now = await ensureEnrollmentActive(admin, {
      enrollmentId: draft.id,
      leadId: input.request.leadId,
      actingUserId: input.actingUserId,
      status: "draft",
    })

    return queueSupervisedTransportJob(admin, {
      request: input.request,
      enrollmentId: draft.id,
      step,
      actingUserId: input.actingUserId,
      actingUserEmail: input.actingUserEmail,
      sequencePatternId,
      channel,
      now,
      enrollmentReuse: false,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    if (detail === "active_enrollment") {
      return {
        ...input.request,
        sequencePatternId,
        executionStatus: "failed",
        fulfillmentError: formatSupervisedEnrollmentReuseConflict({
          qaMarker: GE_AIOS_SUPERVISED_ENROLLMENT_REUSE_1I_QA_MARKER,
          enrollmentId: input.request.sequenceEnrollmentId,
          requestedPatternId: sequencePatternId,
          existingPatternId: null,
          resumabilityStatus: "active_enrollment_conflict",
          blockingReason: "active_enrollment_without_request_binding",
        }),
        fulfilledAt: new Date().toISOString(),
      }
    }

    return {
      ...input.request,
      sequencePatternId,
      executionStatus: "failed",
      fulfillmentError: detail.slice(0, 500),
      fulfilledAt: new Date().toISOString(),
    }
  }
}

export { normalizeRecommendedChannel }
