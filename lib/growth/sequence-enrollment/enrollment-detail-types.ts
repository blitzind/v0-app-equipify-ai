/** Client-safe pattern enrollment detail types. */

import type { GrowthSequenceEnrollmentStep, GrowthSequenceEnrollmentWithSteps } from "@/lib/growth/sequence-enrollment-types"
import type { GrowthSequenceSchedulerStatus } from "@/lib/growth/sequence-enrollment/sequence-scheduler-types"
import type { PatternEnrollmentHistoryEventView } from "@/lib/growth/sequence-enrollment/qa-acceleration-types"
import type { GrowthQaDeliverabilityBypassView } from "@/lib/growth/sequence-enrollment/qa-deliverability-bypass-types"
import type { GrowthOutboundTransportReadiness } from "@/lib/growth/runtime/outbound-transport-readiness-types"
import type { SequenceEnrollmentBranchVisibilityView } from "@/lib/growth/sequences/conditions/sequence-enrollment-branch-visibility-types"
import type {
  GrowthSequenceExecutionJob,
  GrowthSequenceExecutionJobStatus,
} from "@/lib/growth/sequences/execution/sequence-execution-types"
import { sequenceExecutionStatusLabel } from "@/lib/growth/sequences/execution/sequence-execution-types"
import { GROWTH_PATTERN_ENROLLMENT_DETAIL_QA_MARKER } from "@/lib/growth/sequence-enrollment/enrollment-navigation"

export { GROWTH_PATTERN_ENROLLMENT_DETAIL_QA_MARKER }

export type PatternEnrollmentDetailJobView = Pick<
  GrowthSequenceExecutionJob,
  | "id"
  | "status"
  | "scheduledFor"
  | "sequenceStepId"
  | "humanApprovedAt"
  | "lastError"
  | "createdAt"
  | "updatedAt"
> & {
  stepOrder: number | null
  approvalLabel: string
}

export type PatternEnrollmentDetailView = {
  qaMarker: typeof GROWTH_PATTERN_ENROLLMENT_DETAIL_QA_MARKER
  enrollment: GrowthSequenceEnrollmentWithSteps
  leadLabel: string
  leadId: string
  patternLabel: string
  patternKey: string
  currentStep: GrowthSequenceEnrollmentStep | null
  nextStep: GrowthSequenceEnrollmentStep | null
  currentCadenceTask: {
    id: string
    status: string
    title: string
    dueAt: string | null
    channel: string
  } | null
  executionJobs: PatternEnrollmentDetailJobView[]
  pendingApprovalJobCount: number
  sentJobCount: number
  hasPlannedJobs: boolean
  schedulerStatus: Pick<
    GrowthSequenceSchedulerStatus,
    "dueStepsCount" | "standalonePlanningAutomated" | "planningCronRoute" | "lastRun"
  > | null
  workflow: {
    enrollmentActive: boolean
    stepDueNow: boolean
    jobsPlanned: boolean
    awaitingApproval: boolean
    readyForSend: boolean
    nextActionLabel: string
    nextActionHref: string | null
  }
  qaAccelerationEnabled: boolean
  qaDeliverabilityBypass: GrowthQaDeliverabilityBypassView | null
  historyEvents: PatternEnrollmentHistoryEventView[]
  transportReadiness: GrowthOutboundTransportReadiness
  branchVisibility: SequenceEnrollmentBranchVisibilityView | null
}

export type PatternEnrollmentStats = {
  activeCount: number
  draftCount: number
  pausedCount: number
  pendingApprovalJobs: number
}

export function formatEnrollmentStepStatusLabel(status: string): string {
  return status.replace(/_/g, " ")
}

export function formatExecutionJobStatusLabel(status: string): string {
  return sequenceExecutionStatusLabel(status as GrowthSequenceExecutionJobStatus)
}
