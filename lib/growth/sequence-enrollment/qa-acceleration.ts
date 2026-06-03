import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthCadenceTaskByEnrollmentStepId } from "@/lib/growth/cadence/cadence-task-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { runGrowthOutreachPreflight } from "@/lib/growth/outreach/outreach-preflight"
import { fetchGrowthOutreachSettings } from "@/lib/growth/outreach/outreach-settings-repository"
import { resolveScheduledFor } from "@/lib/growth/outreach/outreach-scheduling"
import { fetchGrowthOutreachQueueByEnrollmentStepId } from "@/lib/growth/outreach/outreach-queue-repository"
import {
  evaluateGrowthOutboundTransportReadiness,
} from "@/lib/growth/runtime/outbound-transport-readiness"
import {
  buildBulkEnrollmentSchedulerExecutionHref,
  explainSchedulerNoJobsPlanned,
} from "@/lib/growth/sequence-enrollment/bulk-enrollment-result-ui"
import { fetchPatternEnrollmentDetail } from "@/lib/growth/sequence-enrollment/enrollment-detail"
import { growthSequenceExecutionHref } from "@/lib/growth/sequence-enrollment/enrollment-navigation"
import { isGrowthQaAccelerationEnabled } from "@/lib/growth/sequence-enrollment/qa-acceleration-config"
import {
  formatQaAccelerationBlockReason,
  GROWTH_QA_ACCELERATION_QA_MARKER,
  GROWTH_QA_ACCELERATION_TIMELINE_EVENT_TYPES,
  type GrowthQaAccelerationSchedulerBlockReason,
  type GrowthQaAccelerationSchedulerRunResult,
  type GrowthQaAccelerationStepActionResult,
  type PatternEnrollmentHistoryEventView,
} from "@/lib/growth/sequence-enrollment/qa-acceleration-types"
import { runGrowthSequenceScheduler } from "@/lib/growth/sequence-enrollment/run-sequence-scheduler"
import {
  formatGrowthSchedulerStepFailureMessage,
  pickSchedulerStepFailureForEnrollment,
} from "@/lib/growth/sequence-enrollment/scheduler-step-failure-types"
import {
  enrollmentHasPriorIncompleteSteps,
  isManualStepAwaitingCompletion,
  pickInProgressEnrollmentStep,
} from "@/lib/growth/sequence-enrollment/enrollment-step-progress"
import {
  fetchGrowthSequenceEnrollmentById,
  listGrowthSequenceEnrollmentSteps,
  updateGrowthSequenceEnrollment,
  updateGrowthSequenceEnrollmentStep,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-repository"
import type {
  GrowthSequenceEnrollment,
  GrowthSequenceEnrollmentStep,
} from "@/lib/growth/sequence-enrollment-types"
import {
  findActiveSequenceExecutionJob,
  listSequenceExecutionJobsForEnrollment,
} from "@/lib/growth/sequences/execution/sequence-job-repository"
import { listGrowthLeadTimelineEvents } from "@/lib/growth/timeline-repository"
import type { GrowthLeadTimelineEvent } from "@/lib/growth/timeline-types"
import {
  emitGrowthLeadQaForceDueNowTimeline,
  emitGrowthLeadQaScheduleStepNowTimeline,
  emitGrowthLeadQaSchedulerRunTimeline,
} from "@/lib/growth/timeline-emitter"

export const GROWTH_QA_ACCELERATION_METADATA_KEY = "qaAcceleration"

type QaAccelerationEnrollmentMetadata = {
  bypassBusinessHoursStepId?: string
  bypassBusinessHoursSetAt?: string
  bypassBusinessHoursSetBy?: string
}

export function readQaAccelerationEnrollmentMetadata(
  enrollment: GrowthSequenceEnrollment,
): QaAccelerationEnrollmentMetadata | null {
  const raw = enrollment.metadata?.[GROWTH_QA_ACCELERATION_METADATA_KEY]
  if (!raw || typeof raw !== "object") return null
  return raw as QaAccelerationEnrollmentMetadata
}

export function enrollmentHasQaBusinessHoursBypass(
  enrollment: GrowthSequenceEnrollment,
  stepId: string,
): boolean {
  if (!isGrowthQaAccelerationEnabled()) return false
  const qa = readQaAccelerationEnrollmentMetadata(enrollment)
  return qa?.bypassBusinessHoursStepId === stepId
}

function pickCurrentQaStep(
  steps: GrowthSequenceEnrollmentStep[],
  currentStepOrder: number,
  allowedStatuses: GrowthSequenceEnrollmentStep["status"][],
): GrowthSequenceEnrollmentStep | null {
  const inProgress = pickInProgressEnrollmentStep(steps, currentStepOrder)
  if (!inProgress || !allowedStatuses.includes(inProgress.status)) return null
  return inProgress
}

function assertQaAccelerationEnabled(): void {
  if (!isGrowthQaAccelerationEnabled()) {
    throw new Error("QA acceleration is disabled in this environment.")
  }
}

async function resolveActiveEnrollmentStep(input: {
  admin: SupabaseClient
  enrollmentId: string
  allowedStatuses: GrowthSequenceEnrollmentStep["status"][]
}): Promise<{ enrollment: GrowthSequenceEnrollment; step: GrowthSequenceEnrollmentStep }> {
  assertQaAccelerationEnabled()

  const enrollment = await fetchGrowthSequenceEnrollmentById(input.admin, input.enrollmentId)
  if (!enrollment) throw new Error("Enrollment not found.")
  if (enrollment.status !== "active") {
    throw new Error("Enrollment must be active.")
  }

  const steps = await listGrowthSequenceEnrollmentSteps(input.admin, input.enrollmentId)
  const inProgress = pickInProgressEnrollmentStep(steps, enrollment.currentStepOrder)
  if (inProgress && isManualStepAwaitingCompletion(inProgress)) {
    throw new Error("Complete the current manual step before accelerating the next step.")
  }

  const step = pickCurrentQaStep(steps, enrollment.currentStepOrder, input.allowedStatuses)
  if (!step) {
    throw new Error("No eligible pending step found for this enrollment.")
  }

  return { enrollment, step }
}

export async function qaScheduleGrowthEnrollmentStepNow(
  admin: SupabaseClient,
  input: {
    enrollmentId: string
    actingUserId: string
    actingUserEmail: string
  },
): Promise<GrowthQaAccelerationStepActionResult> {
  const { enrollment, step } = await resolveActiveEnrollmentStep({
    admin,
    enrollmentId: input.enrollmentId,
    allowedStatuses: ["pending"],
  })

  const scheduledFor = new Date().toISOString()
  await updateGrowthSequenceEnrollmentStep(admin, step.id, { scheduledFor })
  await emitGrowthLeadQaScheduleStepNowTimeline(admin, {
    leadId: enrollment.leadId,
    enrollmentId: enrollment.id,
    stepId: step.id,
    stepOrder: step.stepOrder,
    scheduledFor,
    actor: { userId: input.actingUserId, email: input.actingUserEmail },
  })

  return {
    qaMarker: GROWTH_QA_ACCELERATION_QA_MARKER,
    enrollmentId: enrollment.id,
    stepId: step.id,
    stepOrder: step.stepOrder,
    scheduledFor,
    bypassBusinessHours: false,
  }
}

export async function qaForceGrowthEnrollmentStepDueNow(
  admin: SupabaseClient,
  input: {
    enrollmentId: string
    actingUserId: string
    actingUserEmail: string
  },
): Promise<GrowthQaAccelerationStepActionResult> {
  const { enrollment, step } = await resolveActiveEnrollmentStep({
    admin,
    enrollmentId: input.enrollmentId,
    allowedStatuses: ["pending", "draft_created"],
  })

  const scheduledFor = new Date().toISOString()
  const qaMetadata = {
    ...(enrollment.metadata ?? {}),
    [GROWTH_QA_ACCELERATION_METADATA_KEY]: {
      bypassBusinessHoursStepId: step.id,
      bypassBusinessHoursSetAt: scheduledFor,
      bypassBusinessHoursSetBy: input.actingUserId,
    } satisfies QaAccelerationEnrollmentMetadata,
  }

  await Promise.all([
    updateGrowthSequenceEnrollmentStep(admin, step.id, { scheduledFor }),
    updateGrowthSequenceEnrollment(admin, enrollment.id, { metadata: qaMetadata }),
  ])

  await emitGrowthLeadQaForceDueNowTimeline(admin, {
    leadId: enrollment.leadId,
    enrollmentId: enrollment.id,
    stepId: step.id,
    stepOrder: step.stepOrder,
    scheduledFor,
    actor: { userId: input.actingUserId, email: input.actingUserEmail },
  })

  return {
    qaMarker: GROWTH_QA_ACCELERATION_QA_MARKER,
    enrollmentId: enrollment.id,
    stepId: step.id,
    stepOrder: step.stepOrder,
    scheduledFor,
    bypassBusinessHours: true,
  }
}

async function diagnoseEnrollmentSchedulerBlocker(
  admin: SupabaseClient,
  input: {
    enrollment: GrowthSequenceEnrollment
    step: GrowthSequenceEnrollmentStep | null
  },
): Promise<GrowthQaAccelerationSchedulerBlockReason | null> {
  const { enrollment, step } = input

  if (enrollment.status !== "active") return "inactive_enrollment"
  if (!step) return "step_not_eligible"

  const steps = await listGrowthSequenceEnrollmentSteps(admin, enrollment.id)
  const inProgress = pickInProgressEnrollmentStep(steps, enrollment.currentStepOrder)
  if (inProgress && isManualStepAwaitingCompletion(inProgress)) {
    return "manual_step_in_progress"
  }
  if (step && enrollmentHasPriorIncompleteSteps(steps, step)) {
    return "manual_step_in_progress"
  }

  if (!["pending", "draft_created"].includes(step.status)) return "step_not_eligible"

  const transportReadiness = await evaluateGrowthOutboundTransportReadiness(admin)
  if (!transportReadiness.ready && transportReadiness.blockReason) {
    return transportReadiness.blockReason
  }

  const [existingQueue, existingTask, existingJob] = await Promise.all([
    fetchGrowthOutreachQueueByEnrollmentStepId(admin, step.id),
    fetchGrowthCadenceTaskByEnrollmentStepId(admin, step.id),
    findActiveSequenceExecutionJob(admin, {
      sequenceEnrollmentId: enrollment.id,
      sequenceStepId: step.id,
    }),
  ])
  if (existingQueue || step.outreachQueueId || existingTask || step.cadenceTaskId || existingJob) {
    return "already_queued"
  }

  if (step.scheduledFor && Date.parse(step.scheduledFor) > Date.now()) {
    return "step_not_eligible"
  }

  const outreachSettings = await fetchGrowthOutreachSettings(admin)
  const scheduled = resolveScheduledFor({
    sendNow: true,
    scheduledFor: step.scheduledFor,
    respectBusinessHours: !enrollmentHasQaBusinessHoursBypass(enrollment, step.id),
    timezone: outreachSettings.timezone,
    startMinutes: outreachSettings.businessHoursStartMinutes,
    endMinutes: outreachSettings.businessHoursEndMinutes,
  })
  if (scheduled.scheduledFor && Date.parse(scheduled.scheduledFor) > Date.now()) {
    return "outside_business_hours"
  }

  const lead = await fetchGrowthLeadById(admin, enrollment.leadId)
  if (!lead) return "step_not_eligible"

  const preflight = await runGrowthOutreachPreflight(admin, {
    lead,
    channel: step.channel === "email" ? "email" : step.channel,
    toEmail: lead.contactEmail,
    generationType: null,
    generationApproved: true,
  })
  if (!preflight.allowed && preflight.code === "suppressed") {
    return "blocked_by_suppression"
  }
  if (!preflight.allowed && preflight.code) {
    return preflight.code
  }

  return null
}

export async function qaRunGrowthEnrollmentSchedulerNow(
  admin: SupabaseClient,
  input: {
    enrollmentId: string
    actingUserId: string
    actingUserEmail: string
  },
): Promise<GrowthQaAccelerationSchedulerRunResult> {
  assertQaAccelerationEnabled()

  const enrollment = await fetchGrowthSequenceEnrollmentById(admin, input.enrollmentId)
  if (!enrollment) throw new Error("Enrollment not found.")

  const steps = await listGrowthSequenceEnrollmentSteps(admin, input.enrollmentId)
  const inProgress = pickInProgressEnrollmentStep(steps, enrollment.currentStepOrder)
  const step =
    inProgress && ["pending", "draft_created"].includes(inProgress.status) ? inProgress : null
  const jobsBefore = await listSequenceExecutionJobsForEnrollment(admin, input.enrollmentId)
  const jobIdsBefore = new Set(jobsBefore.map((job) => job.id))

  const transportReadiness = await evaluateGrowthOutboundTransportReadiness(admin)
  const schedulerResult = await runGrowthSequenceScheduler(admin, {
    actingUserId: input.actingUserId,
    actingUserEmail: input.actingUserEmail,
    dryRun: false,
    limit: 25,
  })

  const jobsAfter = await listSequenceExecutionJobsForEnrollment(admin, input.enrollmentId)
  const createdJob = jobsAfter.find((job) => !jobIdsBefore.has(job.id)) ?? null
  const jobCreated = Boolean(createdJob)

  let blockReason: GrowthQaAccelerationSchedulerBlockReason | null = null
  let blockReasonDetail: string | null = null
  if (!jobCreated) {
    const schedulerStepFailure = pickSchedulerStepFailureForEnrollment({
      stepFailures: schedulerResult.stepFailures,
      enrollmentId: enrollment.id,
      stepId: step?.id,
    })
    if (schedulerStepFailure) {
      blockReason = schedulerStepFailure.code
      blockReasonDetail = formatGrowthSchedulerStepFailureMessage(schedulerStepFailure)
    }

    if (!blockReason) {
      blockReason = await diagnoseEnrollmentSchedulerBlocker(admin, { enrollment, step })
    }
    if (!blockReason) {
      if (!transportReadiness.ready && transportReadiness.blockReason) {
        blockReason = transportReadiness.blockReason
      } else if (schedulerResult.transportConfigured === false || (schedulerResult.skippedTransportNotConfigured ?? 0) > 0) {
        blockReason = "no_enabled_delivery_route"
      } else if ((schedulerResult.skippedSuppressed ?? 0) > 0) {
        blockReason = "blocked_by_suppression"
      } else if ((schedulerResult.skippedAlreadyQueued ?? 0) > 0) {
        blockReason = "already_queued"
      } else if (enrollment.status !== "active") {
        blockReason = "inactive_enrollment"
      } else if (schedulerResult.due === 0 || schedulerResult.scanned === 0) {
        blockReason =
          step && !enrollmentHasQaBusinessHoursBypass(enrollment, step.id)
            ? "outside_business_hours"
            : "step_not_eligible"
      } else {
        blockReason = "step_not_eligible"
      }
    }
  }

  const blockReasonLabel = blockReasonDetail
    ?? (blockReason ? formatQaAccelerationBlockReason(blockReason) : null)

  await emitGrowthLeadQaSchedulerRunTimeline(admin, {
    leadId: enrollment.leadId,
    enrollmentId: enrollment.id,
    actor: { userId: input.actingUserId, email: input.actingUserEmail },
    jobCreated,
    createdJobId: createdJob?.id ?? null,
    blockReason,
    blockReasonLabel,
    schedulerRunId: schedulerResult.runId,
  })

  const enrollmentDetail = await fetchPatternEnrollmentDetail(admin, input.enrollmentId)
  const executionHref = jobCreated
    ? buildBulkEnrollmentSchedulerExecutionHref({
        schedulerResult,
        enrollmentDetail,
        enrollmentId: input.enrollmentId,
        leadId: enrollment.leadId,
        highlightJobId: createdJob?.id ?? null,
      }) ??
      growthSequenceExecutionHref({
        enrollmentId: input.enrollmentId,
        leadId: enrollment.leadId,
        highlightJobId: createdJob?.id ?? undefined,
      })
    : null

  return {
    qaMarker: GROWTH_QA_ACCELERATION_QA_MARKER,
    enrollmentId: input.enrollmentId,
    schedulerResult,
    jobCreated,
    createdJobId: createdJob?.id ?? null,
    blockReason,
    blockReasonLabel,
    blockReasonDetail,
    executionHref,
  }
}

export function explainQaSchedulerNoJobCreated(input: {
  blockReason: GrowthQaAccelerationSchedulerBlockReason | null
  blockReasonDetail?: string | null
  schedulerResult: GrowthQaAccelerationSchedulerRunResult["schedulerResult"]
}): string[] {
  if (input.blockReasonDetail?.trim()) {
    return [input.blockReasonDetail.trim()]
  }
  if (input.blockReason) {
    return [formatQaAccelerationBlockReason(input.blockReason)]
  }
  return explainSchedulerNoJobsPlanned({ schedulerResult: input.schedulerResult })
}

function isEnrollmentTimelineEvent(event: GrowthLeadTimelineEvent, enrollmentId: string): boolean {
  if (
    GROWTH_QA_ACCELERATION_TIMELINE_EVENT_TYPES.includes(
      event.eventType as (typeof GROWTH_QA_ACCELERATION_TIMELINE_EVENT_TYPES)[number],
    )
  ) {
    return event.payload.enrollmentId === enrollmentId
  }
  if (typeof event.payload.enrollmentId === "string") {
    return event.payload.enrollmentId === enrollmentId
  }
  return false
}

export async function listPatternEnrollmentHistoryEvents(
  admin: SupabaseClient,
  input: { leadId: string; enrollmentId: string; limit?: number },
): Promise<PatternEnrollmentHistoryEventView[]> {
  const events = await listGrowthLeadTimelineEvents(admin, {
    leadId: input.leadId,
    limit: input.limit ?? 100,
  })

  return events
    .filter((event) => isEnrollmentTimelineEvent(event, input.enrollmentId))
    .map((event) => ({
      id: event.id,
      eventType: event.eventType,
      title: event.title,
      summary: event.summary,
      actorEmail: event.actorEmail,
      occurredAt: event.occurredAt,
    }))
}

export function pickCurrentQaEnrollmentStep(
  steps: GrowthSequenceEnrollmentStep[],
  currentStepOrder: number,
): GrowthSequenceEnrollmentStep | null {
  return pickCurrentQaStep(steps, currentStepOrder, ["pending", "draft_created"])
}
