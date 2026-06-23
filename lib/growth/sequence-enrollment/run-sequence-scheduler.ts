import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine, getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { fetchGrowthAiCopilotGenerationById } from "@/lib/growth/ai-copilot-repository"
import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"
import { fetchGrowthPlatformCommunicationSettings } from "@/lib/growth/communication/settings-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import {
  computeOutreachExecutionConfidence,
  deriveOutreachQueuePriority,
} from "@/lib/growth/outreach/outreach-analytics"
import { runGrowthOutreachPreflight } from "@/lib/growth/outreach/outreach-preflight"
import {
  fetchGrowthOutreachQueueByEnrollmentStepId,
  insertGrowthOutreachQueueEvent,
  insertGrowthOutreachQueueItem,
} from "@/lib/growth/outreach/outreach-queue-repository"
import type { GrowthOutreachQueuePayloadSnapshot } from "@/lib/growth/outreach/outreach-queue-types"
import { fetchGrowthOutreachSettings } from "@/lib/growth/outreach/outreach-settings-repository"
import { resolveScheduledFor } from "@/lib/growth/outreach/outreach-scheduling"
import { runGrowthAiCopilotGeneration } from "@/lib/growth/run-ai-copilot-generation"
import {
  enrollmentHasPriorIncompleteSteps,
  isDraftReadyTransportSchedulerStep,
  isDraftReadyEmailSchedulerStep,
} from "@/lib/growth/sequence-enrollment/enrollment-step-progress"
import {
  fetchGrowthSequenceEnrollmentById,
  listGrowthSequenceEnrollmentSteps,
  updateGrowthSequenceEnrollment,
  updateGrowthSequenceEnrollmentStep,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import {
  computeStepExecutionConfidence,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-health"
import {
  countDueSequenceSchedulerSteps,
  fetchLatestGrowthSequenceSchedulerRun,
  insertGrowthSequenceSchedulerRun,
  listDueSequenceSchedulerSteps,
} from "@/lib/growth/sequence-enrollment/sequence-scheduler-repository"
import {
  buildSequenceSchedulerIdempotencyKey,
  GROWTH_SEQUENCE_SCHEDULER_CRON_ROUTE,
  GROWTH_SEQUENCE_SCHEDULER_DEFAULT_BATCH_SIZE,
  GROWTH_SEQUENCE_SCHEDULER_QA_MARKER,
  type GrowthSequenceSchedulerRunResult,
  type GrowthSequenceSchedulerStatus,
} from "@/lib/growth/sequence-enrollment/sequence-scheduler-types"
import type { GrowthSequenceSchedulerStepFailure } from "@/lib/growth/sequence-enrollment/scheduler-step-failure-types"
import type { GrowthSequenceEnrollmentStep } from "@/lib/growth/sequence-enrollment-types"
import {
  emitGrowthLeadSequenceStepDueTimeline,
  emitGrowthLeadSequenceStepQueuedTimeline,
  emitGrowthLeadSequenceStepSkippedTimeline,
} from "@/lib/growth/timeline-emitter"
import { createCadenceTaskFromEnrollmentStep } from "@/lib/growth/cadence/materialize-cadence-step"
import { isSequenceTransportChannel } from "@/lib/growth/cadence/cadence-channel-engine"
import { normalizeSequenceStepChannel } from "@/lib/growth/sequence-orchestration/sequence-channel-routing"
import {
  evaluateSequenceChannelSelectionRules,
  shouldPauseEnrollmentByChannelRules,
  shouldSkipStepByChannelRules,
} from "@/lib/growth/sequence-orchestration/sequence-channel-selection-rules"
import { evaluateSequenceVoiceDropFatigueGate } from "@/lib/growth/sequence-orchestration/sequence-voice-drop-fatigue"
import { recordSequenceEnrollmentChannelEvent } from "@/lib/growth/sequence-orchestration/sequence-multi-channel-state-repository"
import { fetchGrowthSequenceTouchTimeline } from "@/lib/growth/sequence-pattern-repository"
import { fetchGrowthCadenceTaskByEnrollmentStepId } from "@/lib/growth/cadence/cadence-task-repository"
import {
  emitGrowthApprovalRequiredNotification,
  emitGrowthSequenceFailedNotification,
  emitGrowthSuppressionBlockedNotification,
} from "@/lib/growth/notifications/notification-integrations"
import {
  getGrowthOutboundMode,
  growthOutboundModeLabel,
  isGrowthOutboundStandaloneMode,
} from "@/lib/growth/runtime/outbound-mode"
import { isAdapterOutboundExecutionEnabled } from "@/lib/growth/runtime/outbound-cutover"
import {
  isGrowthOutboundTransportConfigured,
  isGrowthOutboundTransportBlockReason,
} from "@/lib/growth/runtime/outbound-transport-readiness"
import { findActiveSequenceExecutionJob } from "@/lib/growth/sequences/execution/sequence-job-repository"
import { queueSequenceStepTransportJob } from "@/lib/growth/sequences/execution/queue-sequence-step-transport-job"

function buildQueuePayloadFromGeneration(input: {
  generation: {
    generatedContent: string
    generatedSubject: string | null
    generationType: string
    promptVersion: string
    promptVariant: string
    inputHash: string | null
    classification?: Record<string, unknown>
  }
  leadEmail: string | null
  stepOrder: number
  idempotencyKey: string
}): GrowthOutreachQueuePayloadSnapshot {
  const personalization = input.generation.classification?.personalization as
    | { variationKey?: string; strategyVersion?: string; confidenceScore?: number }
    | undefined
  return {
    subject: input.generation.generatedSubject,
    body: input.generation.generatedContent,
    toEmail: input.leadEmail,
    generationType: input.generation.generationType,
    promptVersion: input.generation.promptVersion,
    promptVariant: input.generation.promptVariant,
    inputHash: input.generation.inputHash,
    sequenceStep: input.stepOrder,
    variantKey: personalization?.variationKey ?? null,
    personalizationStrategyVersion: personalization?.strategyVersion ?? input.generation.promptVersion,
    personalizationConfidence: personalization?.confidenceScore ?? null,
    schedulerIdempotencyKey: input.idempotencyKey,
  }
}

async function skipSequenceStep(
  admin: SupabaseClient,
  input: {
    step: GrowthSequenceEnrollmentStep
    enrollmentId: string
    reason: string
    actingUserId: string
    actingUserEmail: string
    dryRun: boolean
  },
): Promise<void> {
  if (input.dryRun) return
  await updateGrowthSequenceEnrollmentStep(admin, input.step.id, {
    status: "skipped",
    completedAt: new Date().toISOString(),
    failureReason: input.reason,
  })
  await emitGrowthLeadSequenceStepSkippedTimeline(admin, {
    leadId: input.step.leadId,
    enrollmentId: input.enrollmentId,
    stepId: input.step.id,
    reason: input.reason,
    actor: { userId: input.actingUserId, email: input.actingUserEmail },
  })
  if (input.reason.toLowerCase().includes("suppress")) {
    const lead = await fetchGrowthLeadById(admin, input.step.leadId)
    if (lead) {
      await emitGrowthSuppressionBlockedNotification(admin, {
        leadId: lead.id,
        companyName: lead.companyName,
        ownerUserId: lead.assignedTo,
      })
    }
  }
}

async function queueSequenceStepOutreach(
  admin: SupabaseClient,
  input: {
    step: GrowthSequenceEnrollmentStep
    enrollmentId: string
    sequencePatternId: string
    actingUserId: string
    actingUserEmail: string
    dryRun: boolean
    providerConnectionId: string | null
  },
): Promise<{ queued: boolean; reason?: string }> {
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
    if (existingJob) {
      logGrowthEngine("sequence_scheduler_adapter_path_skipped", {
        stepId: input.step.id,
        enrollmentId: input.enrollmentId,
        reason: "active_transport_job_exists",
        jobId: existingJob.id,
        idempotencyKey,
      })
    }
    return { queued: false, reason: "already_queued" }
  }

  const lead = await fetchGrowthLeadById(admin, input.step.leadId)
  if (!lead) return { queued: false, reason: "lead_not_found" }

  if (input.dryRun) return { queued: true }

  if (input.step.channel === "sms") {
    return queueSequenceStepTransportJob(admin, {
      step: input.step,
      enrollmentId: input.enrollmentId,
      actingUserId: input.actingUserId,
      actingUserEmail: input.actingUserEmail,
      dryRun: input.dryRun,
    })
  }

  if (!isSequenceTransportChannel(input.step.channel)) {
    const cadenceStep = { ...input.step, channel: normalizeSequenceStepChannel(input.step.channel) }
    const result = await createCadenceTaskFromEnrollmentStep(admin, {
      step: cadenceStep,
      enrollmentId: input.enrollmentId,
      actingUserId: input.actingUserId,
      idempotencyKey,
    })
    if (!result.task) return { queued: false, reason: result.reason ?? "cadence_task_failed" }
    return { queued: true }
  }

  let generationId = input.step.generationId
  let generation = generationId ? await fetchGrowthAiCopilotGenerationById(admin, generationId) : null

  if (input.step.channel === "email" && input.step.status === "pending") {
    const generationType = (input.step.generationType ?? "follow_up_email") as GrowthAiCopilotGenerationType
    const result = await runGrowthAiCopilotGeneration({
      admin,
      leadId: lead.id,
      generationType,
      actingUserId: input.actingUserId,
      actingUserEmail: input.actingUserEmail,
      sequencePatternStepId: input.step.sequencePatternStepId,
      sequencePatternId: input.sequencePatternId,
      organizationId: getGrowthEngineAiOrgId(),
    })
    if (!result.ok) return { queued: false, reason: result.code }
    generation = result.generation
    generationId = result.generation.id
    await updateGrowthSequenceEnrollmentStep(admin, input.step.id, {
      status: "draft_created",
      generationId: result.generation.id,
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
  })
  if (!preflight.allowed) {
    return { queued: false, reason: preflight.code ?? "preflight_blocked" }
  }

  const payload =
    input.step.channel === "email" && generation
      ? buildQueuePayloadFromGeneration({
          generation,
          leadEmail: lead.contactEmail,
          stepOrder: input.step.stepOrder,
          idempotencyKey,
        })
      : ({
          generationType: input.step.generationType,
          sequenceStep: input.step.stepOrder,
          schedulerIdempotencyKey: idempotencyKey,
        } satisfies GrowthOutreachQueuePayloadSnapshot)

  const queueItem = await insertGrowthOutreachQueueItem(admin, {
    leadId: lead.id,
    generationId: generation?.status === "approved" ? generationId : generationId,
    channel: input.step.channel === "email" ? "email" : input.step.channel,
    status: "pending_approval",
    priority: deriveOutreachQueuePriority({
      callPriorityTier: lead.callPriorityTier,
      executivePriorityTier: lead.executivePriorityTier,
    }),
    executionConfidence: computeOutreachExecutionConfidence({
      leadScore: lead.score,
      engagementScore: lead.engagementScore,
      capacityTier: lead.operationalCapacityTier,
      channel: input.step.channel === "email" ? "email" : input.step.channel,
    }),
    providerConnectionId: input.providerConnectionId,
    payloadSnapshot: payload,
    createdBy: lead.assignedTo ?? input.actingUserId,
    sequencePatternId: input.sequencePatternId,
    sequenceEnrollmentStepId: input.step.id,
  })

  await updateGrowthSequenceEnrollmentStep(admin, input.step.id, {
    status: "queued",
    outreachQueueId: queueItem.id,
    generationId: generationId ?? null,
  })

  await insertGrowthOutreachQueueEvent(admin, {
    queueId: queueItem.id,
    eventType: "queued",
    actorUserId: input.actingUserId,
    metadata: {
      sequenceEnrollmentId: input.enrollmentId,
      sequenceStepId: input.step.id,
      schedulerIdempotencyKey: idempotencyKey,
      ownerUserId: lead.assignedTo,
    },
  })

  await emitGrowthLeadSequenceStepQueuedTimeline(admin, {
    leadId: lead.id,
    enrollmentId: input.enrollmentId,
    stepId: input.step.id,
    queueId: queueItem.id,
  })

  await emitGrowthApprovalRequiredNotification(admin, {
    leadId: lead.id,
    queueId: queueItem.id,
    companyName: lead.companyName,
    ownerUserId: lead.assignedTo,
  })

  return { queued: true }
}

export async function runGrowthSequenceScheduler(
  admin: SupabaseClient,
  input: {
    actingUserId: string
    actingUserEmail: string
    limit?: number
    dryRun?: boolean
  },
): Promise<GrowthSequenceSchedulerRunResult> {
  const limit = input.limit ?? GROWTH_SEQUENCE_SCHEDULER_DEFAULT_BATCH_SIZE
  const dryRun = input.dryRun === true
  const outboundMode = getGrowthOutboundMode()
  const standaloneMode = isGrowthOutboundStandaloneMode()
  const adapterSchedulingEnabled = isAdapterOutboundExecutionEnabled()
  const commSettings = await fetchGrowthPlatformCommunicationSettings(admin)
  const transportConfigured = await isGrowthOutboundTransportConfigured(admin)
  const providerWarning = adapterSchedulingEnabled
    ? !commSettings.activeEmailConnectionId
    : !transportConfigured

  logGrowthEngine("sequence_scheduler_outbound_mode", {
    outboundMode,
    outboundModeLabel: growthOutboundModeLabel(outboundMode),
    standaloneMode,
    adapterSchedulingEnabled,
    transportConfigured,
    adapterProviderConfigured: Boolean(commSettings.activeEmailConnectionId),
    providerWarning,
  })

  const dueSteps = await listDueSequenceSchedulerSteps(admin, limit)
  const scanned = dueSteps.length

  const counts = {
    due: 0,
    queued: 0,
    executionJobsPlanned: 0,
    skippedSuppressed: 0,
    skippedAlreadyQueued: 0,
    skippedMissingDraft: 0,
    skippedTransportNotConfigured: 0,
    skippedNoSender: 0,
    failed: 0,
  }
  const stepFailures: GrowthSequenceSchedulerStepFailure[] = []

  const outreachSettings = await fetchGrowthOutreachSettings(admin)

  for (const step of dueSteps) {
    try {
      const enrollment = await fetchGrowthSequenceEnrollmentById(admin, step.enrollmentId)
      if (!enrollment || enrollment.status !== "active") continue

      const enrollmentSteps = await listGrowthSequenceEnrollmentSteps(admin, enrollment.id)
      if (enrollmentHasPriorIncompleteSteps(enrollmentSteps, step)) {
        logGrowthEngine("sequence_scheduler_step_skipped_prior_incomplete", {
          stepId: step.id,
          enrollmentId: enrollment.id,
          stepOrder: step.stepOrder,
        })
        continue
      }

      if (step.scheduledFor && Date.parse(step.scheduledFor) > Date.now()) continue

      const qaBypassBusinessHours =
        enrollment.metadata?.qaAcceleration &&
        typeof enrollment.metadata.qaAcceleration === "object" &&
        (enrollment.metadata.qaAcceleration as { bypassBusinessHoursStepId?: string }).bypassBusinessHoursStepId ===
          step.id
      const draftReadyForExecutionJob = isDraftReadyTransportSchedulerStep(step)

      const scheduled = resolveScheduledFor({
        sendNow: true,
        scheduledFor: step.scheduledFor,
        respectBusinessHours: !qaBypassBusinessHours && !draftReadyForExecutionJob,
        timezone: outreachSettings.timezone,
        startMinutes: outreachSettings.businessHoursStartMinutes,
        endMinutes: outreachSettings.businessHoursEndMinutes,
      })
      if (scheduled.scheduledFor && Date.parse(scheduled.scheduledFor) > Date.now()) {
        continue
      }

      counts.due += 1

      const lead = await fetchGrowthLeadById(admin, step.leadId)
      if (!lead) {
        counts.failed += 1
        continue
      }

      if (lead.sequenceFatigueRisk === "high") {
        counts.failed += 1
        if (!dryRun) {
          await skipSequenceStep(admin, {
            step,
            enrollmentId: enrollment.id,
            reason: "Sequence fatigue risk is high.",
            actingUserId: input.actingUserId,
            actingUserEmail: input.actingUserEmail,
            dryRun,
          })
        }
        continue
      }

      const touches = await fetchGrowthSequenceTouchTimeline(admin, lead)
      const channelDecision = evaluateSequenceChannelSelectionRules({
        steps: enrollmentSteps,
        currentStep: step,
        touches,
      })
      if (shouldPauseEnrollmentByChannelRules(channelDecision) && !dryRun) {
        await updateGrowthSequenceEnrollment(admin, enrollment.id, {
          status: "paused",
          pauseReason: channelDecision.reason,
        })
        await recordSequenceEnrollmentChannelEvent(admin, {
          enrollmentId: enrollment.id,
          enrollmentStepId: step.id,
          leadId: lead.id,
          channel: step.channel,
          eventKind: "channel_rule_applied",
          title: "Sequence paused by channel rule",
          summary: channelDecision.reason,
          metadata: { rule_code: channelDecision.ruleCode },
        }).catch(() => undefined)
        counts.skippedSuppressed += 1
        continue
      }

      if (shouldSkipStepByChannelRules(channelDecision) && !dryRun) {
        await skipSequenceStep(admin, {
          step,
          enrollmentId: enrollment.id,
          reason: channelDecision.reason,
          actingUserId: input.actingUserId,
          actingUserEmail: input.actingUserEmail,
          dryRun,
        })
        await recordSequenceEnrollmentChannelEvent(admin, {
          enrollmentId: enrollment.id,
          enrollmentStepId: step.id,
          leadId: lead.id,
          channel: step.channel,
          eventKind: "channel_rule_applied",
          title: "Sequence step skipped by channel rule",
          summary: channelDecision.reason,
          metadata: { rule_code: channelDecision.ruleCode },
        }).catch(() => undefined)
        counts.skippedSuppressed += 1
        continue
      }

      if (step.channel === "voice_drop" && lead.promotedOrganizationId && !dryRun) {
        const fatigue = await evaluateSequenceVoiceDropFatigueGate(admin, {
          organizationId: lead.promotedOrganizationId,
          phoneNumber: lead.contactPhone,
          touches,
        })
        if (!fatigue.allowed) {
          await skipSequenceStep(admin, {
            step,
            enrollmentId: enrollment.id,
            reason: fatigue.message,
            actingUserId: input.actingUserId,
            actingUserEmail: input.actingUserEmail,
            dryRun,
          })
          counts.skippedSuppressed += 1
          continue
        }
      }

      const preflight = await runGrowthOutreachPreflight(admin, {
        lead,
        channel: step.channel === "email" ? "email" : step.channel,
        toEmail: lead.contactEmail,
        generationType: null,
        generationApproved: true,
        actingUserEmail: input.actingUserEmail,
        actingUserId: input.actingUserId,
        enrollmentId: enrollment.id,
      })

      if (!preflight.allowed) {
        if (preflight.code === "suppressed") {
          counts.skippedSuppressed += 1
          await skipSequenceStep(admin, {
            step,
            enrollmentId: enrollment.id,
            reason: "Lead email is suppressed.",
            actingUserId: input.actingUserId,
            actingUserEmail: input.actingUserEmail,
            dryRun,
          })
        } else if (preflight.code === "capacity_blocked") {
          counts.failed += 1
          stepFailures.push({
            enrollmentId: enrollment.id,
            stepId: step.id,
            leadId: step.leadId,
            generationType: step.generationType,
            code: preflight.code,
            message: preflight.reason ?? "Operational capacity blocked outreach.",
            phase: "scheduler_preflight",
          })
        } else {
          counts.failed += 1
          stepFailures.push({
            enrollmentId: enrollment.id,
            stepId: step.id,
            leadId: step.leadId,
            generationType: step.generationType,
            code: preflight.code ?? "preflight_blocked",
            message: preflight.reason ?? "Outreach preflight blocked scheduling.",
            phase: "scheduler_preflight",
          })
        }
        continue
      }

      if (!dryRun) {
        await emitGrowthLeadSequenceStepDueTimeline(admin, {
          leadId: step.leadId,
          enrollmentId: enrollment.id,
          stepId: step.id,
          stepOrder: step.stepOrder,
        })
      }

      const result = adapterSchedulingEnabled
        ? await queueSequenceStepOutreach(admin, {
            step,
            enrollmentId: enrollment.id,
            sequencePatternId: enrollment.sequencePatternId,
            actingUserId: input.actingUserId,
            actingUserEmail: input.actingUserEmail,
            dryRun,
            providerConnectionId: commSettings.activeEmailConnectionId,
          })
        : await queueSequenceStepTransportJob(admin, {
            step,
            enrollmentId: enrollment.id,
            actingUserId: input.actingUserId,
            actingUserEmail: input.actingUserEmail,
            dryRun,
          })

      if (result.reason === "already_queued") {
        counts.skippedAlreadyQueued += 1
        continue
      }
      if (result.reason === "missing_draft") {
        counts.skippedMissingDraft += 1
        continue
      }
      if (result.reason === "transport_not_configured" || isGrowthOutboundTransportBlockReason(result.reason)) {
        counts.skippedTransportNotConfigured += 1
        logGrowthEngine("sequence_scheduler_transport_not_configured", {
          stepId: step.id,
          enrollmentId: enrollment.id,
          outboundMode,
          blockReason: result.reason,
        })
        continue
      }
      if (result.reason === "no_sender_route") {
        counts.skippedNoSender += 1
        logGrowthEngine("sequence_scheduler_no_sender_route", {
          stepId: step.id,
          enrollmentId: enrollment.id,
          outboundMode,
        })
        continue
      }
      if (!result.queued) {
        counts.failed += 1
        if ("failure" in result && result.failure) {
          stepFailures.push(result.failure)
        } else {
          stepFailures.push({
            enrollmentId: enrollment.id,
            stepId: step.id,
            leadId: step.leadId,
            generationType: step.generationType,
            code: result.reason ?? "queue_failed",
            message: result.reason ?? "Scheduler could not queue step",
            phase: "queue_other",
          })
        }
        if (!dryRun) {
          const failureMessage =
            "failure" in result && result.failure
              ? result.failure.message
              : (result.reason ?? "Scheduler could not queue step")
          await emitGrowthSequenceFailedNotification(admin, {
            leadId: step.leadId,
            stepId: step.id,
            companyName: lead?.companyName ?? "Lead",
            reason: failureMessage,
            ownerUserId: lead?.assignedTo ?? null,
          })
        }
        continue
      }

      counts.queued += 1
      if (standaloneMode && result.jobId) {
        counts.executionJobsPlanned += 1
      }
    } catch (error) {
      counts.failed += 1
      logGrowthEngine("sequence_scheduler_step_failed", {
        stepId: step.id,
        message: error instanceof Error ? error.message : String(error),
      })
      void (async () => {
        try {
          const { fanInGrowthObjectiveSequenceEvent } = await import(
            "@/lib/growth/objectives/growth-objective-sequence-fan-in"
          )
          await fanInGrowthObjectiveSequenceEvent(admin, {
            leadId: step.leadId,
            signalType: "step_failed",
            enrollmentId: enrollment.id,
            sequencePatternId: enrollment.sequencePatternId,
            stepId: step.id,
            metadata: { message: error instanceof Error ? error.message : String(error) },
          })
        } catch {
          // Best-effort objective fan-in.
        }
      })()
    }
  }

  let runId: string | null = null
  const planningMetadata = {
    qaMarker: GROWTH_SEQUENCE_SCHEDULER_QA_MARKER,
    outboundMode,
    transportConfigured,
    adapterSchedulingEnabled,
    standalonePlanningAutomated: !adapterSchedulingEnabled,
    planningPlane: adapterSchedulingEnabled ? ("outreach_queue" as const) : ("sequence_execution_jobs" as const),
    planningCronRoute: GROWTH_SEQUENCE_SCHEDULER_CRON_ROUTE,
    executionJobsPlanned: adapterSchedulingEnabled ? 0 : counts.executionJobsPlanned,
    outreachQueueItemsQueued: adapterSchedulingEnabled ? counts.queued : 0,
    skippedTransportNotConfigured: counts.skippedTransportNotConfigured,
    skippedNoSender: counts.skippedNoSender,
    stepFailures,
  }

  if (!dryRun) {
    const run = await insertGrowthSequenceSchedulerRun(admin, {
      runMode: "live",
      scanned,
      due: counts.due,
      queued: counts.queued,
      skippedSuppressed: counts.skippedSuppressed,
      skippedAlreadyQueued: counts.skippedAlreadyQueued,
      skippedMissingDraft: counts.skippedMissingDraft,
      failed: counts.failed,
      providerWarning,
      createdBy: input.actingUserId,
      metadata: planningMetadata,
    })
    runId = run.id
  }

  logGrowthEngine("sequence_scheduler_run_completed", {
    dryRun,
    ...counts,
    scanned,
    providerWarning,
    outboundMode,
    standaloneMode,
    runId,
    ...planningMetadata,
  })

  if (!adapterSchedulingEnabled && !dryRun) {
    logGrowthEngine("sequence_scheduler_standalone_planning_completed", {
      runId,
      executionJobsPlanned: counts.executionJobsPlanned,
      skippedAlreadyQueued: counts.skippedAlreadyQueued,
      skippedTransportNotConfigured: counts.skippedTransportNotConfigured,
      skippedNoSender: counts.skippedNoSender,
      transportConfigured,
      due: counts.due,
      failed: counts.failed,
    })
  }

  return {
    scanned,
    ...counts,
    dryRun,
    providerWarning,
    qaMarker: GROWTH_SEQUENCE_SCHEDULER_QA_MARKER,
    runId,
    outboundMode,
    transportConfigured,
    standalonePlanningAutomated: !adapterSchedulingEnabled,
    planningPlane: planningMetadata.planningPlane,
    planningCronRoute: GROWTH_SEQUENCE_SCHEDULER_CRON_ROUTE,
    executionJobsPlanned: planningMetadata.executionJobsPlanned,
    outreachQueueItemsQueued: planningMetadata.outreachQueueItemsQueued,
    stepFailures,
  }
}

export async function fetchGrowthSequenceSchedulerStatus(
  admin: SupabaseClient,
): Promise<GrowthSequenceSchedulerStatus> {
  const adapterSchedulingEnabled = isAdapterOutboundExecutionEnabled()
  const [dueStepsCount, lastRun, commSettings, transportConfigured] = await Promise.all([
    countDueSequenceSchedulerSteps(admin),
    fetchLatestGrowthSequenceSchedulerRun(admin),
    fetchGrowthPlatformCommunicationSettings(admin),
    isGrowthOutboundTransportConfigured(admin),
  ])

  return {
    dueStepsCount,
    lastRun,
    qaMarker: GROWTH_SEQUENCE_SCHEDULER_QA_MARKER,
    providerConfigured: adapterSchedulingEnabled
      ? Boolean(commSettings.activeEmailConnectionId)
      : transportConfigured,
    outboundMode: getGrowthOutboundMode(),
    transportConfigured,
    standalonePlanningAutomated: !adapterSchedulingEnabled,
    planningCronRoute: GROWTH_SEQUENCE_SCHEDULER_CRON_ROUTE,
    planningPlane: adapterSchedulingEnabled ? "outreach_queue" : "sequence_execution_jobs",
    manualPlanRequired: adapterSchedulingEnabled,
  }
}
