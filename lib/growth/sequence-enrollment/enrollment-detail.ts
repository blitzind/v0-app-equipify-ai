import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchGrowthSequenceSchedulerStatus } from "@/lib/growth/sequence-enrollment/run-sequence-scheduler"
import {
  GROWTH_PATTERN_ENROLLMENT_DETAIL_QA_MARKER,
  type PatternEnrollmentDetailView,
} from "@/lib/growth/sequence-enrollment/enrollment-detail-types"
import {
  growthPatternEnrollmentDetailHref,
  growthSequenceExecutionHref,
} from "@/lib/growth/sequence-enrollment/enrollment-navigation"
import { fetchPatternEnrollmentWithSteps } from "@/lib/growth/sequence-enrollment/pattern-enrollment-stats"
import type { GrowthSequenceEnrollmentStep } from "@/lib/growth/sequence-enrollment-types"
import {
  enrichSequenceExecutionJobViews,
  listSequenceExecutionJobsForEnrollment,
} from "@/lib/growth/sequences/execution/sequence-job-repository"
import { isGrowthQaAccelerationEnabled } from "@/lib/growth/sequence-enrollment/qa-acceleration-config"
import { listPatternEnrollmentHistoryEvents } from "@/lib/growth/sequence-enrollment/qa-acceleration"

function pickCurrentStep(steps: GrowthSequenceEnrollmentStep[], currentStepOrder: number) {
  const inProgress = steps.find(
    (step) => !["executed", "skipped", "cancelled"].includes(step.status) && step.stepOrder >= currentStepOrder,
  )
  return inProgress ?? steps.find((step) => step.stepOrder === currentStepOrder) ?? null
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
    Boolean(input.currentStep?.scheduledFor) &&
    Date.parse(input.currentStep!.scheduledFor!) <= Date.now() &&
    ["pending", "draft_created"].includes(input.currentStep?.status ?? "")

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

  if (!input.hasPlannedJobs && enrollmentActive) {
    return {
      enrollmentActive,
      stepDueNow,
      jobsPlanned: false,
      awaitingApproval: false,
      readyForSend: false,
      nextActionLabel: stepDueNow
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
): Promise<PatternEnrollmentDetailView | null> {
  const bundle = await fetchPatternEnrollmentWithSteps(admin, enrollmentId)
  if (!bundle) return null

  const [jobs, schedulerStatus, historyEvents] = await Promise.all([
    listSequenceExecutionJobsForEnrollment(admin, enrollmentId),
    fetchGrowthSequenceSchedulerStatus(admin).catch(() => null),
    listPatternEnrollmentHistoryEvents(admin, {
      leadId: bundle.leadId,
      enrollmentId: bundle.id,
    }).catch(() => []),
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
    historyEvents,
  }
}
