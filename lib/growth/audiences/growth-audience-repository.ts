import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  computeSuggestedNextRefreshAt,
  GROWTH_AUDIENCE_LIMITS,
  GROWTH_AUDIENCE_QA_MARKER,
  normalizeAudienceRefreshPolicy,
  resolveRefreshIntervalDays,
} from "@/lib/growth/audiences/growth-audience-config"
import type {
  GrowthAudience,
  GrowthAudienceMember,
  GrowthAudienceMemberDiff,
  GrowthAudienceRefreshRun,
  GrowthAudienceSnapshot,
  GrowthAudienceSnapshotDiff,
} from "@/lib/growth/audiences/growth-audience-types"
import type { GrowthAudienceRefreshPolicy, GrowthAudienceResultMode } from "@/lib/growth/audiences/growth-audience-config"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
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

function snapshotDiffsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_audience_snapshot_diffs")
}

function memberDiffsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_audience_member_diffs")
}

function leadCreationRunsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("growth_audience_lead_creation_runs")
}

function mapAudience(row: Record<string, unknown>): GrowthAudience {
  const rawPolicy = asString(row.refresh_policy)
  const refreshPolicy = normalizeAudienceRefreshPolicy(
    rawPolicy === "manual_only" ? "manual" : rawPolicy,
  )
  const resultModeRaw = asString(row.result_mode)
  const resultMode: GrowthAudienceResultMode =
    resultModeRaw === "people" ? "people" : "companies"

  return {
    id: asString(row.id),
    organizationId: asString(row.organization_id),
    name: asString(row.name),
    description: asString(row.description) || null,
    savedSearchId: asString(row.saved_search_id),
    createdBy: asString(row.created_by) || null,
    lastSnapshotId: asString(row.last_snapshot_id) || null,
    lastRefreshAt: asString(row.last_refresh_at) || null,
    refreshPolicy,
    refreshIntervalDays: asNumber(row.refresh_interval_days),
    nextRefreshAt: asString(row.next_refresh_at) || null,
    resultMode,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
    qaMarker: GROWTH_AUDIENCE_QA_MARKER,
  }
}

function mapSnapshot(row: Record<string, unknown>): GrowthAudienceSnapshot {
  const resultModeRaw = asString(row.result_mode)
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
    previousSnapshotId: asString(row.previous_snapshot_id) || null,
    previousMemberCount: Number(row.previous_member_count ?? 0),
    addedCount: Number(row.added_count ?? 0),
    removedCount: Number(row.removed_count ?? 0),
    unchangedCount: Number(row.unchanged_count ?? 0),
    resultMode: resultModeRaw === "people" ? "people" : "companies",
  }
}

function mapMember(row: Record<string, unknown>): GrowthAudienceMember {
  const memberKindRaw = asString(row.member_kind)
  return {
    id: asString(row.id),
    snapshotId: asString(row.snapshot_id),
    organizationId: asString(row.organization_id),
    memberKey: asString(row.member_key) || null,
    memberKind: memberKindRaw === "person" ? "person" : "company",
    leadId: asString(row.lead_id) || null,
    companyId: asString(row.company_id) || null,
    growthPersonId: asString(row.growth_person_id) || null,
    canonicalPersonId: asString(row.canonical_person_id) || null,
    companyName: asString(row.company_name) || null,
    personName: asString(row.person_name) || null,
    personTitle: asString(row.person_title) || null,
    companyRelationshipJson: asRecord(row.company_relationship_json),
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

function mapSnapshotDiff(row: Record<string, unknown>): GrowthAudienceSnapshotDiff {
  return {
    id: asString(row.id),
    audienceId: asString(row.audience_id),
    organizationId: asString(row.organization_id),
    snapshotId: asString(row.snapshot_id),
    previousSnapshotId: asString(row.previous_snapshot_id) || null,
    status: asString(row.status) as GrowthAudienceSnapshotDiff["status"],
    previousMemberCount: Number(row.previous_member_count ?? 0),
    currentMemberCount: Number(row.current_member_count ?? 0),
    addedCount: Number(row.added_count ?? 0),
    removedCount: Number(row.removed_count ?? 0),
    unchangedCount: Number(row.unchanged_count ?? 0),
    rowsRead: Number(row.rows_read ?? 0),
    rowsWritten: Number(row.rows_written ?? 0),
    durationMs: asNumber(row.duration_ms),
    error: asString(row.error) || null,
    createdAt: asString(row.created_at),
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
    resultMode?: GrowthAudienceResultMode
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
      refresh_policy: "manual",
      result_mode: input.resultMode ?? "companies",
      qa_marker: GROWTH_AUDIENCE_QA_MARKER,
      updated_at: now,
    })
    .select("*")
    .single()
  if (error || !data) throw new Error(error?.message ?? "audience_create_failed")
  const audience = mapAudience(data as Record<string, unknown>)

  void (async () => {
    try {
      const { bindGrowthObjectiveResources } = await import(
        "@/lib/growth/objectives/growth-objective-resource-binding"
      )
      await bindGrowthObjectiveResources(admin, {
        organizationId: input.organizationId,
        resources: [
          {
            organizationId: input.organizationId,
            resourceType: "audience",
            resourceId: audience.id,
            label: audience.name,
          },
          {
            organizationId: input.organizationId,
            resourceType: "saved_search",
            resourceId: input.savedSearchId,
            label: audience.name,
          },
        ],
      })
    } catch {
      // Best-effort objective resource binding.
    }
  })()

  return audience
}

export async function updateGrowthAudienceRefreshPolicy(
  admin: SupabaseClient,
  input: {
    audienceId: string
    refreshPolicy: GrowthAudienceRefreshPolicy
  },
): Promise<GrowthAudience> {
  const intervalDays = resolveRefreshIntervalDays(input.refreshPolicy)
  const nextRefreshAt = computeSuggestedNextRefreshAt(input.refreshPolicy)
  const now = new Date().toISOString()

  const { data, error } = await audiencesTable(admin)
    .update({
      refresh_policy: input.refreshPolicy,
      refresh_interval_days: intervalDays,
      next_refresh_at: nextRefreshAt,
      updated_at: now,
    })
    .eq("id", input.audienceId)
    .select("*")
    .single()

  if (error || !data) throw new Error(error?.message ?? "audience_policy_update_failed")
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
  input: { snapshotId: string; limit?: number; offset?: number; withoutLeadId?: boolean },
): Promise<{ items: GrowthAudienceMember[]; total: number }> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200)
  const offset = Math.max(input.offset ?? 0, 0)

  let query = membersTable(admin)
    .select("*", { count: "exact" })
    .eq("snapshot_id", input.snapshotId)
    .order("created_at", { ascending: true })

  if (input.withoutLeadId) {
    query = query.is("lead_id", null)
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1)

  if (error) throw new Error(error.message)
  return {
    items: (data ?? []).map((row) => mapMember(row as Record<string, unknown>)),
    total: count ?? 0,
  }
}

export async function listGrowthAudienceMembersByIds(
  admin: SupabaseClient,
  input: { memberIds: string[]; snapshotId: string },
): Promise<GrowthAudienceMember[]> {
  if (input.memberIds.length === 0) return []
  const { data, error } = await membersTable(admin)
    .select("*")
    .eq("snapshot_id", input.snapshotId)
    .in("id", input.memberIds)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapMember(row as Record<string, unknown>))
}

export async function listSnapshotMemberKeys(
  admin: SupabaseClient,
  input: { snapshotId: string; limit: number; offset: number },
): Promise<{ keys: string[] }> {
  const { data, error } = await membersTable(admin)
    .select("member_key, company_id")
    .eq("snapshot_id", input.snapshotId)
    .order("created_at", { ascending: true })
    .range(input.offset, input.offset + input.limit - 1)

  if (error) throw new Error(error.message)

  const keys: string[] = []
  for (const row of data ?? []) {
    const r = row as { member_key?: string; company_id?: string }
    const key = asString(r.member_key) || asString(r.company_id)
    if (key) keys.push(key)
  }
  return { keys }
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
    previousSnapshotId?: string | null
    resultMode?: GrowthAudienceResultMode
  },
): Promise<GrowthAudienceSnapshot> {
  const { data, error } = await snapshotsTable(admin)
    .insert({
      audience_id: input.audienceId,
      organization_id: input.organizationId,
      member_count: 0,
      search_hash: input.searchHash,
      generated_by: input.generatedBy ?? null,
      previous_snapshot_id: input.previousSnapshotId ?? null,
      result_mode: input.resultMode ?? "companies",
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
    memberKey?: string | null
    memberKind?: "company" | "person"
    leadId?: string | null
    companyId?: string | null
    growthPersonId?: string | null
    canonicalPersonId?: string | null
    companyName?: string | null
    personName?: string | null
    personTitle?: string | null
    companyRelationshipJson?: Record<string, unknown>
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
      member_key: row.memberKey ?? row.companyId ?? row.growthPersonId ?? null,
      member_kind: row.memberKind ?? "company",
      lead_id: row.leadId ?? null,
      company_id: row.companyId ?? null,
      growth_person_id: row.growthPersonId ?? null,
      canonical_person_id: row.canonicalPersonId ?? null,
      company_name: row.companyName ?? null,
      person_name: row.personName ?? null,
      person_title: row.personTitle ?? null,
      company_relationship_json: row.companyRelationshipJson ?? {},
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
    previousSnapshotId?: string | null
    previousMemberCount: number
    addedCount?: number
    removedCount?: number
    unchangedCount?: number
    refreshPolicy?: GrowthAudienceRefreshPolicy
  },
): Promise<{ membersAdded: number; membersRemoved: number }> {
  const now = new Date().toISOString()
  const membersAdded = input.addedCount ?? Math.max(0, input.memberCount - input.previousMemberCount)
  const membersRemoved = input.removedCount ?? Math.max(0, input.previousMemberCount - input.memberCount)
  const unchangedCount =
    input.unchangedCount ??
    Math.max(0, input.memberCount - membersAdded)

  const { error: snapError } = await snapshotsTable(admin)
    .update({
      member_count: input.memberCount,
      generation_duration_ms: input.generationDurationMs,
      previous_snapshot_id: input.previousSnapshotId ?? null,
      previous_member_count: input.previousMemberCount,
      added_count: membersAdded,
      removed_count: membersRemoved,
      unchanged_count: unchangedCount,
    })
    .eq("id", input.snapshotId)
  if (snapError) throw new Error(snapError.message)

  const policy = input.refreshPolicy ?? "manual"
  const nextRefreshAt = computeSuggestedNextRefreshAt(policy, new Date(now))

  const { error: audError } = await audiencesTable(admin)
    .update({
      last_snapshot_id: input.snapshotId,
      last_refresh_at: now,
      next_refresh_at: nextRefreshAt,
      updated_at: now,
    })
    .eq("id", input.audienceId)
  if (audError) throw new Error(audError.message)

  return { membersAdded, membersRemoved }
}

export async function updateGrowthAudienceSnapshotDiffCounts(
  admin: SupabaseClient,
  input: {
    snapshotId: string
    previousSnapshotId: string
    previousMemberCount: number
    addedCount: number
    removedCount: number
    unchangedCount: number
  },
): Promise<void> {
  const { error } = await snapshotsTable(admin)
    .update({
      previous_snapshot_id: input.previousSnapshotId,
      previous_member_count: input.previousMemberCount,
      added_count: input.addedCount,
      removed_count: input.removedCount,
      unchanged_count: input.unchangedCount,
    })
    .eq("id", input.snapshotId)
  if (error) throw new Error(error.message)
}

export async function createGrowthAudienceSnapshotDiff(
  admin: SupabaseClient,
  input: {
    audienceId: string
    organizationId: string
    snapshotId: string
    previousSnapshotId: string
    previousMemberCount: number
    currentMemberCount: number
    addedCount: number
    removedCount: number
    unchangedCount: number
  },
): Promise<GrowthAudienceSnapshotDiff> {
  const now = new Date().toISOString()
  const { data, error } = await snapshotDiffsTable(admin)
    .insert({
      audience_id: input.audienceId,
      organization_id: input.organizationId,
      snapshot_id: input.snapshotId,
      previous_snapshot_id: input.previousSnapshotId,
      status: "in_progress",
      previous_member_count: input.previousMemberCount,
      current_member_count: input.currentMemberCount,
      added_count: input.addedCount,
      removed_count: input.removedCount,
      unchanged_count: input.unchangedCount,
      qa_marker: GROWTH_AUDIENCE_QA_MARKER,
      updated_at: now,
    })
    .select("*")
    .single()
  if (error || !data) throw new Error(error?.message ?? "snapshot_diff_create_failed")
  return mapSnapshotDiff(data as Record<string, unknown>)
}

export async function updateGrowthAudienceSnapshotDiff(
  admin: SupabaseClient,
  diffId: string,
  patch: Partial<{
    status: GrowthAudienceSnapshotDiff["status"]
    durationMs: number | null
    rowsRead: number
    rowsWritten: number
    diffCursor: string | null
    error: string | null
  }>,
): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.status != null) payload.status = patch.status
  if (patch.durationMs !== undefined) payload.duration_ms = patch.durationMs
  if (patch.rowsRead != null) payload.rows_read = patch.rowsRead
  if (patch.rowsWritten != null) payload.rows_written = patch.rowsWritten
  if (patch.diffCursor !== undefined) payload.diff_cursor = patch.diffCursor
  if (patch.error !== undefined) payload.error = patch.error

  const { error } = await snapshotDiffsTable(admin).update(payload).eq("id", diffId)
  if (error) throw new Error(error.message)
}

export async function insertGrowthAudienceMemberDiffsBatch(
  admin: SupabaseClient,
  input: {
    diffId: string
    snapshotId: string
    organizationId: string
    entries: Array<{
      memberKey: string
      changeKind: GrowthAudienceMemberDiff["changeKind"]
      memberKind: "company" | "person"
      displayLabel?: string | null
    }>
  },
): Promise<number> {
  if (input.entries.length === 0) return 0
  const payload = input.entries.map((entry) => ({
    diff_id: input.diffId,
    snapshot_id: input.snapshotId,
    organization_id: input.organizationId,
    member_key: entry.memberKey,
    change_kind: entry.changeKind,
    member_kind: entry.memberKind,
    display_label: entry.displayLabel ?? null,
    qa_marker: GROWTH_AUDIENCE_QA_MARKER,
  }))
  const { error } = await memberDiffsTable(admin).insert(payload)
  if (error) throw new Error(error.message)
  return payload.length
}

export async function createGrowthAudienceLeadCreationRun(
  admin: SupabaseClient,
  input: {
    audienceId: string
    organizationId: string
    snapshotId: string
    requestedCount: number
    initiatedBy?: string | null
    dryRun?: boolean
  },
) {
  const now = new Date().toISOString()
  const { data, error } = await leadCreationRunsTable(admin)
    .insert({
      audience_id: input.audienceId,
      organization_id: input.organizationId,
      snapshot_id: input.snapshotId,
      status: "in_progress",
      requested_count: input.requestedCount,
      initiated_by: input.initiatedBy ?? null,
      dry_run: input.dryRun ?? false,
      qa_marker: GROWTH_AUDIENCE_QA_MARKER,
      updated_at: now,
    })
    .select("*")
    .single()
  if (error || !data) throw new Error(error?.message ?? "lead_creation_run_failed")
  return data as Record<string, unknown>
}

export async function updateGrowthAudienceLeadCreationRun(
  admin: SupabaseClient,
  runId: string,
  patch: Partial<{
    status: GrowthAudienceRefreshRun["status"]
    createdCount: number
    skippedCount: number
    failedCount: number
    processedCount: number
    rowsRead: number
    rowsWritten: number
    durationMs: number | null
    runCursor: string | null
    error: string | null
  }>,
): Promise<void> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.status != null) payload.status = patch.status
  if (patch.createdCount != null) payload.created_count = patch.createdCount
  if (patch.skippedCount != null) payload.skipped_count = patch.skippedCount
  if (patch.failedCount != null) payload.failed_count = patch.failedCount
  if (patch.processedCount != null) payload.processed_count = patch.processedCount
  if (patch.rowsRead != null) payload.rows_read = patch.rowsRead
  if (patch.rowsWritten != null) payload.rows_written = patch.rowsWritten
  if (patch.durationMs !== undefined) payload.duration_ms = patch.durationMs
  if (patch.runCursor !== undefined) payload.run_cursor = patch.runCursor
  if (patch.error !== undefined) payload.error = patch.error

  const { error } = await leadCreationRunsTable(admin).update(payload).eq("id", runId)
  if (error) throw new Error(error.message)
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

export async function countAudienceDiffsToday(
  admin: SupabaseClient,
  organizationId: string,
  dayStart: string,
): Promise<number> {
  const probe = await snapshotDiffsTable(admin).select("id").limit(1)
  if (probe.error?.code === "42P01") return 0

  const { count } = await snapshotDiffsTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", dayStart)
  return count ?? 0
}

export async function aggregateAudienceDiffMetricsToday(
  admin: SupabaseClient,
  organizationId: string,
  dayStart: string,
): Promise<{ membersAdded: number; membersRemoved: number }> {
  const probe = await snapshotDiffsTable(admin).select("id").limit(1)
  if (probe.error?.code === "42P01") return { membersAdded: 0, membersRemoved: 0 }

  const { data } = await snapshotDiffsTable(admin)
    .select("added_count, removed_count")
    .eq("organization_id", organizationId)
    .eq("status", "completed")
    .gte("created_at", dayStart)
    .limit(100)

  let membersAdded = 0
  let membersRemoved = 0
  for (const row of data ?? []) {
    membersAdded += Number((row as { added_count: number }).added_count ?? 0)
    membersRemoved += Number((row as { removed_count: number }).removed_count ?? 0)
  }
  return { membersAdded, membersRemoved }
}

export async function countAudienceLeadCreationsToday(
  admin: SupabaseClient,
  organizationId: string,
  dayStart: string,
): Promise<number> {
  const probe = await leadCreationRunsTable(admin).select("id").limit(1)
  if (probe.error?.code === "42P01") return 0

  const { data } = await leadCreationRunsTable(admin)
    .select("created_count")
    .eq("organization_id", organizationId)
    .gte("created_at", dayStart)
    .limit(100)

  let total = 0
  for (const row of data ?? []) {
    total += Number((row as { created_count: number }).created_count ?? 0)
  }
  return total
}
