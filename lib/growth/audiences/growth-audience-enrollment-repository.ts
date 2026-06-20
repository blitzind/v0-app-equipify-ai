import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { GROWTH_AUDIENCE_QA_MARKER } from "@/lib/growth/audiences/growth-audience-config"
import type {
  GrowthAudienceEnrollmentPreviewCategory,
  GrowthAudienceEnrollmentRunStatus,
} from "@/lib/growth/audiences/growth-audience-config"
import type {
  GrowthAudienceEnrollmentPreview,
  GrowthAudienceEnrollmentPreviewMember,
  GrowthAudienceEnrollmentRun,
} from "@/lib/growth/audiences/growth-audience-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function previewsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_audience_enrollment_previews")
}

function previewMembersTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_audience_enrollment_preview_members")
}

function enrollmentRunsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_audience_enrollment_runs")
}

function mapPreview(row: Record<string, unknown>): GrowthAudienceEnrollmentPreview {
  return {
    id: asString(row.id),
    audienceId: asString(row.audience_id),
    organizationId: asString(row.organization_id),
    snapshotId: asString(row.snapshot_id),
    sequencePatternId: asString(row.sequence_pattern_id),
    status: asString(row.status) as GrowthAudienceEnrollmentPreview["status"],
    totalMembers: Number(row.total_members ?? 0),
    eligibleCount: Number(row.eligible_count ?? 0),
    alreadyEnrolledCount: Number(row.already_enrolled_count ?? 0),
    suppressedCount: Number(row.suppressed_count ?? 0),
    missingContactCount: Number(row.missing_contact_count ?? 0),
    blockedCount: Number(row.blocked_count ?? 0),
    processedCount: Number(row.processed_count ?? 0),
    rowsRead: Number(row.rows_read ?? 0),
    rowsWritten: Number(row.rows_written ?? 0),
    durationMs: asNumber(row.duration_ms),
    generatedAt: asString(row.generated_at) || null,
    previewCursor: asString(row.preview_cursor) || null,
    error: asString(row.error) || null,
    createdAt: asString(row.created_at),
  }
}

function mapPreviewMember(row: Record<string, unknown>): GrowthAudienceEnrollmentPreviewMember {
  return {
    id: asString(row.id),
    previewId: asString(row.preview_id),
    audienceMemberId: asString(row.audience_member_id),
    snapshotId: asString(row.snapshot_id),
    leadId: asString(row.lead_id) || null,
    category: asString(row.category) as GrowthAudienceEnrollmentPreviewCategory,
    reason: asString(row.reason) || null,
    displayLabel: asString(row.display_label) || null,
    createdAt: asString(row.created_at),
  }
}

function mapEnrollmentRun(row: Record<string, unknown>): GrowthAudienceEnrollmentRun {
  return {
    id: asString(row.id),
    audienceId: asString(row.audience_id),
    organizationId: asString(row.organization_id),
    snapshotId: asString(row.snapshot_id),
    previewId: asString(row.preview_id) || null,
    sequencePatternId: asString(row.sequence_pattern_id),
    status: asString(row.status) as GrowthAudienceEnrollmentRunStatus,
    requestedCount: Number(row.requested_count ?? 0),
    enrolledCount: Number(row.enrolled_count ?? 0),
    skippedCount: Number(row.skipped_count ?? 0),
    failedCount: Number(row.failed_count ?? 0),
    processedCount: Number(row.processed_count ?? 0),
    rowsRead: Number(row.rows_read ?? 0),
    rowsWritten: Number(row.rows_written ?? 0),
    durationMs: asNumber(row.duration_ms),
    startImmediately: Boolean(row.start_immediately),
    dryRun: Boolean(row.dry_run),
    cancelledAt: asString(row.cancelled_at) || null,
    runCursor: asString(row.run_cursor) || null,
    error: asString(row.error) || null,
    createdAt: asString(row.created_at),
  }
}

export async function createGrowthAudienceEnrollmentPreview(
  admin: SupabaseClient,
  input: {
    audienceId: string
    organizationId: string
    snapshotId: string
    sequencePatternId: string
    totalMembers: number
    initiatedBy?: string | null
  },
): Promise<GrowthAudienceEnrollmentPreview> {
  const now = new Date().toISOString()
  const { data, error } = await previewsTable(admin)
    .insert({
      audience_id: input.audienceId,
      organization_id: input.organizationId,
      snapshot_id: input.snapshotId,
      sequence_pattern_id: input.sequencePatternId,
      status: "in_progress",
      total_members: input.totalMembers,
      initiated_by: input.initiatedBy ?? null,
      qa_marker: GROWTH_AUDIENCE_QA_MARKER,
      updated_at: now,
    })
    .select("*")
    .single()
  if (error || !data) throw new Error(error?.message ?? "preview_create_failed")
  return mapPreview(data as Record<string, unknown>)
}

export async function getGrowthAudienceEnrollmentPreview(
  admin: SupabaseClient,
  previewId: string,
): Promise<GrowthAudienceEnrollmentPreview | null> {
  const { data, error } = await previewsTable(admin).select("*").eq("id", previewId).maybeSingle()
  if (error || !data) return null
  return mapPreview(data as Record<string, unknown>)
}

export async function updateGrowthAudienceEnrollmentPreview(
  admin: SupabaseClient,
  previewId: string,
  patch: Partial<{
    status: GrowthAudienceEnrollmentPreview["status"]
    eligibleCount: number
    alreadyEnrolledCount: number
    suppressedCount: number
    missingContactCount: number
    blockedCount: number
    processedCount: number
    previewCursor: string | null
    rowsRead: number
    rowsWritten: number
    durationMs: number | null
    generatedAt: string | null
    error: string | null
  }>,
): Promise<GrowthAudienceEnrollmentPreview> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.status != null) payload.status = patch.status
  if (patch.eligibleCount != null) payload.eligible_count = patch.eligibleCount
  if (patch.alreadyEnrolledCount != null) payload.already_enrolled_count = patch.alreadyEnrolledCount
  if (patch.suppressedCount != null) payload.suppressed_count = patch.suppressedCount
  if (patch.missingContactCount != null) payload.missing_contact_count = patch.missingContactCount
  if (patch.blockedCount != null) payload.blocked_count = patch.blockedCount
  if (patch.processedCount != null) payload.processed_count = patch.processedCount
  if (patch.previewCursor !== undefined) payload.preview_cursor = patch.previewCursor
  if (patch.rowsRead != null) payload.rows_read = patch.rowsRead
  if (patch.rowsWritten != null) payload.rows_written = patch.rowsWritten
  if (patch.durationMs !== undefined) payload.duration_ms = patch.durationMs
  if (patch.generatedAt !== undefined) payload.generated_at = patch.generatedAt
  if (patch.error !== undefined) payload.error = patch.error

  const { data, error } = await previewsTable(admin)
    .update(payload)
    .eq("id", previewId)
    .select("*")
    .single()
  if (error || !data) throw new Error(error?.message ?? "preview_update_failed")
  return mapPreview(data as Record<string, unknown>)
}

export async function insertGrowthAudienceEnrollmentPreviewMembersBatch(
  admin: SupabaseClient,
  input: {
    previewId: string
    snapshotId: string
    organizationId: string
    entries: Array<{
      audienceMemberId: string
      leadId?: string | null
      category: GrowthAudienceEnrollmentPreviewCategory
      reason?: string | null
      displayLabel?: string | null
    }>
  },
): Promise<number> {
  if (input.entries.length === 0) return 0
  const payload = input.entries.map((entry) => ({
    preview_id: input.previewId,
    audience_member_id: entry.audienceMemberId,
    snapshot_id: input.snapshotId,
    organization_id: input.organizationId,
    lead_id: entry.leadId ?? null,
    category: entry.category,
    reason: entry.reason ?? null,
    display_label: entry.displayLabel ?? null,
    qa_marker: GROWTH_AUDIENCE_QA_MARKER,
  }))
  const { error } = await previewMembersTable(admin).insert(payload)
  if (error) throw new Error(error.message)
  return payload.length
}

export async function listGrowthAudienceEnrollmentPreviewMembers(
  admin: SupabaseClient,
  input: {
    previewId: string
    category?: GrowthAudienceEnrollmentPreviewCategory
    limit?: number
    offset?: number
  },
): Promise<{ items: GrowthAudienceEnrollmentPreviewMember[]; total: number }> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200)
  const offset = Math.max(input.offset ?? 0, 0)

  let query = previewMembersTable(admin)
    .select("*", { count: "exact" })
    .eq("preview_id", input.previewId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })

  if (input.category) query = query.eq("category", input.category)

  const { data, error, count } = await query.range(offset, offset + limit - 1)
  if (error) throw new Error(error.message)

  return {
    items: (data ?? []).map((row) => mapPreviewMember(row as Record<string, unknown>)),
    total: count ?? 0,
  }
}

export async function listEligiblePreviewLeadIds(
  admin: SupabaseClient,
  previewId: string,
): Promise<string[]> {
  const leadIds: string[] = []
  let offset = 0
  const batch = 500
  while (leadIds.length < 10_000) {
    const { data, error } = await previewMembersTable(admin)
      .select("lead_id")
      .eq("preview_id", previewId)
      .eq("category", "eligible")
      .not("lead_id", "is", null)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + batch - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    for (const row of data) {
      const id = asString((row as { lead_id: string }).lead_id)
      if (id) leadIds.push(id)
    }
    if (data.length < batch) break
    offset += batch
  }
  return [...new Set(leadIds)]
}

export async function createGrowthAudienceEnrollmentRun(
  admin: SupabaseClient,
  input: {
    audienceId: string
    organizationId: string
    snapshotId: string
    previewId?: string | null
    sequencePatternId: string
    requestedCount: number
    startImmediately?: boolean
    dryRun?: boolean
    initiatedBy?: string | null
  },
): Promise<GrowthAudienceEnrollmentRun> {
  const now = new Date().toISOString()
  const { data, error } = await enrollmentRunsTable(admin)
    .insert({
      audience_id: input.audienceId,
      organization_id: input.organizationId,
      snapshot_id: input.snapshotId,
      preview_id: input.previewId ?? null,
      sequence_pattern_id: input.sequencePatternId,
      status: "in_progress",
      requested_count: input.requestedCount,
      start_immediately: input.startImmediately ?? false,
      dry_run: input.dryRun ?? false,
      initiated_by: input.initiatedBy ?? null,
      qa_marker: GROWTH_AUDIENCE_QA_MARKER,
      updated_at: now,
    })
    .select("*")
    .single()
  if (error || !data) throw new Error(error?.message ?? "enrollment_run_create_failed")
  return mapEnrollmentRun(data as Record<string, unknown>)
}

export async function getGrowthAudienceEnrollmentRun(
  admin: SupabaseClient,
  runId: string,
): Promise<GrowthAudienceEnrollmentRun | null> {
  const { data, error } = await enrollmentRunsTable(admin).select("*").eq("id", runId).maybeSingle()
  if (error || !data) return null
  return mapEnrollmentRun(data as Record<string, unknown>)
}

export async function updateGrowthAudienceEnrollmentRun(
  admin: SupabaseClient,
  runId: string,
  patch: Partial<{
    status: GrowthAudienceEnrollmentRunStatus
    enrolledCount: number
    skippedCount: number
    failedCount: number
    processedCount: number
    runCursor: string | null
    rowsRead: number
    rowsWritten: number
    durationMs: number | null
    cancelledAt: string | null
    error: string | null
  }>,
): Promise<GrowthAudienceEnrollmentRun> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.status != null) payload.status = patch.status
  if (patch.enrolledCount != null) payload.enrolled_count = patch.enrolledCount
  if (patch.skippedCount != null) payload.skipped_count = patch.skippedCount
  if (patch.failedCount != null) payload.failed_count = patch.failedCount
  if (patch.processedCount != null) payload.processed_count = patch.processedCount
  if (patch.runCursor !== undefined) payload.run_cursor = patch.runCursor
  if (patch.rowsRead != null) payload.rows_read = patch.rowsRead
  if (patch.rowsWritten != null) payload.rows_written = patch.rowsWritten
  if (patch.durationMs !== undefined) payload.duration_ms = patch.durationMs
  if (patch.cancelledAt !== undefined) payload.cancelled_at = patch.cancelledAt
  if (patch.error !== undefined) payload.error = patch.error

  const { data, error } = await enrollmentRunsTable(admin)
    .update(payload)
    .eq("id", runId)
    .select("*")
    .single()
  if (error || !data) throw new Error(error?.message ?? "enrollment_run_update_failed")
  return mapEnrollmentRun(data as Record<string, unknown>)
}

export async function countEnrollmentPreviewsToday(
  admin: SupabaseClient,
  organizationId: string,
  dayStart: string,
): Promise<number> {
  const probe = await previewsTable(admin).select("id").limit(1)
  if (probe.error?.code === "42P01") return 0
  const { count } = await previewsTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", dayStart)
  return count ?? 0
}

export async function aggregateEnrollmentPreviewMetricsToday(
  admin: SupabaseClient,
  organizationId: string,
  dayStart: string,
): Promise<{ membersEvaluated: number }> {
  const probe = await previewsTable(admin).select("id").limit(1)
  if (probe.error?.code === "42P01") return { membersEvaluated: 0 }
  const { data } = await previewsTable(admin)
    .select("processed_count")
    .eq("organization_id", organizationId)
    .gte("created_at", dayStart)
    .limit(100)
  let membersEvaluated = 0
  for (const row of data ?? []) {
    membersEvaluated += Number((row as { processed_count: number }).processed_count ?? 0)
  }
  return { membersEvaluated }
}

export async function aggregateEnrollmentRunMetricsToday(
  admin: SupabaseClient,
  organizationId: string,
  dayStart: string,
): Promise<{ membersEnrolled: number }> {
  const probe = await enrollmentRunsTable(admin).select("id").limit(1)
  if (probe.error?.code === "42P01") return { membersEnrolled: 0 }
  const { data } = await enrollmentRunsTable(admin)
    .select("enrolled_count")
    .eq("organization_id", organizationId)
    .gte("created_at", dayStart)
    .limit(100)
  let membersEnrolled = 0
  for (const row of data ?? []) {
    membersEnrolled += Number((row as { enrolled_count: number }).enrolled_count ?? 0)
  }
  return { membersEnrolled }
}
