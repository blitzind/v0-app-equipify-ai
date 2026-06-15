import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthCadenceTaskById } from "@/lib/growth/cadence/cadence-task-repository"
import { fetchGrowthSequenceSchedulerStatus } from "@/lib/growth/sequence-enrollment/run-sequence-scheduler"
import {
  GROWTH_PATTERN_ENROLLMENT_DETAIL_QA_MARKER,
  type PatternEnrollmentDetailView,
} from "@/lib/growth/sequence-enrollment/enrollment-detail-types"
import {
  growthPatternEnrollmentDetailHref,
  growthSequenceExecutionHref,
} from "@/lib/growth/sequence-enrollment/enrollment-navigation"
import {
  isDraftReadyEmailSchedulerStep,
  isManualStepAwaitingCompletion,
  pickInProgressEnrollmentStep,
} from "@/lib/growth/sequence-enrollment/enrollment-step-progress"
import { fetchPatternEnrollmentWithSteps } from "@/lib/growth/sequence-enrollment/pattern-enrollment-stats"
import type { GrowthSequenceEnrollmentStep } from "@/lib/growth/sequence-enrollment-types"
import {
  enrichSequenceExecutionJobViews,
  listSequenceExecutionJobsForEnrollment,
} from "@/lib/growth/sequences/execution/sequence-job-repository"
import { isGrowthQaAccelerationEnabled } from "@/lib/growth/sequence-enrollment/qa-acceleration-config"
import { listPatternEnrollmentHistoryEvents } from "@/lib/growth/sequence-enrollment/qa-acceleration"
import { evaluateGrowthOutboundTransportReadiness } from "@/lib/growth/runtime/outbound-transport-readiness"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchGrowthQaDeliverabilityBypassView } from "@/lib/growth/sequence-enrollment/qa-deliverability-bypass"
import { fetchSequenceEnrollmentBranchVisibility } from "@/lib/growth/sequences/conditions/sequence-enrollment-branch-visibility"

function pickCurrentStep(steps: GrowthSequenceEnrollmentStep[], currentStepOrder: number) {
  return pickInProgressEnrollmentStep(steps, currentStepOrder)
}

function pickNextStep(steps: GrowthSequenceEnrollmentStep[], current: GrowthSequenceEnrollmentStep | null) {
  if (!current) return null
  return steps.find((step) => step.stepOrder === current.stepOrder + 1) ?? null
}

function buildWorkflow(input: {
  enrollmentStatus: string
  currentStep: GrowthSequenceEnrollmentStep | null
  pendingApprovalJobCount: number
  readyForSendCount: number
  hasPlannedJobs: boolean
  enrollmentId: string
  leadId: string
}): PatternEnrollmentDetailView["workflow"] {
  const enrollmentActive = input.enrollmentStatus === "active"
  const stepDueNow =
    (Boolean(input.currentStep?.scheduledFor) &&
      Date.parse(input.currentStep!.scheduledFor!) <= Date.now() &&
      ["pending", "draft_created"].includes(input.currentStep?.status ?? "")) ||
    (input.currentStep != null && isDraftReadyEmailSchedulerStep(input.currentStep))

  if (input.enrollmentStatus === "draft") {
    return {
      enrollmentActive: false,
      stepDueNow: false,
      jobsPlanned: false,
      awaitingApproval: false,
      readyForSend: false,
      nextActionLabel: "Confirm enrollment to activate the sequence and allow scheduler planning.",
      nextActionHref: growthPatternEnrollmentDetailHref(input.enrollmentId),
    }
  }

  if (input.currentStep && isManualStepAwaitingCompletion(input.currentStep)) {
    return {
      enrollmentActive,
      stepDueNow: false,
      jobsPlanned: false,
      awaitingApproval: false,
      readyForSend: false,
      nextActionLabel:
        "Complete the manual step (log call outcome on the cadence task or Mark Complete below) to advance the sequence.",
      nextActionHref: growthPatternEnrollmentDetailHref(input.enrollmentId),
    }
  }

  if (!input.hasPlannedJobs && enrollmentActive) {
    return {
      enrollmentActive,
      stepDueNow,
      jobsPlanned: false,
      awaitingApproval: false,
      readyForSend: false,
      nextActionLabel:
        input.currentStep && isDraftReadyEmailSchedulerStep(input.currentStep)
          ? "Email draft is ready — run the sequence scheduler to create a pending approval job."
          : stepDueNow
            ? "Step is due — run the sequence scheduler to create a pending approval job."
            : "No execution job planned yet — wait for the scheduled step or run the scheduler when due.",
      nextActionHref: growthSequenceExecutionHref({
        enrollmentId: input.enrollmentId,
        leadId: input.leadId,
      }),
    }
  }

  if (input.pendingApprovalJobCount > 0) {
    return {
      enrollmentActive,
      stepDueNow,
      jobsPlanned: true,
      awaitingApproval: true,
      readyForSend: false,
      nextActionLabel: `${input.pendingApprovalJobCount} job(s) pending human approval.`,
      nextActionHref: growthSequenceExecutionHref({
        enrollmentId: input.enrollmentId,
        leadId: input.leadId,
      }),
    }
  }

  if (input.readyForSendCount > 0) {
    return {
      enrollmentActive,
      stepDueNow,
      jobsPlanned: true,
      awaitingApproval: false,
      readyForSend: true,
      nextActionLabel: `${input.readyForSendCount} approved job(s) queued for safe-execute cron.`,
      nextActionHref: growthSequenceExecutionHref({
        enrollmentId: input.enrollmentId,
        leadId: input.leadId,
      }),
    }
  }

  return {
    enrollmentActive,
    stepDueNow,
    jobsPlanned: input.hasPlannedJobs,
    awaitingApproval: false,
    readyForSend: false,
    nextActionLabel: "Monitor step progress — no approval action required right now.",
    nextActionHref: growthSequenceExecutionHref({
      enrollmentId: input.enrollmentId,
      leadId: input.leadId,
    }),
  }
}

export async function fetchPatternEnrollmentDetail(
  admin: SupabaseClient,
  enrollmentId: string,
  options?: { actingUserEmail?: string | null },
): Promise<PatternEnrollmentDetailView | null> {
  const bundle = await fetchPatternEnrollmentWithSteps(admin, enrollmentId)
  if (!bundle) return null

  const [jobs, schedulerStatus, historyEvents, transportReadiness, branchVisibility] = await Promise.all([
    listSequenceExecutionJobsForEnrollment(admin, enrollmentId),
    fetchGrowthSequenceSchedulerStatus(admin).catch(() => null),
    listPatternEnrollmentHistoryEvents(admin, {
      leadId: bundle.leadId,
      enrollmentId: bundle.id,
    }).catch(() => []),
    evaluateGrowthOutboundTransportReadiness(admin).catch(() => ({
      qaMarker: "growth-outbound-transport-readiness-v1" as const,
      ready: false,
      blockReason: "no_enabled_delivery_route" as const,
      label: "Transport not routable",
      message: "No enabled delivery route.",
      senderAccountId: null,
      deliveryRouteId: null,
      providerFamily: null,
    })),
    fetchSequenceEnrollmentBranchVisibility(admin, {
      enrollmentId: bundle.id,
      sequencePatternId: bundle.sequencePatternId,
      enrollmentSteps: bundle.steps,
    }).catch(() => null),
  ])
  const jobViews = await enrichSequenceExecutionJobViews(admin, jobs)
  const stepOrderById = new Map(bundle.steps.map((step) => [step.id, step.stepOrder]))

  const executionJobs = jobViews.map((job) => ({
    id: job.id,
    status: job.status,
    scheduledFor: job.scheduledFor,
    sequenceStepId: job.sequenceStepId,
    humanApprovedAt: job.humanApprovedAt,
    lastError: job.lastError,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    stepOrder: job.sequenceStepId ? stepOrderById.get(job.sequenceStepId) ?? null : null,
    approvalLabel: job.humanApprovedAt ? "Approved" : "Pending approval",
  }))

  const currentStep = pickCurrentStep(bundle.steps, bundle.currentStepOrder)
  const nextStep = pickNextStep(bundle.steps, currentStep)
  const currentCadenceTask =
    currentStep?.cadenceTaskId != null
      ? await fetchGrowthCadenceTaskById(admin, currentStep.cadenceTaskId).catch(() => null)
      : null
  const lead = await fetchGrowthLeadById(admin, bundle.leadId)
  const qaDeliverabilityBypass =
    options?.actingUserEmail && lead?.contactEmail
      ? await fetchGrowthQaDeliverabilityBypassView(admin, {
          actingUserEmail: options.actingUserEmail,
          recipientEmail: lead.contactEmail,
          senderAccountId: transportReadiness.senderAccountId,
          enrollmentId: bundle.id,
        })
      : null
  const pendingApprovalJobCount = jobs.filter((job) =>
    ["draft", "pending_approval"].includes(job.status),
  ).length
  const sentJobCount = jobs.filter((job) => job.status === "sent").length
  const readyForSendCount = jobs.filter((job) => job.status === "approved" && job.humanApprovedAt).length

  return {
    qaMarker: GROWTH_PATTERN_ENROLLMENT_DETAIL_QA_MARKER,
    enrollment: bundle,
    leadLabel: bundle.leadLabel,
    leadId: bundle.leadId,
    patternLabel: bundle.patternLabel ?? "Sequence pattern",
    patternKey: bundle.patternKey ?? "pattern",
    currentStep,
    nextStep,
    currentCadenceTask: currentCadenceTask
      ? {
          id: currentCadenceTask.id,
          status: currentCadenceTask.status,
          title: currentCadenceTask.title,
          dueAt: currentCadenceTask.dueAt,
          channel: currentCadenceTask.channel,
        }
      : null,
    executionJobs,
    pendingApprovalJobCount,
    sentJobCount,
    hasPlannedJobs: jobs.length > 0,
    schedulerStatus: schedulerStatus
      ? {
          dueStepsCount: schedulerStatus.dueStepsCount,
          standalonePlanningAutomated: schedulerStatus.standalonePlanningAutomated,
          planningCronRoute: schedulerStatus.planningCronRoute,
          lastRun: schedulerStatus.lastRun,
        }
      : null,
    workflow: buildWorkflow({
      enrollmentStatus: bundle.status,
      currentStep,
      pendingApprovalJobCount,
      readyForSendCount,
      hasPlannedJobs: jobs.length > 0,
      enrollmentId: bundle.id,
      leadId: bundle.leadId,
    }),
    qaAccelerationEnabled: isGrowthQaAccelerationEnabled(),
    qaDeliverabilityBypass,
    historyEvents,
    transportReadiness,
    branchVisibility,
  }
}
