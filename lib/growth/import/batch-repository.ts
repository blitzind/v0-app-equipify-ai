import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import type {
  GrowthImportBatch,
  GrowthImportBatchOptions,
  GrowthImportBatchRow,
  GrowthImportBatchRowStatus,
  GrowthImportBatchStatus,
  GrowthImportColumnMapping,
  GrowthImportRowAction,
  NormalizedImportRow,
} from "@/lib/growth/import/types"

type BatchDbRow = {
  id: string
  batch_name: string
  source_vendor: string
  source_channel: string | null
  source_campaign: string | null
  vendor_schema_version: string
  file_name: string | null
  storage_path: string | null
  row_count: number
  imported_count: number
  updated_count: number
  skipped_count: number
  duplicate_count: number
  error_count: number
  research_completed_count: number
  call_ready_count: number
  decision_maker_confirmed_count: number
  interested_count: number
  converted_count: number
  email_fill_percent: number | null
  phone_fill_percent: number | null
  website_fill_percent: number | null
  decision_maker_fill_percent: number | null
  import_quality_score: number | null
  status: string
  column_mapping: Record<string, string>
  mapping_profile_id: string | null
  options: Record<string, unknown>
  validation_summary: Record<string, unknown>
  preview_json: Record<string, unknown> | null
  error_message: string | null
  created_by: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
  updated_at: string
}

type BatchRowDbRow = {
  id: string
  batch_id: string
  row_index: number
  status: string
  action: string | null
  lead_id: string | null
  dedupe_key: string | null
  dedupe_confidence: number | null
  matched_lead_id: string | null
  source_payload: Record<string, string>
  normalized_payload: NormalizedImportRow
  codes: string[]
  message: string | null
  created_at: string
  updated_at: string
}

const BATCH_SELECT =
  "id, batch_name, source_vendor, source_channel, source_campaign, vendor_schema_version, file_name, storage_path, row_count, imported_count, updated_count, skipped_count, duplicate_count, error_count, research_completed_count, call_ready_count, decision_maker_confirmed_count, interested_count, converted_count, email_fill_percent, phone_fill_percent, website_fill_percent, decision_maker_fill_percent, import_quality_score, status, column_mapping, mapping_profile_id, options, validation_summary, preview_json, error_message, created_by, started_at, finished_at, created_at, updated_at"

const BATCH_ROW_SELECT =
  "id, batch_id, row_index, status, action, lead_id, dedupe_key, dedupe_confidence, matched_lead_id, source_payload, normalized_payload, codes, message, created_at, updated_at"

function batchesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("lead_import_batches")
}

function batchRowsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("lead_import_batch_rows")
}

export function mapGrowthImportBatchRow(row: BatchDbRow): GrowthImportBatch {
  return {
    id: row.id,
    batchName: row.batch_name,
    sourceVendor: row.source_vendor,
    sourceChannel: row.source_channel,
    sourceCampaign: row.source_campaign,
    vendorSchemaVersion: row.vendor_schema_version,
    fileName: row.file_name,
    storagePath: row.storage_path,
    rowCount: row.row_count,
    importedCount: row.imported_count,
    updatedCount: row.updated_count,
    skippedCount: row.skipped_count,
    duplicateCount: row.duplicate_count,
    errorCount: row.error_count,
    researchCompletedCount: row.research_completed_count,
    callReadyCount: row.call_ready_count,
    decisionMakerConfirmedCount: row.decision_maker_confirmed_count,
    interestedCount: row.interested_count,
    convertedCount: row.converted_count,
    emailFillPercent: row.email_fill_percent,
    phoneFillPercent: row.phone_fill_percent,
    websiteFillPercent: row.website_fill_percent,
    decisionMakerFillPercent: row.decision_maker_fill_percent,
    importQualityScore: row.import_quality_score,
    status: row.status as GrowthImportBatch["status"],
    columnMapping: row.column_mapping ?? {},
    mappingProfileId: row.mapping_profile_id,
    options: (row.options ?? {}) as GrowthImportBatchOptions,
    validationSummary: row.validation_summary ?? {},
    previewJson: row.preview_json,
    errorMessage: row.error_message,
    createdBy: row.created_by,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapBatchOutcomeRow(row: BatchRowDbRow): GrowthImportBatchRow {
  return {
    id: row.id,
    batchId: row.batch_id,
    rowIndex: row.row_index,
    status: row.status as GrowthImportBatchRow["status"],
    action: row.action as GrowthImportBatchRow["action"],
    leadId: row.lead_id,
    dedupeKey: row.dedupe_key,
    dedupeConfidence: row.dedupe_confidence,
    matchedLeadId: row.matched_lead_id,
    sourcePayload: row.source_payload ?? {},
    normalizedPayload: row.normalized_payload ?? {},
    codes: row.codes ?? [],
    message: row.message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function listGrowthImportBatches(
  admin: SupabaseClient,
  input: { limit?: number; status?: GrowthImportBatchStatus } = {},
): Promise<GrowthImportBatch[]> {
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200)
  let query = batchesTable(admin).select(BATCH_SELECT).order("created_at", { ascending: false }).limit(limit)
  if (input.status) query = query.eq("status", input.status)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as BatchDbRow[]).map(mapGrowthImportBatchRow)
}

export async function fetchGrowthImportBatchById(
  admin: SupabaseClient,
  batchId: string,
): Promise<GrowthImportBatch | null> {
  const { data, error } = await batchesTable(admin).select(BATCH_SELECT).eq("id", batchId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapGrowthImportBatchRow(data as BatchDbRow) : null
}

export async function createGrowthImportBatch(
  admin: SupabaseClient,
  input: {
    batchName: string
    sourceVendor: string
    sourceChannel?: string | null
    sourceCampaign?: string | null
    vendorSchemaVersion: string
    fileName?: string | null
    storagePath?: string | null
    createdBy?: string | null
    options?: GrowthImportBatchOptions
  },
): Promise<GrowthImportBatch> {
  const { data, error } = await batchesTable(admin)
    .insert({
      batch_name: input.batchName.trim(),
      source_vendor: input.sourceVendor,
      source_channel: input.sourceChannel?.trim() || null,
      source_campaign: input.sourceCampaign?.trim() || null,
      vendor_schema_version: input.vendorSchemaVersion,
      file_name: input.fileName ?? null,
      storage_path: input.storagePath ?? null,
      status: "partial",
      created_by: input.createdBy ?? null,
      options: input.options ?? { phase: "uploaded" },
    })
    .select(BATCH_SELECT)
    .single()
  if (error) throw new Error(error.message)
  logGrowthEngine("import_batch_created", { batchId: data.id, sourceVendor: input.sourceVendor })
  return mapGrowthImportBatchRow(data as BatchDbRow)
}

export async function updateGrowthImportBatch(
  admin: SupabaseClient,
  batchId: string,
  patch: Partial<{
    batchName: string
    sourceChannel: string | null
    sourceCampaign: string | null
    fileName: string | null
    storagePath: string | null
    rowCount: number
    importedCount: number
    updatedCount: number
    skippedCount: number
    duplicateCount: number
    errorCount: number
    researchCompletedCount: number
    callReadyCount: number
    decisionMakerConfirmedCount: number
    interestedCount: number
    convertedCount: number
    emailFillPercent: number | null
    phoneFillPercent: number | null
    websiteFillPercent: number | null
    decisionMakerFillPercent: number | null
    importQualityScore: number | null
    status: GrowthImportBatchStatus
    columnMapping: GrowthImportColumnMapping
    mappingProfileId: string | null
    options: GrowthImportBatchOptions
    validationSummary: Record<string, unknown>
    previewJson: Record<string, unknown> | null
    errorMessage: string | null
    startedAt: string | null
    finishedAt: string | null
  }>,
): Promise<GrowthImportBatch | null> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.batchName !== undefined) row.batch_name = patch.batchName
  if (patch.sourceChannel !== undefined) row.source_channel = patch.sourceChannel
  if (patch.sourceCampaign !== undefined) row.source_campaign = patch.sourceCampaign
  if (patch.fileName !== undefined) row.file_name = patch.fileName
  if (patch.storagePath !== undefined) row.storage_path = patch.storagePath
  if (patch.rowCount !== undefined) row.row_count = patch.rowCount
  if (patch.importedCount !== undefined) row.imported_count = patch.importedCount
  if (patch.updatedCount !== undefined) row.updated_count = patch.updatedCount
  if (patch.skippedCount !== undefined) row.skipped_count = patch.skippedCount
  if (patch.duplicateCount !== undefined) row.duplicate_count = patch.duplicateCount
  if (patch.errorCount !== undefined) row.error_count = patch.errorCount
  if (patch.researchCompletedCount !== undefined) row.research_completed_count = patch.researchCompletedCount
  if (patch.callReadyCount !== undefined) row.call_ready_count = patch.callReadyCount
  if (patch.decisionMakerConfirmedCount !== undefined) {
    row.decision_maker_confirmed_count = patch.decisionMakerConfirmedCount
  }
  if (patch.interestedCount !== undefined) row.interested_count = patch.interestedCount
  if (patch.convertedCount !== undefined) row.converted_count = patch.convertedCount
  if (patch.emailFillPercent !== undefined) row.email_fill_percent = patch.emailFillPercent
  if (patch.phoneFillPercent !== undefined) row.phone_fill_percent = patch.phoneFillPercent
  if (patch.websiteFillPercent !== undefined) row.website_fill_percent = patch.websiteFillPercent
  if (patch.decisionMakerFillPercent !== undefined) row.decision_maker_fill_percent = patch.decisionMakerFillPercent
  if (patch.importQualityScore !== undefined) row.import_quality_score = patch.importQualityScore
  if (patch.status !== undefined) row.status = patch.status
  if (patch.columnMapping !== undefined) row.column_mapping = patch.columnMapping
  if (patch.mappingProfileId !== undefined) row.mapping_profile_id = patch.mappingProfileId
  if (patch.options !== undefined) row.options = patch.options
  if (patch.validationSummary !== undefined) row.validation_summary = patch.validationSummary
  if (patch.previewJson !== undefined) row.preview_json = patch.previewJson
  if (patch.errorMessage !== undefined) row.error_message = patch.errorMessage
  if (patch.startedAt !== undefined) row.started_at = patch.startedAt
  if (patch.finishedAt !== undefined) row.finished_at = patch.finishedAt

  const { data, error } = await batchesTable(admin).update(row).eq("id", batchId).select(BATCH_SELECT).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapGrowthImportBatchRow(data as BatchDbRow) : null
}

export async function replaceGrowthImportBatchRows(
  admin: SupabaseClient,
  batchId: string,
  rows: Array<{
    rowIndex: number
    status: GrowthImportBatchRowStatus
    action?: GrowthImportRowAction | null
    leadId?: string | null
    dedupeKey?: string | null
    dedupeConfidence?: number | null
    matchedLeadId?: string | null
    sourcePayload: Record<string, string>
    normalizedPayload: NormalizedImportRow
    codes?: string[]
    message?: string | null
  }>,
): Promise<void> {
  await batchRowsTable(admin).delete().eq("batch_id", batchId)
  if (rows.length === 0) return

  const payload = rows.map((row) => ({
    batch_id: batchId,
    row_index: row.rowIndex,
    status: row.status,
    action: row.action ?? null,
    lead_id: row.leadId ?? null,
    dedupe_key: row.dedupeKey ?? null,
    dedupe_confidence: row.dedupeConfidence ?? null,
    matched_lead_id: row.matchedLeadId ?? null,
    source_payload: row.sourcePayload,
    normalized_payload: row.normalizedPayload,
    codes: row.codes ?? [],
    message: row.message ?? null,
  }))

  const { error } = await batchRowsTable(admin).insert(payload)
  if (error) throw new Error(error.message)
}

export async function listGrowthImportBatchRows(
  admin: SupabaseClient,
  batchId: string,
  input: { limit?: number; offset?: number; status?: GrowthImportBatchRowStatus } = {},
): Promise<GrowthImportBatchRow[]> {
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500)
  const offset = Math.max(input.offset ?? 0, 0)
  let query = batchRowsTable(admin)
    .select(BATCH_ROW_SELECT)
    .eq("batch_id", batchId)
    .order("row_index", { ascending: true })
  if (input.status) query = query.eq("status", input.status)
  const { data, error } = await query.range(offset, offset + limit - 1)
  if (error) throw new Error(error.message)
  return ((data ?? []) as BatchRowDbRow[]).map(mapBatchOutcomeRow)
}

export async function fetchGrowthImportBatchRowByIndex(
  admin: SupabaseClient,
  batchId: string,
  rowIndex: number,
): Promise<GrowthImportBatchRow | null> {
  const { data, error } = await batchRowsTable(admin)
    .select(BATCH_ROW_SELECT)
    .eq("batch_id", batchId)
    .eq("row_index", rowIndex)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapBatchOutcomeRow(data as BatchRowDbRow) : null
}

export async function upsertGrowthImportBatchRowOutcome(
  admin: SupabaseClient,
  batchId: string,
  row: {
    rowIndex: number
    status: GrowthImportBatchRowStatus
    action?: GrowthImportRowAction | null
    leadId?: string | null
    dedupeKey?: string | null
    dedupeConfidence?: number | null
    matchedLeadId?: string | null
    sourcePayload: Record<string, string>
    normalizedPayload: NormalizedImportRow
    codes?: string[]
    message?: string | null
  },
): Promise<void> {
  const { error } = await batchRowsTable(admin).upsert(
    {
      batch_id: batchId,
      row_index: row.rowIndex,
      status: row.status,
      action: row.action ?? null,
      lead_id: row.leadId ?? null,
      dedupe_key: row.dedupeKey ?? null,
      dedupe_confidence: row.dedupeConfidence ?? null,
      matched_lead_id: row.matchedLeadId ?? null,
      source_payload: row.sourcePayload,
      normalized_payload: row.normalizedPayload,
      codes: row.codes ?? [],
      message: row.message ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "batch_id,row_index" },
  )
  if (error) throw new Error(error.message)
}

export async function refreshGrowthImportBatchLeadOutcomes(
  admin: SupabaseClient,
  batchId: string,
): Promise<GrowthImportBatch | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("leads")
    .select("status, last_researched_at, decision_maker_status, call_disposition")
    .eq("source_import_batch_id", batchId)
  if (error) throw new Error(error.message)

  const leads = (data ?? []) as Array<{
    status: string
    last_researched_at: string | null
    decision_maker_status: string | null
    call_disposition: string | null
  }>

  const { computeBatchLeadOutcomeCounts } = await import("@/lib/growth/import/quality")
  const counts = computeBatchLeadOutcomeCounts(
    leads.map((l) => ({
      status: l.status,
      lastResearchedAt: l.last_researched_at,
      decisionMakerStatus: l.decision_maker_status,
      callDisposition: l.call_disposition,
    })),
  )

  return updateGrowthImportBatch(admin, batchId, counts)
}
