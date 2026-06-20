import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_AUDIENCE_LIMITS,
  GROWTH_AUDIENCE_QA_MARKER,
} from "@/lib/growth/audiences/growth-audience-config"
import type {
  GrowthAudience,
  GrowthAudienceMember,
  GrowthAudienceRefreshRun,
  GrowthAudienceSnapshot,
} from "@/lib/growth/audiences/growth-audience-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function audiencesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_audiences")
}

function snapshotsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_audience_snapshots")
}

function membersTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_audience_members")
}

function refreshRunsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_audience_refresh_runs")
}

function mapAudience(row: Record<string, unknown>): GrowthAudience {
  return {
    id: asString(row.id),
    organizationId: asString(row.organization_id),
    name: asString(row.name),
    description: asString(row.description) || null,
    savedSearchId: asString(row.saved_search_id),
    createdBy: asString(row.created_by) || null,
    lastSnapshotId: asString(row.last_snapshot_id) || null,
    lastRefreshAt: asString(row.last_refresh_at) || null,
    refreshPolicy: "manual_only",
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    qaMarker: GROWTH_AUDIENCE_QA_MARKER,
  }
}

function mapSnapshot(row: Record<string, unknown>): GrowthAudienceSnapshot {
  return {
    id: asString(row.id),
    audienceId: asString(row.audience_id),
    organizationId: asString(row.organization_id),
    memberCount: Number(row.member_count ?? 0),
    searchHash: asString(row.search_hash),
    generatedAt: asString(row.generated_at),
    generatedBy: asString(row.generated_by) || null,
    generationDurationMs: asNumber(row.generation_duration_ms),
    createdAt: asString(row.created_at),
  }
}

function mapMember(row: Record<string, unknown>): GrowthAudienceMember {
  return {
    id: asString(row.id),
    snapshotId: asString(row.snapshot_id),
    organizationId: asString(row.organization_id),
    leadId: asString(row.lead_id) || null,
    companyId: asString(row.company_id) || null,
    fitScore: asNumber(row.fit_score),
    intentScore: asNumber(row.intent_score),
    engagementScore: asNumber(row.engagement_score),
    revenueScore: asNumber(row.revenue_score),
    createdAt: asString(row.created_at),
  }
}

function mapRefreshRun(row: Record<string, unknown>): GrowthAudienceRefreshRun {
  return {
    id: asString(row.id),
    audienceId: asString(row.audience_id),
    organizationId: asString(row.organization_id),
    snapshotId: asString(row.snapshot_id) || null,
    status: asString(row.status) as GrowthAudienceRefreshRun["status"],
    durationMs: asNumber(row.duration_ms),
    membersAdded: Number(row.members_added ?? 0),
    membersRemoved: Number(row.members_removed ?? 0),
    rowsRead: Number(row.rows_read ?? 0),
    rowsWritten: Number(row.rows_written ?? 0),
    snapshotCursor: asString(row.snapshot_cursor) || null,
    processedCount: Number(row.processed_count ?? 0),
    remainingEstimate: Number(row.remaining_estimate ?? 0),
    error: asString(row.error) || null,
    initiatedBy: asString(row.initiated_by) || null,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  }
}

export async function listGrowthAudiences(
  admin: SupabaseClient,
  input: { organizationId: string; limit?: number; offset?: number },
): Promise<{ items: GrowthAudience[]; total: number }> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 100)
  const offset = Math.max(input.offset ?? 0, 0)

  const { data, error, count } = await audiencesTable(admin)
    .select("*", { count: "exact" })
    .eq("organization_id", input.organizationId)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)

  const items = (data ?? []).map((row) => mapAudience(row as Record<string, unknown>))

  for (const item of items) {
    if (!item.lastSnapshotId) continue
    const snapshot = await getGrowthAudienceSnapshot(admin, item.lastSnapshotId)
    if (snapshot) item.memberCount = snapshot.memberCount

    const { data: lastRun } = await refreshRunsTable(admin)
      .select("status, duration_ms")
      .eq("audience_id", item.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (lastRun) {
      item.lastRefreshStatus = asString(lastRun.status) as GrowthAudienceRefreshRun["status"]
      item.lastRefreshDurationMs = asNumber(lastRun.duration_ms)
    }
  }

  return { items, total: count ?? items.length }
}

export async function getGrowthAudience(
  admin: SupabaseClient,
  audienceId: string,
): Promise<GrowthAudience | null> {
  const { data, error } = await audiencesTable(admin).select("*").eq("id", audienceId).maybeSingle()
  if (error || !data) return null
  const audience = mapAudience(data as Record<string, unknown>)
  if (audience.lastSnapshotId) {
    const snapshot = await getGrowthAudienceSnapshot(admin, audience.lastSnapshotId)
    if (snapshot) audience.memberCount = snapshot.memberCount
  }
  return audience
}

export async function createGrowthAudience(
  admin: SupabaseClient,
  input: {
    organizationId: string
    name: string
    description?: string | null
    savedSearchId: string
    createdBy?: string | null
  },
): Promise<GrowthAudience> {
  const now = new Date().toISOString()
  const { data, error } = await audiencesTable(admin)
    .insert({
      organization_id: input.organizationId,
      name: input.name.trim().slice(0, 120),
      description: input.description?.trim().slice(0, 2000) ?? null,
      saved_search_id: input.savedSearchId,
      created_by: input.createdBy ?? null,
      refresh_policy: "manual_only",
      qa_marker: GROWTH_AUDIENCE_QA_MARKER,
      updated_at: now,
    })
    .select("*")
    .single()
  if (error || !data) throw new Error(error?.message ?? "audience_create_failed")
  return mapAudience(data as Record<string, unknown>)
}

export async function getGrowthAudienceSnapshot(
  admin: SupabaseClient,
  snapshotId: string,
): Promise<GrowthAudienceSnapshot | null> {
  const { data, error } = await snapshotsTable(admin).select("*").eq("id", snapshotId).maybeSingle()
  if (error || !data) return null
  return mapSnapshot(data as Record<string, unknown>)
}

export async function listGrowthAudienceSnapshots(
  admin: SupabaseClient,
  input: { audienceId: string; limit?: number },
): Promise<GrowthAudienceSnapshot[]> {
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 25)
  const { data, error } = await snapshotsTable(admin)
    .select("*")
    .eq("audience_id", input.audienceId)
    .order("generated_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapSnapshot(row as Record<string, unknown>))
}

export async function listGrowthAudienceMembers(
  admin: SupabaseClient,
  input: { snapshotId: string; limit?: number; offset?: number },
): Promise<{ items: GrowthAudienceMember[]; total: number }> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200)
  const offset = Math.max(input.offset ?? 0, 0)

  const { data, error, count } = await membersTable(admin)
    .select("*", { count: "exact" })
    .eq("snapshot_id", input.snapshotId)
    .order("created_at", { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)
  return {
    items: (data ?? []).map((row) => mapMember(row as Record<string, unknown>)),
    total: count ?? 0,
  }
}

export async function listGrowthAudienceRefreshRuns(
  admin: SupabaseClient,
  input: { audienceId: string; limit?: number },
): Promise<GrowthAudienceRefreshRun[]> {
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 25)
  const { data, error } = await refreshRunsTable(admin)
    .select("*")
    .eq("audience_id", input.audienceId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapRefreshRun(row as Record<string, unknown>))
}

export async function getGrowthAudienceRefreshRun(
  admin: SupabaseClient,
  refreshRunId: string,
): Promise<GrowthAudienceRefreshRun | null> {
  const { data, error } = await refreshRunsTable(admin)
    .select("*")
    .eq("id", refreshRunId)
    .maybeSingle()
  if (error || !data) return null
  return mapRefreshRun(data as Record<string, unknown>)
}

export async function createGrowthAudienceRefreshRun(
  admin: SupabaseClient,
  input: {
    audienceId: string
    organizationId: string
    initiatedBy?: string | null
    snapshotId?: string | null
  },
): Promise<GrowthAudienceRefreshRun> {
  const now = new Date().toISOString()
  const { data, error } = await refreshRunsTable(admin)
    .insert({
      audience_id: input.audienceId,
      organization_id: input.organizationId,
      snapshot_id: input.snapshotId ?? null,
      status: "in_progress",
      initiated_by: input.initiatedBy ?? null,
      qa_marker: GROWTH_AUDIENCE_QA_MARKER,
      updated_at: now,
    })
    .select("*")
    .single()
  if (error || !data) throw new Error(error?.message ?? "refresh_run_create_failed")
  return mapRefreshRun(data as Record<string, unknown>)
}

export async function createGrowthAudienceSnapshotShell(
  admin: SupabaseClient,
  input: {
    audienceId: string
    organizationId: string
    searchHash: string
    generatedBy?: string | null
  },
): Promise<GrowthAudienceSnapshot> {
  const { data, error } = await snapshotsTable(admin)
    .insert({
      audience_id: input.audienceId,
      organization_id: input.organizationId,
      member_count: 0,
      search_hash: input.searchHash,
      generated_by: input.generatedBy ?? null,
      qa_marker: GROWTH_AUDIENCE_QA_MARKER,
    })
    .select("*")
    .single()
  if (error || !data) throw new Error(error?.message ?? "snapshot_create_failed")
  return mapSnapshot(data as Record<string, unknown>)
}

export async function insertGrowthAudienceMembersBatch(
  admin: SupabaseClient,
  rows: Array<{
    snapshotId: string
    organizationId: string
    leadId?: string | null
    companyId?: string | null
    fitScore?: number | null
    intentScore?: number | null
    engagementScore?: number | null
    revenueScore?: number | null
  }>,
): Promise<number> {
  if (rows.length === 0) return 0
  const chunkSize = GROWTH_AUDIENCE_LIMITS.SNAPSHOT_MEMBER_INSERT_BATCH
  let written = 0
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const payload = chunk.map((row) => ({
      snapshot_id: row.snapshotId,
      organization_id: row.organizationId,
      lead_id: row.leadId ?? null,
      company_id: row.companyId ?? null,
      fit_score: row.fitScore ?? null,
      intent_score: row.intentScore ?? null,
      engagement_score: row.engagementScore ?? null,
      revenue_score: row.revenueScore ?? null,
      qa_marker: GROWTH_AUDIENCE_QA_MARKER,
    }))
    const { error } = await membersTable(admin).insert(payload)
    if (error) throw new Error(error.message)
    written += chunk.length
  }
  return written
}

export async function updateGrowthAudienceRefreshRun(
  admin: SupabaseClient,
  refreshRunId: string,
  patch: Partial<{
    status: GrowthAudienceRefreshRun["status"]
    durationMs: number | null
    membersAdded: number
    membersRemoved: number
    rowsRead: number
    rowsWritten: number
    snapshotCursor: string | null
    processedCount: number
    remainingEstimate: number
    error: string | null
    snapshotId: string | null
  }>,
): Promise<GrowthAudienceRefreshRun> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.status != null) payload.status = patch.status
  if (patch.durationMs !== undefined) payload.duration_ms = patch.durationMs
  if (patch.membersAdded != null) payload.members_added = patch.membersAdded
  if (patch.membersRemoved != null) payload.members_removed = patch.membersRemoved
  if (patch.rowsRead != null) payload.rows_read = patch.rowsRead
  if (patch.rowsWritten != null) payload.rows_written = patch.rowsWritten
  if (patch.snapshotCursor !== undefined) payload.snapshot_cursor = patch.snapshotCursor
  if (patch.processedCount != null) payload.processed_count = patch.processedCount
  if (patch.remainingEstimate != null) payload.remaining_estimate = patch.remainingEstimate
  if (patch.error !== undefined) payload.error = patch.error
  if (patch.snapshotId !== undefined) payload.snapshot_id = patch.snapshotId

  const { data, error } = await refreshRunsTable(admin)
    .update(payload)
    .eq("id", refreshRunId)
    .select("*")
    .single()
  if (error || !data) throw new Error(error?.message ?? "refresh_run_update_failed")
  return mapRefreshRun(data as Record<string, unknown>)
}

export async function finalizeGrowthAudienceSnapshot(
  admin: SupabaseClient,
  input: {
    audienceId: string
    snapshotId: string
    memberCount: number
    generationDurationMs: number
    previousMemberCount: number
  },
): Promise<{ membersAdded: number; membersRemoved: number }> {
  const now = new Date().toISOString()
  const membersAdded = Math.max(0, input.memberCount - input.previousMemberCount)
  const membersRemoved = Math.max(0, input.previousMemberCount - input.memberCount)

  const { error: snapError } = await snapshotsTable(admin)
    .update({
      member_count: input.memberCount,
      generation_duration_ms: input.generationDurationMs,
    })
    .eq("id", input.snapshotId)
  if (snapError) throw new Error(snapError.message)

  const { error: audError } = await audiencesTable(admin)
    .update({
      last_snapshot_id: input.snapshotId,
      last_refresh_at: now,
      updated_at: now,
    })
    .eq("id", input.audienceId)
  if (audError) throw new Error(audError.message)

  return { membersAdded, membersRemoved }
}

export async function countInProgressAudienceRefreshRuns(
  admin: SupabaseClient,
  organizationId: string,
): Promise<number> {
  const { count, error } = await refreshRunsTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("status", ["pending", "in_progress"])
  if (error) return 0
  return count ?? 0
}
