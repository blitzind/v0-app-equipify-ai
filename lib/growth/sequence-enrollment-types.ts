/** Client-safe Growth Engine sequence enrollment types. */

export const GROWTH_SEQUENCE_ENROLLMENT_STATUSES = [
  "draft",
  "active",
  "paused",
  "completed",
  "cancelled",
] as const
export type GrowthSequenceEnrollmentStatus = (typeof GROWTH_SEQUENCE_ENROLLMENT_STATUSES)[number]

export const GROWTH_SEQUENCE_ENROLLMENT_STEP_STATUSES = [
  "pending",
  "draft_created",
  "queued",
  "approved",
  "executed",
  "skipped",
  "failed",
  "cancelled",
] as const
export type GrowthSequenceEnrollmentStepStatus =
  (typeof GROWTH_SEQUENCE_ENROLLMENT_STEP_STATUSES)[number]

export type GrowthSequenceEnrollment = {
  id: string
  leadId: string
  sequencePatternId: string
  sequenceVersion: number
  status: GrowthSequenceEnrollmentStatus
  currentStepOrder: number
  enrollmentHealthScore: number
  enrollmentStalled: boolean
  ownerUserId: string | null
  pauseReason: string | null
  startedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  cancelledReason: string | null
  metadata: Record<string, unknown>
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthSequenceEnrollmentStep = {
  id: string
  enrollmentId: string
  leadId: string
  sequencePatternStepId: string
  stepOrder: number
  channel: "email" | "manual_call" | "manual_follow_up"
  generationType: string | null
  scheduledFor: string | null
  status: GrowthSequenceEnrollmentStepStatus
  stepExecutionConfidence: number
  outreachQueueId: string | null
  generationId: string | null
  completedAt: string | null
  failureReason: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthSequenceEnrollmentWithSteps = GrowthSequenceEnrollment & {
  steps: GrowthSequenceEnrollmentStep[]
  patternLabel?: string | null
  patternKey?: string | null
}

export type GrowthSequenceDriftSignal = {
  enrollmentId: string
  leadId: string
  companyName: string
  patternKey: string | null
  driftKind: "late_step" | "channel_mismatch" | "skipped_gap" | "queue_failed"
  summary: string
}
