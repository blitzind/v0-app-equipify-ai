import type {
  GrowthSequenceEnrollment,
  GrowthSequenceEnrollmentStep,
  GrowthSequenceEnrollmentStepStatus,
  GrowthSequenceEnrollmentStatus,
} from "@/lib/growth/sequence-enrollment-types"

type EnrollmentRow = {
  id: string
  lead_id: string
  sequence_pattern_id: string
  sequence_version: number
  status: string
  current_step_order: number
  enrollment_health_score: number
  enrollment_stalled: boolean
  owner_user_id: string | null
  pause_reason: string | null
  started_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  cancelled_reason: string | null
  metadata: Record<string, unknown> | null
  created_by: string | null
  created_at: string
  updated_at: string
}

type StepRow = {
  id: string
  enrollment_id: string
  lead_id: string
  sequence_pattern_step_id: string
  step_order: number
  channel: string
  generation_type: string | null
  scheduled_for: string | null
  status: string
  step_execution_confidence: number
  outreach_queue_id: string | null
  cadence_task_id: string | null
  generation_id: string | null
  instructions: string | null
  voice_drop_campaign_id: string | null
  step_outcome: string | null
  skip_reason: string | null
  opportunity_id: string | null
  meeting_id: string | null
  due_at: string | null
  completed_at: string | null
  failure_reason: string | null
  created_at: string
  updated_at: string
}

const ENROLLMENT_SELECT =
  "id, lead_id, sequence_pattern_id, sequence_version, status, current_step_order, enrollment_health_score, enrollment_stalled, owner_user_id, pause_reason, started_at, completed_at, cancelled_at, cancelled_reason, metadata, created_by, created_at, updated_at"

const STEP_SELECT =
  "id, enrollment_id, lead_id, sequence_pattern_step_id, step_order, channel, generation_type, scheduled_for, status, step_execution_confidence, outreach_queue_id, cadence_task_id, generation_id, instructions, voice_drop_campaign_id, step_outcome, skip_reason, opportunity_id, meeting_id, due_at, completed_at, failure_reason, created_at, updated_at"

export function mapGrowthSequenceEnrollmentRow(row: EnrollmentRow): GrowthSequenceEnrollment {
  return {
    id: row.id,
    leadId: row.lead_id,
    sequencePatternId: row.sequence_pattern_id,
    sequenceVersion: row.sequence_version,
    status: row.status as GrowthSequenceEnrollmentStatus,
    currentStepOrder: row.current_step_order,
    enrollmentHealthScore: row.enrollment_health_score,
    enrollmentStalled: row.enrollment_stalled,
    ownerUserId: row.owner_user_id,
    pauseReason: row.pause_reason,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    cancelledReason: row.cancelled_reason,
    metadata: row.metadata ?? {},
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapGrowthSequenceEnrollmentStepRow(row: StepRow): GrowthSequenceEnrollmentStep {
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    leadId: row.lead_id,
    sequencePatternStepId: row.sequence_pattern_step_id,
    stepOrder: row.step_order,
    channel: row.channel as GrowthSequenceEnrollmentStep["channel"],
    generationType: row.generation_type,
    scheduledFor: row.scheduled_for,
    status: row.status as GrowthSequenceEnrollmentStepStatus,
    stepExecutionConfidence: row.step_execution_confidence,
    outreachQueueId: row.outreach_queue_id,
    cadenceTaskId: row.cadence_task_id,
    generationId: row.generation_id,
    instructions: row.instructions,
    voiceDropCampaignId: row.voice_drop_campaign_id ?? null,
    stepOutcome: row.step_outcome,
    skipReason: row.skip_reason,
    opportunityId: row.opportunity_id,
    meetingId: row.meeting_id,
    dueAt: row.due_at,
    completedAt: row.completed_at,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export { ENROLLMENT_SELECT, STEP_SELECT }
export type { EnrollmentRow, StepRow }
