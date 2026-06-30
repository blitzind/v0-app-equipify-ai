import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_DATAMOON_AUDIENCE_IMPORT_QA_MARKER,
  type DatamoonAudienceImportRecord,
  type DatamoonAudienceImportRecordStatus,
  type DatamoonAudienceImportRun,
  type DatamoonAudienceImportRunStatus,
  type DatamoonNormalizedLeadRecord,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import type { DatamoonAudienceFilter, DatamoonAudienceType } from "@/lib/growth/providers/datamoon"
import type { DatamoonAudienceMode } from "@/lib/growth/providers/datamoon/datamoon-config"

type RunRow = {
  id: string
  run_name: string
  datamoon_audience_id: string | null
  provider_mode: DatamoonAudienceMode
  audience_type: DatamoonAudienceType
  filters: DatamoonAudienceFilter[]
  topic_ids: string[]
  requested_limit: number | null
  audience_name: string | null
  website_id: string | null
  status: DatamoonAudienceImportRunStatus
  record_count: number
  loading_count: number
  preview_count: number
  imported_count: number
  duplicate_count: number
  skipped_count: number
  error_count: number
  provider_metadata: Record<string, unknown>
  error_message: string | null
  dry_run: boolean
  created_by: string | null
  last_polled_at: string | null
  completed_at: string | null
  imported_at: string | null
  created_at: string
  updated_at: string
}

type RecordRow = {
  id: string
  run_id: string
  record_index: number
  status: DatamoonAudienceImportRecordStatus
  normalized_payload: DatamoonNormalizedLeadRecord
  provider_record: Record<string, unknown>
  dedupe_rule: string | null
  dedupe_key: string | null
  matched_lead_id: string | null
  lead_id: string | null
  message: string | null
  created_at: string
  updated_at: string
}

function runsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("datamoon_audience_import_runs")
}

function recordsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("datamoon_audience_import_records")
}

function mapRun(row: RunRow): DatamoonAudienceImportRun {
  return {
    id: row.id,
    runName: row.run_name,
    datamoonAudienceId: row.datamoon_audience_id,
    providerMode: row.provider_mode,
    audienceType: row.audience_type,
    filters: Array.isArray(row.filters) ? row.filters : [],
    topicIds: Array.isArray(row.topic_ids) ? row.topic_ids.map(String) : [],
    requestedLimit: row.requested_limit,
    audienceName: row.audience_name,
    websiteId: row.website_id,
    status: row.status,
    recordCount: row.record_count,
    loadingCount: row.loading_count,
    previewCount: row.preview_count,
    importedCount: row.imported_count,
    duplicateCount: row.duplicate_count,
    skippedCount: row.skipped_count,
    errorCount: row.error_count,
    providerMetadata: row.provider_metadata ?? {},
    errorMessage: row.error_message,
    dryRun: row.dry_run,
    createdBy: row.created_by,
    lastPolledAt: row.last_polled_at,
    completedAt: row.completed_at,
    importedAt: row.imported_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapRecord(row: RecordRow): DatamoonAudienceImportRecord {
  return {
    id: row.id,
    runId: row.run_id,
    recordIndex: row.record_index,
    status: row.status,
    normalized: row.normalized_payload ?? ({} as DatamoonNormalizedLeadRecord),
    dedupeRule: row.dedupe_rule,
    dedupeKey: row.dedupe_key,
    matchedLeadId: row.matched_lead_id,
    leadId: row.lead_id,
    message: row.message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function isDatamoonAudienceImportSchemaReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await runsTable(admin).select("id").limit(1)
  return !error
}

export async function createDatamoonAudienceImportRun(
  admin: SupabaseClient,
  input: {
    runName: string
    providerMode: DatamoonAudienceMode
    audienceType: DatamoonAudienceType
    filters: DatamoonAudienceFilter[]
    topicIds: string[]
    requestedLimit: number | null
    audienceName: string | null
    websiteId: string | null
    dryRun: boolean
    createdBy: string | null
  },
): Promise<DatamoonAudienceImportRun | null> {
  const { data, error } = await runsTable(admin)
    .insert({
      run_name: input.runName,
      provider_mode: input.providerMode,
      audience_type: input.audienceType,
      filters: input.filters,
      topic_ids: input.topicIds,
      requested_limit: input.requestedLimit,
      audience_name: input.audienceName,
      website_id: input.websiteId,
      dry_run: input.dryRun,
      created_by: input.createdBy,
      provider_metadata: { qa_marker: GROWTH_DATAMOON_AUDIENCE_IMPORT_QA_MARKER },
      status: "pending_build",
    })
    .select("*")
    .single()

  if (error || !data) return null
  return mapRun(data as RunRow)
}

export async function fetchDatamoonAudienceImportRunById(
  admin: SupabaseClient,
  runId: string,
): Promise<DatamoonAudienceImportRun | null> {
  const { data, error } = await runsTable(admin).select("*").eq("id", runId).maybeSingle()
  if (error || !data) return null
  return mapRun(data as RunRow)
}

export async function listDatamoonAudienceImportRuns(
  admin: SupabaseClient,
  limit = 25,
): Promise<DatamoonAudienceImportRun[]> {
  const { data, error } = await runsTable(admin)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return (data as RunRow[]).map(mapRun)
}

export async function updateDatamoonAudienceImportRun(
  admin: SupabaseClient,
  runId: string,
  patch: Partial<{
    datamoonAudienceId: string | null
    status: DatamoonAudienceImportRunStatus
    recordCount: number
    loadingCount: number
    previewCount: number
    importedCount: number
    duplicateCount: number
    skippedCount: number
    errorCount: number
    providerMetadata: Record<string, unknown>
    errorMessage: string | null
    lastPolledAt: string | null
    completedAt: string | null
    importedAt: string | null
  }>,
): Promise<DatamoonAudienceImportRun | null> {
  const row: Record<string, unknown> = {}
  if (patch.datamoonAudienceId !== undefined) row.datamoon_audience_id = patch.datamoonAudienceId
  if (patch.status !== undefined) row.status = patch.status
  if (patch.recordCount !== undefined) row.record_count = patch.recordCount
  if (patch.loadingCount !== undefined) row.loading_count = patch.loadingCount
  if (patch.previewCount !== undefined) row.preview_count = patch.previewCount
  if (patch.importedCount !== undefined) row.imported_count = patch.importedCount
  if (patch.duplicateCount !== undefined) row.duplicate_count = patch.duplicateCount
  if (patch.skippedCount !== undefined) row.skipped_count = patch.skippedCount
  if (patch.errorCount !== undefined) row.error_count = patch.errorCount
  if (patch.providerMetadata !== undefined) row.provider_metadata = patch.providerMetadata
  if (patch.errorMessage !== undefined) row.error_message = patch.errorMessage
  if (patch.lastPolledAt !== undefined) row.last_polled_at = patch.lastPolledAt
  if (patch.completedAt !== undefined) row.completed_at = patch.completedAt
  if (patch.importedAt !== undefined) row.imported_at = patch.importedAt

  const { data, error } = await runsTable(admin).update(row).eq("id", runId).select("*").maybeSingle()
  if (error || !data) return null
  return mapRun(data as RunRow)
}

export async function replaceDatamoonAudienceImportRecords(
  admin: SupabaseClient,
  runId: string,
  records: Array<{
    recordIndex: number
    status: DatamoonAudienceImportRecordStatus
    normalized: DatamoonNormalizedLeadRecord
    providerRecord: Record<string, unknown>
    dedupeRule?: string | null
    dedupeKey?: string | null
    matchedLeadId?: string | null
    message?: string | null
  }>,
): Promise<number> {
  await recordsTable(admin).delete().eq("run_id", runId)
  if (records.length === 0) return 0

  const rows = records.map((record) => ({
    run_id: runId,
    record_index: record.recordIndex,
    status: record.status,
    normalized_payload: record.normalized,
    provider_record: record.providerRecord,
    dedupe_rule: record.dedupeRule ?? null,
    dedupe_key: record.dedupeKey ?? null,
    matched_lead_id: record.matchedLeadId ?? null,
    message: record.message ?? null,
  }))

  const { error } = await recordsTable(admin).insert(rows)
  return error ? 0 : rows.length
}

export async function listDatamoonAudienceImportRecords(
  admin: SupabaseClient,
  runId: string,
  options?: { status?: DatamoonAudienceImportRecordStatus; limit?: number },
): Promise<DatamoonAudienceImportRecord[]> {
  let query = recordsTable(admin).select("*").eq("run_id", runId).order("record_index", { ascending: true })
  if (options?.status) query = query.eq("status", options.status)
  if (options?.limit) query = query.limit(options.limit)

  const { data, error } = await query
  if (error || !data) return []
  return (data as RecordRow[]).map(mapRecord)
}

export async function fetchDatamoonAudienceImportRecordsByIds(
  admin: SupabaseClient,
  runId: string,
  recordIds: string[],
): Promise<DatamoonAudienceImportRecord[]> {
  if (recordIds.length === 0) return []
  const { data, error } = await recordsTable(admin)
    .select("*")
    .eq("run_id", runId)
    .in("id", recordIds)
    .order("record_index", { ascending: true })
  if (error || !data) return []
  return (data as RecordRow[]).map(mapRecord)
}

export async function updateDatamoonAudienceImportRecord(
  admin: SupabaseClient,
  recordId: string,
  patch: Partial<{
    status: DatamoonAudienceImportRecordStatus
    leadId: string | null
    message: string | null
  }>,
): Promise<void> {
  const row: Record<string, unknown> = {}
  if (patch.status !== undefined) row.status = patch.status
  if (patch.leadId !== undefined) row.lead_id = patch.leadId
  if (patch.message !== undefined) row.message = patch.message
  await recordsTable(admin).update(row).eq("id", recordId)
}
