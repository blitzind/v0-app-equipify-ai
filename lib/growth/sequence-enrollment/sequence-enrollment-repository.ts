import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthSequenceEnrollment,
  GrowthSequenceEnrollmentStep,
  GrowthSequenceEnrollmentWithSteps,
} from "@/lib/growth/sequence-enrollment-types"
import {
  ENROLLMENT_SELECT,
  STEP_SELECT,
  mapGrowthSequenceEnrollmentRow,
  mapGrowthSequenceEnrollmentStepRow,
  type EnrollmentRow,
  type StepRow,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-mappers"

function enrollmentsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sequence_enrollments")
}

function stepsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sequence_enrollment_steps")
}

export async function fetchGrowthSequenceEnrollmentById(
  admin: SupabaseClient,
  enrollmentId: string,
): Promise<GrowthSequenceEnrollment | null> {
  const { data, error } = await enrollmentsTable(admin).select(ENROLLMENT_SELECT).eq("id", enrollmentId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapGrowthSequenceEnrollmentRow(data as EnrollmentRow) : null
}

export async function fetchActiveGrowthSequenceEnrollmentForLead(
  admin: SupabaseClient,
  leadId: string,
): Promise<GrowthSequenceEnrollmentWithSteps | null> {
  const { data, error } = await enrollmentsTable(admin)
    .select(ENROLLMENT_SELECT)
    .eq("lead_id", leadId)
    .in("status", ["draft", "active", "paused"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null

  const enrollment = mapGrowthSequenceEnrollmentRow(data as EnrollmentRow)
  const steps = await listGrowthSequenceEnrollmentSteps(admin, enrollment.id)
  const { data: pattern } = await admin
    .schema("growth")
    .from("sequence_patterns")
    .select("key, label")
    .eq("id", enrollment.sequencePatternId)
    .maybeSingle()

  return {
    ...enrollment,
    steps,
    patternKey: (pattern?.key as string | undefined) ?? null,
    patternLabel: (pattern?.label as string | undefined) ?? null,
  }
}

export async function listGrowthSequenceEnrollmentSteps(
  admin: SupabaseClient,
  enrollmentId: string,
): Promise<GrowthSequenceEnrollmentStep[]> {
  const { data, error } = await stepsTable(admin)
    .select(STEP_SELECT)
    .eq("enrollment_id", enrollmentId)
    .order("step_order", { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as StepRow[]).map(mapGrowthSequenceEnrollmentStepRow)
}

export async function fetchGrowthSequenceEnrollmentStepById(
  admin: SupabaseClient,
  stepId: string,
): Promise<GrowthSequenceEnrollmentStep | null> {
  const { data, error } = await stepsTable(admin).select(STEP_SELECT).eq("id", stepId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapGrowthSequenceEnrollmentStepRow(data as StepRow) : null
}

export async function insertGrowthSequenceEnrollment(
  admin: SupabaseClient,
  input: {
    leadId: string
    sequencePatternId: string
    sequenceVersion: number
    status?: GrowthSequenceEnrollment["status"]
    ownerUserId?: string | null
    createdBy?: string | null
  },
): Promise<GrowthSequenceEnrollment> {
  const { data, error } = await enrollmentsTable(admin)
    .insert({
      lead_id: input.leadId,
      sequence_pattern_id: input.sequencePatternId,
      sequence_version: input.sequenceVersion,
      status: input.status ?? "draft",
      owner_user_id: input.ownerUserId ?? input.createdBy ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(ENROLLMENT_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapGrowthSequenceEnrollmentRow(data as EnrollmentRow)
}

export async function insertGrowthSequenceEnrollmentStep(
  admin: SupabaseClient,
  input: {
    enrollmentId: string
    leadId: string
    sequencePatternStepId: string
    stepOrder: number
    channel: GrowthSequenceEnrollmentStep["channel"]
    generationType?: string | null
    scheduledFor?: string | null
    stepExecutionConfidence?: number
  },
): Promise<GrowthSequenceEnrollmentStep> {
  const { data, error } = await stepsTable(admin)
    .insert({
      enrollment_id: input.enrollmentId,
      lead_id: input.leadId,
      sequence_pattern_step_id: input.sequencePatternStepId,
      step_order: input.stepOrder,
      channel: input.channel,
      generation_type: input.generationType ?? null,
      scheduled_for: input.scheduledFor ?? null,
      step_execution_confidence: input.stepExecutionConfidence ?? 50,
    })
    .select(STEP_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapGrowthSequenceEnrollmentStepRow(data as StepRow)
}

export async function updateGrowthSequenceEnrollment(
  admin: SupabaseClient,
  enrollmentId: string,
  patch: Partial<{
    status: GrowthSequenceEnrollment["status"]
    currentStepOrder: number
    enrollmentHealthScore: number
    enrollmentStalled: boolean
    ownerUserId: string | null
    pauseReason: string | null
    startedAt: string | null
    completedAt: string | null
    cancelledAt: string | null
    cancelledReason: string | null
  }>,
): Promise<GrowthSequenceEnrollment> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.status !== undefined) row.status = patch.status
  if (patch.currentStepOrder !== undefined) row.current_step_order = patch.currentStepOrder
  if (patch.enrollmentHealthScore !== undefined) row.enrollment_health_score = patch.enrollmentHealthScore
  if (patch.enrollmentStalled !== undefined) row.enrollment_stalled = patch.enrollmentStalled
  if (patch.ownerUserId !== undefined) row.owner_user_id = patch.ownerUserId
  if (patch.pauseReason !== undefined) row.pause_reason = patch.pauseReason
  if (patch.startedAt !== undefined) row.started_at = patch.startedAt
  if (patch.completedAt !== undefined) row.completed_at = patch.completedAt
  if (patch.cancelledAt !== undefined) row.cancelled_at = patch.cancelledAt
  if (patch.cancelledReason !== undefined) row.cancelled_reason = patch.cancelledReason

  const { data, error } = await enrollmentsTable(admin)
    .update(row)
    .eq("id", enrollmentId)
    .select(ENROLLMENT_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapGrowthSequenceEnrollmentRow(data as EnrollmentRow)
}

export async function updateGrowthSequenceEnrollmentStep(
  admin: SupabaseClient,
  stepId: string,
  patch: Partial<{
    status: GrowthSequenceEnrollmentStep["status"]
    scheduledFor: string | null
    stepExecutionConfidence: number
    outreachQueueId: string | null
    cadenceTaskId: string | null
    generationId: string | null
    instructions: string | null
    stepOutcome: string | null
    skipReason: string | null
    opportunityId: string | null
    meetingId: string | null
    dueAt: string | null
    completedAt: string | null
    failureReason: string | null
  }>,
): Promise<GrowthSequenceEnrollmentStep> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.status !== undefined) row.status = patch.status
  if (patch.scheduledFor !== undefined) row.scheduled_for = patch.scheduledFor
  if (patch.stepExecutionConfidence !== undefined) row.step_execution_confidence = patch.stepExecutionConfidence
  if (patch.outreachQueueId !== undefined) row.outreach_queue_id = patch.outreachQueueId
  if (patch.cadenceTaskId !== undefined) row.cadence_task_id = patch.cadenceTaskId
  if (patch.generationId !== undefined) row.generation_id = patch.generationId
  if (patch.instructions !== undefined) row.instructions = patch.instructions
  if (patch.stepOutcome !== undefined) row.step_outcome = patch.stepOutcome
  if (patch.skipReason !== undefined) row.skip_reason = patch.skipReason
  if (patch.opportunityId !== undefined) row.opportunity_id = patch.opportunityId
  if (patch.meetingId !== undefined) row.meeting_id = patch.meetingId
  if (patch.dueAt !== undefined) row.due_at = patch.dueAt
  if (patch.completedAt !== undefined) row.completed_at = patch.completedAt
  if (patch.failureReason !== undefined) row.failure_reason = patch.failureReason

  const { data, error } = await stepsTable(admin).update(row).eq("id", stepId).select(STEP_SELECT).single()
  if (error) throw new Error(error.message)
  return mapGrowthSequenceEnrollmentStepRow(data as StepRow)
}

export async function setLeadActiveSequenceEnrollment(
  admin: SupabaseClient,
  leadId: string,
  enrollmentId: string | null,
): Promise<void> {
  const { error } = await admin
    .schema("growth")
    .from("leads")
    .update({ active_sequence_enrollment_id: enrollmentId })
    .eq("id", leadId)
  if (error) throw new Error(error.message)
}
