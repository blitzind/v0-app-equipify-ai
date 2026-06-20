import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_SENDR_LAUNCH_QA_MARKER } from "@/lib/growth/sendr/growth-sendr-config"
import type { GrowthSendrLaunchRun, GrowthSendrLaunchRunStatus } from "@/lib/growth/sendr/growth-sendr-types"
import { resolveBudgetWindowStart } from "@/lib/growth/runtime-guardrails/growth-runtime-budget-window"

function launchRunsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_sendr_launch_runs")
}

function mapLaunchRun(row: Record<string, unknown>): GrowthSendrLaunchRun {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    audienceId: String(row.audience_id),
    sequencePatternId: String(row.sequence_pattern_id),
    landingPageId: String(row.landing_page_id),
    previewId: row.preview_id ? String(row.preview_id) : null,
    enrollmentRunId: row.enrollment_run_id ? String(row.enrollment_run_id) : null,
    sequenceLinkId: row.sequence_link_id ? String(row.sequence_link_id) : null,
    status: String(row.status) as GrowthSendrLaunchRunStatus,
    requestedCount: Number(row.requested_count ?? 0),
    enrolledCount: Number(row.enrolled_count ?? 0),
    processedCount: Number(row.processed_count ?? 0),
    remainingCount: Number(row.remaining_count ?? 0),
    cursor: (row.cursor as Record<string, unknown>) ?? {},
    lastStep: row.last_step ? String(row.last_step) : null,
    lastError: row.last_error ? String(row.last_error) : null,
    startedAt: String(row.started_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: String(row.created_at),
  }
}

export async function createSendrLaunchRun(
  admin: SupabaseClient,
  input: {
    organizationId: string
    audienceId: string
    sequencePatternId: string
    landingPageId: string
    metadata?: Record<string, unknown>
  },
): Promise<GrowthSendrLaunchRun> {
  const { data, error } = await launchRunsTable(admin)
    .insert({
      organization_id: input.organizationId,
      audience_id: input.audienceId,
      sequence_pattern_id: input.sequencePatternId,
      landing_page_id: input.landingPageId,
      status: "pending",
      metadata: input.metadata ?? {},
      qa_marker: GROWTH_SENDR_LAUNCH_QA_MARKER,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapLaunchRun(data as Record<string, unknown>)
}

export async function updateSendrLaunchRun(
  admin: SupabaseClient,
  launchRunId: string,
  input: Partial<{
    status: GrowthSendrLaunchRunStatus
    previewId: string | null
    enrollmentRunId: string | null
    sequenceLinkId: string | null
    requestedCount: number
    enrolledCount: number
    processedCount: number
    remainingCount: number
    cursor: Record<string, unknown>
    lastStep: string | null
    lastError: string | null
    completedAt: string | null
    metadata: Record<string, unknown>
  }>,
): Promise<GrowthSendrLaunchRun> {
  const patch: Record<string, unknown> = {}
  if (input.status !== undefined) patch.status = input.status
  if (input.previewId !== undefined) patch.preview_id = input.previewId
  if (input.enrollmentRunId !== undefined) patch.enrollment_run_id = input.enrollmentRunId
  if (input.sequenceLinkId !== undefined) patch.sequence_link_id = input.sequenceLinkId
  if (input.requestedCount !== undefined) patch.requested_count = input.requestedCount
  if (input.enrolledCount !== undefined) patch.enrolled_count = input.enrolledCount
  if (input.processedCount !== undefined) patch.processed_count = input.processedCount
  if (input.remainingCount !== undefined) patch.remaining_count = input.remainingCount
  if (input.cursor !== undefined) patch.cursor = input.cursor
  if (input.lastStep !== undefined) patch.last_step = input.lastStep
  if (input.lastError !== undefined) patch.last_error = input.lastError
  if (input.completedAt !== undefined) patch.completed_at = input.completedAt
  if (input.metadata !== undefined) patch.metadata = input.metadata

  const { data, error } = await launchRunsTable(admin)
    .update(patch)
    .eq("id", launchRunId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapLaunchRun(data as Record<string, unknown>)
}

export async function listRecentSendrLaunchRuns(
  admin: SupabaseClient,
  input: { organizationId: string; limit?: number },
): Promise<GrowthSendrLaunchRun[]> {
  const limit = Math.min(input.limit ?? 10, 50)
  const { data, error } = await launchRunsTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .order("started_at", { ascending: false })
    .limit(limit)
  if (error?.message?.includes("does not exist")) return []
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapLaunchRun(row as Record<string, unknown>))
}

export async function countSendrLaunchesToday(
  admin: SupabaseClient,
  organizationId: string,
  dayStart: string,
): Promise<number> {
  const { count, error } = await launchRunsTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("started_at", dayStart)
  if (error?.message?.includes("does not exist")) return 0
  if (error) return 0
  return count ?? 0
}

export async function countSendrLaunchFailuresToday(
  admin: SupabaseClient,
  organizationId: string,
  dayStart: string,
): Promise<number> {
  const { count, error } = await launchRunsTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "failed")
    .gte("started_at", dayStart)
  if (error?.message?.includes("does not exist")) return 0
  if (error) return 0
  return count ?? 0
}

export async function sumSendrLaunchMembersEnrolledToday(
  admin: SupabaseClient,
  organizationId: string,
  dayStart: string,
): Promise<number> {
  const { data, error } = await launchRunsTable(admin)
    .select("enrolled_count")
    .eq("organization_id", organizationId)
    .eq("status", "completed")
    .gte("started_at", dayStart)
  if (error?.message?.includes("does not exist")) return 0
  if (error) return 0
  return (data ?? []).reduce((sum, row) => sum + Number((row as { enrolled_count: number }).enrolled_count ?? 0), 0)
}

export async function countSendrLaunchPreviewsToday(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  const windowStart = resolveBudgetWindowStart("daily")
  const { data, error } = await admin
    .schema("growth")
    .from("runtime_budgets")
    .select("count")
    .eq("organization_id", organizationId)
    .eq("resource_type", "sendr_launch_previews")
    .eq("window_kind", "daily")
    .eq("window_start", windowStart)
    .maybeSingle()
  if (error?.message?.includes("does not exist")) return 0
  if (error) return 0
  return Number((data as { count?: number } | null)?.count ?? 0)
}

export async function getSendrLaunchRun(
  admin: SupabaseClient,
  launchRunId: string,
): Promise<GrowthSendrLaunchRun | null> {
  const { data, error } = await launchRunsTable(admin)
    .select("*")
    .eq("id", launchRunId)
    .maybeSingle()
  if (error?.message?.includes("does not exist")) return null
  if (error || !data) return null
  return mapLaunchRun(data as Record<string, unknown>)
}
