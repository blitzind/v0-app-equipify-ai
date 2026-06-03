import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthAiCopilotGenerationById } from "@/lib/growth/ai-copilot-repository"
import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { runGrowthOutreachPreflight } from "@/lib/growth/outreach/outreach-preflight"
import { fetchGrowthOutreachQueueByEnrollmentStepId } from "@/lib/growth/outreach/outreach-queue-repository"
import { runGrowthAiCopilotGeneration } from "@/lib/growth/run-ai-copilot-generation"
import { getGrowthAiProvider } from "@/lib/growth/ai-copilot-provider"
import type { GrowthSequenceSchedulerStepFailure } from "@/lib/growth/sequence-enrollment/scheduler-step-failure-types"
import {
  normalizeGrowthSchedulerAiGenerationFailureCode,
} from "@/lib/growth/sequence-enrollment/scheduler-step-failure-types"
import {
  updateGrowthSequenceEnrollmentStep,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import { computeStepExecutionConfidence } from "@/lib/growth/sequence-enrollment/sequence-enrollment-health"
import { buildSequenceSchedulerIdempotencyKey } from "@/lib/growth/sequence-enrollment/sequence-scheduler-types"
import type { GrowthSequenceEnrollmentStep } from "@/lib/growth/sequence-enrollment-types"
import { createCadenceTaskFromEnrollmentStep } from "@/lib/growth/cadence/materialize-cadence-step"
import { isCadenceEmailChannel } from "@/lib/growth/cadence/cadence-channel-engine"
import { fetchGrowthCadenceTaskByEnrollmentStepId } from "@/lib/growth/cadence/cadence-task-repository"
import {
  emitGrowthApprovalRequiredNotification,
} from "@/lib/growth/notifications/notification-integrations"
import {
  recordSequenceExecutionJobAuditEvent,
  recordSequenceExecutionTimelineEvent,
} from "@/lib/growth/sequences/execution/sequence-execution-events"
import {
  createSequenceExecutionJob,
  findActiveSequenceExecutionJob,
} from "@/lib/growth/sequences/execution/sequence-job-repository"
import { resolveSequenceExecutionSender } from "@/lib/growth/sequences/execution/sequence-send-builder"
import { emitGrowthLeadSequenceStepQueuedTimeline } from "@/lib/growth/timeline-emitter"
import {
  evaluateGrowthQaDeliverabilityBypass,
  serializeGrowthQaDeliverabilityBypassSnapshot,
} from "@/lib/growth/sequence-enrollment/qa-deliverability-bypass"
import {
  evaluateGrowthOutboundTransportReadiness,
} from "@/lib/growth/runtime/outbound-transport-readiness"
import type { GrowthOutboundTransportBlockReason } from "@/lib/growth/runtime/outbound-transport-readiness-types"

export type QueueSequenceStepTransportJobResult = {
  queued: boolean
  reason?:
    | "already_queued"
    | "lead_not_found"
    | "missing_draft"
    | "preflight_blocked"
    | "no_sender_route"
    | GrowthOutboundTransportBlockReason
    | "cadence_task_failed"
    | string
  jobId?: string
  failure?: GrowthSequenceSchedulerStepFailure
}

function buildQueueStepFailure(input: {
  enrollmentId: string
  step: GrowthSequenceEnrollmentStep
  leadId: string
  generationType?: string | null
  code: string
  message: string
  phase: GrowthSequenceSchedulerStepFailure["phase"]
  providerHealth?: GrowthSequenceSchedulerStepFailure["providerHealth"]
}): GrowthSequenceSchedulerStepFailure {
  const normalizedCode = normalizeGrowthSchedulerAiGenerationFailureCode({
    code: input.code,
    message: input.message,
  })
  return {
    enrollmentId: input.enrollmentId,
    stepId: input.step.id,
    leadId: input.leadId,
    generationType: input.generationType ?? null,
    code: normalizedCode,
    message: input.message,
    phase: input.phase,
    providerHealth: input.providerHealth ?? null,
  }
}

export async function queueSequenceStepTransportJob(
  admin: SupabaseClient,
  input: {
    step: GrowthSequenceEnrollmentStep
    enrollmentId: string
    actingUserId: string
    actingUserEmail: string
    dryRun: boolean
  },
): Promise<QueueSequenceStepTransportJobResult> {
  const idempotencyKey = buildSequenceSchedulerIdempotencyKey(input.enrollmentId, input.step.id)

  const [existingQueue, existingTask, existingJob] = await Promise.all([
    fetchGrowthOutreachQueueByEnrollmentStepId(admin, input.step.id),
    fetchGrowthCadenceTaskByEnrollmentStepId(admin, input.step.id),
    findActiveSequenceExecutionJob(admin, {
      sequenceEnrollmentId: input.enrollmentId,
      sequenceStepId: input.step.id,
    }),
  ])

  if (
    existingQueue ||
    input.step.outreachQueueId ||
    existingTask ||
    input.step.cadenceTaskId ||
    existingJob
  ) {
    logGrowthEngine("sequence_scheduler_transport_job_skipped", {
      stepId: input.step.id,
      enrollmentId: input.enrollmentId,
      reason: "already_queued",
      idempotencyKey,
      hadOutreachQueue: Boolean(existingQueue || input.step.outreachQueueId),
      hadExecutionJob: Boolean(existingJob),
    })
    return { queued: false, reason: "already_queued", jobId: existingJob?.id }
  }

  const lead = await fetchGrowthLeadById(admin, input.step.leadId)
  if (!lead) return { queued: false, reason: "lead_not_found" }

  if (input.dryRun) return { queued: true }

  if (!isCadenceEmailChannel(input.step.channel)) {
    const result = await createCadenceTaskFromEnrollmentStep(admin, {
      step: input.step,
      enrollmentId: input.enrollmentId,
      actingUserId: input.actingUserId,
      idempotencyKey,
    })
    if (!result.task) return { queued: false, reason: result.reason ?? "cadence_task_failed" }
    return { queued: true }
  }

  const transportReadiness = await evaluateGrowthOutboundTransportReadiness(admin)
  if (!transportReadiness.ready) {
    const reason = transportReadiness.blockReason ?? "provider_disconnected"
    logGrowthEngine("sequence_scheduler_transport_job_skipped", {
      stepId: input.step.id,
      enrollmentId: input.enrollmentId,
      reason,
      blockReason: transportReadiness.blockReason,
      idempotencyKey,
    })
    return { queued: false, reason }
  }

  let generationId = input.step.generationId
  let generation = generationId ? await fetchGrowthAiCopilotGenerationById(admin, generationId) : null

  if (input.step.channel === "email" && input.step.status === "pending") {
    const generationType = (input.step.generationType ?? "follow_up_email") as GrowthAiCopilotGenerationType
    const provider = getGrowthAiProvider()
    const providerHealth = await provider.health()

    let generationResult: Awaited<ReturnType<typeof runGrowthAiCopilotGeneration>>
    try {
      generationResult = await runGrowthAiCopilotGeneration({
        admin,
        leadId: lead.id,
        generationType,
        actingUserId: input.actingUserId,
        actingUserEmail: input.actingUserEmail,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const code = /personalization/i.test(message) ? "personalization_failed" : "unknown_generation_error"
      const failure = buildQueueStepFailure({
        enrollmentId: input.enrollmentId,
        step: input.step,
        leadId: lead.id,
        generationType,
        code,
        message,
        phase: "ai_generation",
        providerHealth,
      })
      logGrowthEngine("sequence_scheduler_ai_generation_failed", {
        ...failure,
        reason: failure.code,
        providerId: provider.id,
        providerHealth,
        idempotencyKey,
        exception: message,
      })
      return { queued: false, reason: failure.code, failure }
    }

    if (!generationResult.ok) {
      const failure = buildQueueStepFailure({
        enrollmentId: input.enrollmentId,
        step: input.step,
        leadId: lead.id,
        generationType,
        code: generationResult.code,
        message: generationResult.message,
        phase: "ai_generation",
        providerHealth,
      })
      logGrowthEngine("sequence_scheduler_ai_generation_failed", {
        ...failure,
        reason: failure.code,
        providerId: provider.id,
        providerHealth,
        idempotencyKey,
      })
      return { queued: false, reason: failure.code, failure }
    }

    generation = generationResult.generation
    generationId = generationResult.generation.id
    await updateGrowthSequenceEnrollmentStep(admin, input.step.id, {
      status: "draft_created",
      generationId: generationResult.generation.id,
      stepExecutionConfidence: computeStepExecutionConfidence({ lead, channel: input.step.channel }),
    })
  }

  if (input.step.channel === "email" && !generation) {
    return { queued: false, reason: "missing_draft" }
  }

  const preflight = await runGrowthOutreachPreflight(admin, {
    lead,
    channel: input.step.channel === "email" ? "email" : input.step.channel,
    toEmail: lead.contactEmail,
    generationType: null,
    generationApproved: true,
    actingUserEmail: input.actingUserEmail,
    actingUserId: input.actingUserId,
    enrollmentId: input.enrollmentId,
  })
  if (!preflight.allowed) {
    const code = preflight.code ?? "preflight_blocked"
    return {
      queued: false,
      reason: code,
      failure: buildQueueStepFailure({
        enrollmentId: input.enrollmentId,
        step: input.step,
        leadId: lead.id,
        generationType: input.step.generationType,
        code,
        message: preflight.reason ?? "Outreach preflight blocked queueing.",
        phase: "queue_preflight",
      }),
    }
  }

  const sender = await resolveSequenceExecutionSender(admin)
  if (!sender) {
    logGrowthEngine("sequence_scheduler_transport_job_skipped", {
      stepId: input.step.id,
      enrollmentId: input.enrollmentId,
      reason: "no_sender_route",
      idempotencyKey,
    })
    return { queued: false, reason: "no_sender_route" }
  }

  const scheduledFor = input.step.scheduledFor ?? new Date().toISOString()
  const job = await createSequenceExecutionJob(admin, {
    sequenceEnrollmentId: input.enrollmentId,
    sequenceStepId: input.step.id,
    leadId: input.step.leadId,
    scheduledFor,
    status: "pending_approval",
  })

  const qaDeliverabilityBypass = await evaluateGrowthQaDeliverabilityBypass(admin, {
    actingUserEmail: input.actingUserEmail,
    recipientEmail: lead.contactEmail,
    senderAccountId: sender.senderAccountId,
    enrollmentId: input.enrollmentId,
    jobId: job.id,
  })

  await recordSequenceExecutionJobAuditEvent(admin, {
    jobId: job.id,
    eventType: "job_planned",
    title: "Transport execution job planned",
    description: "Due sequence step queued for safe-execution transport — adapter send skipped.",
    metadata: {
      sequence_enrollment_id: input.enrollmentId,
      sequence_step_id: input.step.id,
      scheduler_idempotency_key: idempotencyKey,
      outbound_mode: "standalone",
      sender_account_id: sender.senderAccountId,
      provider_id: sender.providerId,
      generation_id: generationId ?? null,
      acting_user_id: input.actingUserId,
      ...serializeGrowthQaDeliverabilityBypassSnapshot(qaDeliverabilityBypass),
    },
  })

  await updateGrowthSequenceEnrollmentStep(admin, input.step.id, {
    status: "queued",
    generationId: generationId ?? null,
  })

  await recordSequenceExecutionTimelineEvent(admin, {
    leadId: lead.id,
    eventType: "sequence_step_scheduled",
    title: "Sequence step scheduled for transport approval",
    summary: `Step ${input.step.stepOrder} queued for human-approved transport send.`,
    jobId: job.id,
    enrollmentId: input.enrollmentId,
    stepId: input.step.id,
  })

  await emitGrowthLeadSequenceStepQueuedTimeline(admin, {
    leadId: lead.id,
    enrollmentId: input.enrollmentId,
    stepId: input.step.id,
    queueId: job.id,
  })

  await emitGrowthApprovalRequiredNotification(admin, {
    leadId: lead.id,
    queueId: job.id,
    companyName: lead.companyName,
    ownerUserId: lead.assignedTo,
  })

  logGrowthEngine("sequence_scheduler_transport_job_created", {
    stepId: input.step.id,
    enrollmentId: input.enrollmentId,
    jobId: job.id,
    idempotencyKey,
    senderAccountId: sender.senderAccountId,
    generationId: generationId ?? null,
    providerAdapterSkipped: true,
  })

  return { queued: true, jobId: job.id }
}
