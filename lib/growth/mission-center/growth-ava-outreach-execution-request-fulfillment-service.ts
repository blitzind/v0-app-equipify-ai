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
import { findActiveSequenceExecutionJob } from "@/lib/growth/sequences/execution/sequence-job-repository"
import { queueSequenceStepTransportJob } from "@/lib/growth/sequences/execution/queue-sequence-step-transport-job"
import type {
  GrowthAvaOutreachExecutionRequest,
  GrowthAvaOutreachExecutionRequestChannel,
} from "@/lib/growth/mission-center/growth-ava-outreach-execution-request-types"
import { GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER } from "@/lib/growth/mission-center/growth-ava-outreach-execution-request-types"

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
  steps: Awaited<ReturnType<typeof createGrowthSequenceEnrollmentDraft>>["steps"],
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

export async function fulfillAvaOutreachExecutionRequestViaSequence(
  admin: SupabaseClient,
  input: {
    request: GrowthAvaOutreachExecutionRequest
    actingUserId: string
    actingUserEmail: string
  },
): Promise<GrowthAvaOutreachExecutionRequest> {
  const channel = normalizeRecommendedChannel(input.request.recommendedChannel)

  if (MANUAL_CHANNELS.has(channel)) {
    return {
      ...input.request,
      executionStatus: "awaiting_manual_channel",
      fulfillmentError: null,
      fulfilledAt: new Date().toISOString(),
    }
  }

  if (!TRANSPORT_CHANNELS.has(channel)) {
    return {
      ...input.request,
      executionStatus: "failed",
      fulfillmentError: "unsupported_recommended_channel",
      fulfilledAt: new Date().toISOString(),
    }
  }

  try {
    const draft = await createGrowthSequenceEnrollmentDraft(admin, {
      leadId: input.request.leadId,
      actingUserId: input.actingUserId,
      actingUserEmail: input.actingUserEmail,
    })

    const step = resolveFirstMatchingStep(draft.steps, channel)
    if (!step) {
      return {
        ...input.request,
        executionStatus: "failed",
        sequenceEnrollmentId: draft.id,
        fulfillmentError: "sequence_step_not_found_for_channel",
        fulfilledAt: new Date().toISOString(),
      }
    }

    const now = new Date().toISOString()
    await updateGrowthSequenceEnrollment(admin, draft.id, {
      status: "active",
      startedAt: now,
      ownerUserId: input.actingUserId,
      pauseReason: null,
    })
    await setLeadActiveSequenceEnrollment(admin, input.request.leadId, draft.id)

    const existingJob = await findActiveSequenceExecutionJob(admin, {
      sequenceEnrollmentId: draft.id,
      sequenceStepId: step.id,
    })
    if (existingJob) {
      return {
        ...input.request,
        executionStatus: "queued",
        sequenceEnrollmentId: draft.id,
        sequenceStepId: step.id,
        sequenceJobId: existingJob.id,
        fulfillmentError: null,
        fulfilledAt: now,
      }
    }

    const queued = await queueSequenceStepTransportJob(admin, {
      step,
      enrollmentId: draft.id,
      actingUserId: input.actingUserId,
      actingUserEmail: input.actingUserEmail,
      dryRun: false,
    })

    if (!queued.queued || !queued.jobId) {
      return {
        ...input.request,
        executionStatus: "failed",
        sequenceEnrollmentId: draft.id,
        sequenceStepId: step.id,
        fulfillmentError: queued.reason ?? "sequence_job_queue_failed",
        fulfilledAt: new Date().toISOString(),
      }
    }

    logGrowthEngine("ava_outreach_execution_request_fulfilled", {
      qa_marker: GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_1_QA_MARKER,
      request_id: input.request.requestId,
      package_id: input.request.packageId,
      lead_id: input.request.leadId,
      sequence_job_id: queued.jobId,
      channel,
    })

    return {
      ...input.request,
      executionStatus: "queued",
      sequenceEnrollmentId: draft.id,
      sequenceStepId: step.id,
      sequenceJobId: queued.jobId,
      fulfillmentError: null,
      fulfilledAt: new Date().toISOString(),
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return {
      ...input.request,
      executionStatus: "failed",
      fulfillmentError: detail.slice(0, 500),
      fulfilledAt: new Date().toISOString(),
    }
  }
}

export { normalizeRecommendedChannel }
