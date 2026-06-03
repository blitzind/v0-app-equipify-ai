import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthSequenceExecutionJob,
  GrowthSequenceExecutionJobEvent,
  GrowthSequenceExecutionJobStatus,
  GrowthSequenceExecutionJobView,
} from "@/lib/growth/sequences/execution/sequence-execution-types"
import { maskSequenceExecutionLeadLabel } from "@/lib/growth/sequences/execution/sequence-execution-types"
import { readQaDeliverabilityBypassFromJobEventMetadata } from "@/lib/growth/sequence-enrollment/qa-deliverability-bypass-types"
import { resolveExperimentAssignmentPreviewsForJobs } from "@/lib/growth/experiments/experiment-repository"

type JobRow = {
  id: string
  sequence_enrollment_id: string
  sequence_step_id: string | null
  lead_id: string
  sender_account_id: string | null
  provider_id: string | null
  sender_pool_id?: string | null
  allow_auto_rotation?: boolean
  manual_sender_account_id?: string | null
  sender_rotation_decision_id?: string | null
  status: string
  scheduled_for: string
  locked_at: string | null
  locked_by: string | null
  attempt_count: number
  last_error: string | null
  delivery_attempt_id: string | null
  requires_human_approval: boolean
  human_approved_at: string | null
  human_approved_by: string | null
  created_at: string
  updated_at: string
}

type EventRow = {
  id: string
  job_id: string
  event_type: string
  severity: string
  title: string
  description: string
  metadata: Record<string, unknown>
  created_at: string
}

function jobsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sequence_execution_jobs")
}

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sequence_execution_job_events")
}

function mapJob(row: JobRow): GrowthSequenceExecutionJob {
  return {
    id: row.id,
    sequenceEnrollmentId: row.sequence_enrollment_id,
    sequenceStepId: row.sequence_step_id,
    leadId: row.lead_id,
    senderAccountId: row.sender_account_id,
    providerId: row.provider_id,
    senderPoolId: row.sender_pool_id ?? null,
    allowAutoRotation: row.allow_auto_rotation !== false,
    manualSenderAccountId: row.manual_sender_account_id ?? null,
    senderRotationDecisionId: row.sender_rotation_decision_id ?? null,
    status: row.status as GrowthSequenceExecutionJobStatus,
    scheduledFor: row.scheduled_for,
    lockedAt: row.locked_at,
    lockedBy: row.locked_by,
    attemptCount: row.attempt_count,
    lastError: row.last_error,
    deliveryAttemptId: row.delivery_attempt_id,
    requiresHumanApproval: row.requires_human_approval,
    humanApprovedAt: row.human_approved_at,
    humanApprovedBy: row.human_approved_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapEvent(row: EventRow): GrowthSequenceExecutionJobEvent {
  return {
    id: row.id,
    jobId: row.job_id,
    eventType: row.event_type,
    severity: row.severity as GrowthSequenceExecutionJobEvent["severity"],
    title: row.title,
    description: row.description,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }
}

export async function findActiveSequenceExecutionJob(
  admin: SupabaseClient,
  input: { sequenceEnrollmentId: string; sequenceStepId: string },
): Promise<GrowthSequenceExecutionJob | null> {
  const { data, error } = await jobsTable(admin)
    .select("*")
    .eq("sequence_enrollment_id", input.sequenceEnrollmentId)
    .eq("sequence_step_id", input.sequenceStepId)
    .in("status", ["draft", "pending_approval", "approved", "scheduled", "running"])
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapJob(data as JobRow) : null
}

export async function getSequenceExecutionJob(
  admin: SupabaseClient,
  jobId: string,
): Promise<GrowthSequenceExecutionJob | null> {
  const { data, error } = await jobsTable(admin).select("*").eq("id", jobId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapJob(data as JobRow) : null
}

export async function createSequenceExecutionJob(
  admin: SupabaseClient,
  input: {
    sequenceEnrollmentId: string
    sequenceStepId: string
    leadId: string
    scheduledFor: string
    status?: GrowthSequenceExecutionJobStatus
  },
): Promise<GrowthSequenceExecutionJob> {
  const now = new Date().toISOString()
  const { data, error } = await jobsTable(admin)
    .insert({
      sequence_enrollment_id: input.sequenceEnrollmentId,
      sequence_step_id: input.sequenceStepId,
      lead_id: input.leadId,
      status: input.status ?? "pending_approval",
      scheduled_for: input.scheduledFor,
      requires_human_approval: true,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapJob(data as JobRow)
}

export async function updateSequenceExecutionJob(
  admin: SupabaseClient,
  jobId: string,
  patch: Partial<{
    status: GrowthSequenceExecutionJobStatus
    senderAccountId: string | null
    providerId: string | null
    scheduledFor: string
    lockedAt: string | null
    lockedBy: string | null
    attemptCount: number
    lastError: string | null
    deliveryAttemptId: string | null
    humanApprovedAt: string | null
    humanApprovedBy: string | null
  }>,
): Promise<GrowthSequenceExecutionJob> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.status) row.status = patch.status
  if (patch.senderAccountId !== undefined) row.sender_account_id = patch.senderAccountId
  if (patch.providerId !== undefined) row.provider_id = patch.providerId
  if (patch.scheduledFor) row.scheduled_for = patch.scheduledFor
  if (patch.lockedAt !== undefined) row.locked_at = patch.lockedAt
  if (patch.lockedBy !== undefined) row.locked_by = patch.lockedBy
  if (patch.attemptCount !== undefined) row.attempt_count = patch.attemptCount
  if (patch.lastError !== undefined) row.last_error = patch.lastError?.slice(0, 500) ?? null
  if (patch.deliveryAttemptId !== undefined) row.delivery_attempt_id = patch.deliveryAttemptId
  if (patch.humanApprovedAt !== undefined) row.human_approved_at = patch.humanApprovedAt
  if (patch.humanApprovedBy !== undefined) row.human_approved_by = patch.humanApprovedBy

  const { data, error } = await jobsTable(admin).update(row).eq("id", jobId).select("*").single()
  if (error) throw new Error(error.message)
  return mapJob(data as JobRow)
}

export async function listSequenceExecutionJobs(
  admin: SupabaseClient,
  input?: { limit?: number; status?: GrowthSequenceExecutionJobStatus },
): Promise<GrowthSequenceExecutionJob[]> {
  let query = jobsTable(admin).select("*").order("scheduled_for", { ascending: true }).limit(input?.limit ?? 100)
  if (input?.status) query = query.eq("status", input.status)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapJob(row as JobRow))
}

export async function listSequenceExecutionJobsForEnrollment(
  admin: SupabaseClient,
  sequenceEnrollmentId: string,
): Promise<GrowthSequenceExecutionJob[]> {
  const { data, error } = await jobsTable(admin)
    .select("*")
    .eq("sequence_enrollment_id", sequenceEnrollmentId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapJob(row as JobRow))
}

export async function tryLockSequenceExecutionJob(
  admin: SupabaseClient,
  jobId: string,
  lockedBy: string,
): Promise<GrowthSequenceExecutionJob | null> {
  const now = new Date().toISOString()
  const { data, error } = await jobsTable(admin)
    .update({
      status: "running",
      locked_at: now,
      locked_by: lockedBy.slice(0, 120),
      updated_at: now,
    })
    .eq("id", jobId)
    .eq("status", "approved")
    .is("locked_at", null)
    .select("*")
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapJob(data as JobRow) : null
}

export async function listApprovedDueSequenceExecutionJobs(
  admin: SupabaseClient,
  limit = 25,
): Promise<GrowthSequenceExecutionJob[]> {
  const now = new Date().toISOString()
  const { data, error } = await jobsTable(admin)
    .select("*")
    .eq("status", "approved")
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapJob(row as JobRow))
}

export async function insertSequenceExecutionJobEvent(
  admin: SupabaseClient,
  input: {
    jobId: string
    eventType: string
    severity?: GrowthSequenceExecutionJobEvent["severity"]
    title: string
    description?: string
    metadata?: Record<string, unknown>
  },
): Promise<GrowthSequenceExecutionJobEvent> {
  const { data, error } = await eventsTable(admin)
    .insert({
      job_id: input.jobId,
      event_type: input.eventType,
      severity: input.severity ?? "info",
      title: input.title.slice(0, 200),
      description: (input.description ?? "").slice(0, 500),
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapEvent(data as EventRow)
}

export async function listSequenceExecutionJobEvents(
  admin: SupabaseClient,
  jobId: string,
  limit = 50,
): Promise<GrowthSequenceExecutionJobEvent[]> {
  const { data, error } = await eventsTable(admin)
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapEvent(row as EventRow))
}

export async function enrichSequenceExecutionJobViews(
  admin: SupabaseClient,
  jobs: GrowthSequenceExecutionJob[],
): Promise<GrowthSequenceExecutionJobView[]> {
  if (jobs.length === 0) return []

  const leadIds = [...new Set(jobs.map((job) => job.leadId))]
  const enrollmentIds = [...new Set(jobs.map((job) => job.sequenceEnrollmentId))]
  const stepIds = [...new Set(jobs.map((job) => job.sequenceStepId).filter(Boolean))] as string[]
  const providerIds = [...new Set(jobs.map((job) => job.providerId).filter(Boolean))] as string[]
  const poolIds = [...new Set(jobs.map((job) => job.senderPoolId).filter(Boolean))] as string[]

  const [leadsRes, enrollmentsRes, stepsRes, providersRes, poolsRes] = await Promise.all([
    admin.schema("growth").from("leads").select("id, company_name").in("id", leadIds),
    admin.schema("growth").from("sequence_enrollments").select("id, sequence_pattern_id").in("id", enrollmentIds),
    stepIds.length > 0
      ? admin.schema("growth").from("sequence_enrollment_steps").select("id, step_order, channel").in("id", stepIds)
      : Promise.resolve({ data: [] }),
    providerIds.length > 0
      ? admin.schema("growth").from("delivery_providers").select("id, provider_name").in("id", providerIds)
      : Promise.resolve({ data: [] }),
    poolIds.length > 0
      ? admin.schema("growth").from("sender_pools").select("id, name").in("id", poolIds)
      : Promise.resolve({ data: [] }),
  ])

  const leadMap = new Map(
    (leadsRes.data ?? []).map((row) => [row.id as string, row.company_name as string | null]),
  )
  const enrollmentMap = new Map(
    (enrollmentsRes.data ?? []).map((row) => [row.id as string, row.sequence_pattern_id as string]),
  )
  const stepMap = new Map(
    (stepsRes.data ?? []).map((row) => [
      row.id as string,
      { stepOrder: row.step_order as number, channel: row.channel as string },
    ]),
  )
  const providerMap = new Map(
    (providersRes.data ?? []).map((row) => [row.id as string, row.provider_name as string]),
  )
  const poolMap = new Map((poolsRes.data ?? []).map((row) => [row.id as string, row.name as string]))

  const experimentPreviews = await resolveExperimentAssignmentPreviewsForJobs(
    admin,
    jobs.map((job) => ({ leadId: job.leadId, sequenceStepId: job.sequenceStepId })),
  )

  const jobIds = jobs.map((job) => job.id)
  const { data: plannedEvents } =
    jobIds.length > 0
      ? await eventsTable(admin)
          .select("job_id, metadata")
          .in("job_id", jobIds)
          .eq("event_type", "job_planned")
      : { data: [] as Array<{ job_id: string; metadata: Record<string, unknown> }> }

  const qaBypassByJobId = new Map<string, boolean>()
  for (const row of plannedEvents ?? []) {
    const snapshot = readQaDeliverabilityBypassFromJobEventMetadata(
      row.metadata as Record<string, unknown>,
    )
    if (snapshot?.active) {
      qaBypassByJobId.set(String(row.job_id), true)
    }
  }

  return jobs.map((job, index) => {
    const step = job.sequenceStepId ? stepMap.get(job.sequenceStepId) : null
    const experimentPreview = experimentPreviews[index]
    return {
      ...job,
      leadLabel: maskSequenceExecutionLeadLabel(job.leadId, leadMap.get(job.leadId)),
      sequenceLabel: enrollmentMap.get(job.sequenceEnrollmentId)?.slice(0, 8) ?? "Sequence",
      stepLabel: step ? `Step ${step.stepOrder} · ${step.channel}` : "—",
      providerLabel: job.providerId ? providerMap.get(job.providerId) ?? null : null,
      senderPoolLabel: job.senderPoolId ? poolMap.get(job.senderPoolId) ?? "Sender pool" : null,
      rotationReason: null,
      rotationRiskLevel: null,
      experimentId: experimentPreview?.experimentId ?? null,
      experimentName: experimentPreview?.experimentName ?? null,
      experimentVariantId: experimentPreview?.variantId ?? null,
      experimentVariantLabel: experimentPreview?.variantLabel ?? null,
      qaDeliverabilityBypassUsed: qaBypassByJobId.get(job.id) ?? false,
    }
  })
}
