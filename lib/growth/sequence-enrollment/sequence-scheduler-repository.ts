import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthSequenceEnrollmentStep } from "@/lib/growth/sequence-enrollment-types"
import {
  STEP_SELECT,
  mapGrowthSequenceEnrollmentStepRow,
  type StepRow,
} from "@/lib/growth/sequence-enrollment/sequence-enrollment-mappers"
import type {
  GrowthSequenceSchedulerRunMode,
  GrowthSequenceSchedulerRunPlanningMetadata,
  GrowthSequenceSchedulerRunSummary,
} from "@/lib/growth/sequence-enrollment/sequence-scheduler-types"
import { GROWTH_SEQUENCE_SCHEDULER_QA_MARKER } from "@/lib/growth/sequence-enrollment/sequence-scheduler-types"

type SchedulerRunRow = {
  id: string
  run_mode: string
  scanned: number
  due: number
  queued: number
  skipped_suppressed: number
  skipped_already_queued: number
  skipped_missing_draft: number
  failed: number
  provider_warning: boolean
  qa_marker: string
  metadata: Record<string, unknown> | null
  started_at: string
  finished_at: string | null
  created_by: string | null
}

function schedulerRunsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sequence_scheduler_runs")
}

function stepsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sequence_enrollment_steps")
}

function mapSchedulerRunPlanningMetadata(
  metadata: Record<string, unknown> | null,
): GrowthSequenceSchedulerRunPlanningMetadata | undefined {
  if (!metadata || Object.keys(metadata).length === 0) return undefined
  return {
    outboundMode: metadata.outboundMode as GrowthSequenceSchedulerRunPlanningMetadata["outboundMode"],
    transportConfigured:
      typeof metadata.transportConfigured === "boolean" ? metadata.transportConfigured : undefined,
    standalonePlanningAutomated:
      typeof metadata.standalonePlanningAutomated === "boolean"
        ? metadata.standalonePlanningAutomated
        : undefined,
    planningPlane: metadata.planningPlane as GrowthSequenceSchedulerRunPlanningMetadata["planningPlane"],
    planningCronRoute:
      metadata.planningCronRoute as GrowthSequenceSchedulerRunPlanningMetadata["planningCronRoute"],
    executionJobsPlanned:
      typeof metadata.executionJobsPlanned === "number" ? metadata.executionJobsPlanned : undefined,
    outreachQueueItemsQueued:
      typeof metadata.outreachQueueItemsQueued === "number" ? metadata.outreachQueueItemsQueued : undefined,
    skippedTransportNotConfigured:
      typeof metadata.skippedTransportNotConfigured === "number"
        ? metadata.skippedTransportNotConfigured
        : undefined,
    skippedNoSender:
      typeof metadata.skippedNoSender === "number" ? metadata.skippedNoSender : undefined,
  }
}

function mapSchedulerRun(row: SchedulerRunRow): GrowthSequenceSchedulerRunSummary {
  return {
    id: row.id,
    runMode: row.run_mode as GrowthSequenceSchedulerRunMode,
    scanned: row.scanned,
    due: row.due,
    queued: row.queued,
    skippedSuppressed: row.skipped_suppressed,
    skippedAlreadyQueued: row.skipped_already_queued,
    skippedMissingDraft: row.skipped_missing_draft,
    failed: row.failed,
    providerWarning: row.provider_warning,
    qaMarker: GROWTH_SEQUENCE_SCHEDULER_QA_MARKER,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdBy: row.created_by,
    planning: mapSchedulerRunPlanningMetadata(row.metadata),
  }
}

export async function countDueSequenceSchedulerSteps(admin: SupabaseClient): Promise<number> {
  const steps = await listDueSequenceSchedulerSteps(admin, 500)
  return steps.length
}

export async function listDueSequenceSchedulerSteps(
  admin: SupabaseClient,
  limit: number,
): Promise<GrowthSequenceEnrollmentStep[]> {
  const now = new Date().toISOString()
  const { data: enrollments, error: enrollmentError } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("id")
    .eq("status", "active")
  if (enrollmentError) throw new Error(enrollmentError.message)

  const activeEnrollmentIds = (enrollments ?? []).map((row) => row.id as string)
  if (activeEnrollmentIds.length === 0) return []

  const { data, error } = await stepsTable(admin)
    .select(STEP_SELECT)
    .in("enrollment_id", activeEnrollmentIds)
    .in("status", ["pending", "draft_created"])
    .is("outreach_queue_id", null)
    .not("scheduled_for", "is", null)
    .lte("scheduled_for", now)
    .order("scheduled_for", { ascending: true })
    .limit(limit)
  if (error) throw new Error(error.message)
  return ((data ?? []) as StepRow[]).map(mapGrowthSequenceEnrollmentStepRow)
}

export async function insertGrowthSequenceSchedulerRun(
  admin: SupabaseClient,
  input: {
    runMode: GrowthSequenceSchedulerRunMode
    scanned: number
    due: number
    queued: number
    skippedSuppressed: number
    skippedAlreadyQueued: number
    skippedMissingDraft: number
    failed: number
    providerWarning: boolean
    createdBy?: string | null
    metadata?: Record<string, unknown>
    finishedAt?: string | null
  },
): Promise<GrowthSequenceSchedulerRunSummary> {
  const { data, error } = await schedulerRunsTable(admin)
    .insert({
      run_mode: input.runMode,
      scanned: input.scanned,
      due: input.due,
      queued: input.queued,
      skipped_suppressed: input.skippedSuppressed,
      skipped_already_queued: input.skippedAlreadyQueued,
      skipped_missing_draft: input.skippedMissingDraft,
      failed: input.failed,
      provider_warning: input.providerWarning,
      qa_marker: GROWTH_SEQUENCE_SCHEDULER_QA_MARKER,
      metadata: input.metadata ?? {},
      finished_at: input.finishedAt ?? new Date().toISOString(),
      created_by: input.createdBy ?? null,
    })
    .select(
      "id, run_mode, scanned, due, queued, skipped_suppressed, skipped_already_queued, skipped_missing_draft, failed, provider_warning, qa_marker, metadata, started_at, finished_at, created_by",
    )
    .single()
  if (error) throw new Error(error.message)
  return mapSchedulerRun(data as SchedulerRunRow)
}

export async function fetchLatestGrowthSequenceSchedulerRun(
  admin: SupabaseClient,
): Promise<GrowthSequenceSchedulerRunSummary | null> {
  const { data, error } = await schedulerRunsTable(admin)
    .select(
      "id, run_mode, scanned, due, queued, skipped_suppressed, skipped_already_queued, skipped_missing_draft, failed, provider_warning, qa_marker, metadata, started_at, finished_at, created_by",
    )
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapSchedulerRun(data as SchedulerRunRow) : null
}
