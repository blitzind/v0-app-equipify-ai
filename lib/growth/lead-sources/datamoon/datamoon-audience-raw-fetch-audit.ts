/** GE-DATAMOON-RAW-FETCH-AUDIT-1 — Temporary first-completed fetch diagnostics (server-only). */

import "server-only"

import { logGrowthEngine } from "@/lib/growth/access"
import {
  filterDatamoonRecordToExtFields,
  isDatamoonRecordImportable,
  normalizeDatamoonAudienceRecord,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-normalizer"
import { sanitizeDatamoonProviderRecord } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-sanitizer"
import type { DatamoonAudienceMode } from "@/lib/growth/providers/datamoon/datamoon-config"

export const GROWTH_DATAMOON_RAW_FETCH_AUDIT_1_QA_MARKER =
  "ge-datamoon-raw-fetch-audit-1-v1" as const

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function readStringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readNumberField(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return value
}

function summarizeArrayPropertyLengths(value: unknown, prefix = "", depth = 0): Record<string, number> {
  if (depth > 4 || value == null) return {}
  const output: Record<string, number> = {}

  if (Array.isArray(value)) {
    if (prefix) output[prefix] = value.length
    return output
  }

  if (!isPlainObject(value)) return output

  for (const [key, nested] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (Array.isArray(nested)) {
      output[path] = nested.length
      continue
    }
    if (isPlainObject(nested)) {
      Object.assign(output, summarizeArrayPropertyLengths(nested, path, depth + 1))
    }
  }

  return output
}

function resolveImportableReason(normalized: ReturnType<typeof normalizeDatamoonAudienceRecord>): string | null {
  if (isDatamoonRecordImportable(normalized)) return null
  const missing: string[] = []
  if (!normalized.email) missing.push("email")
  if (!normalized.phone) missing.push("phone")
  if (!normalized.linkedin_url) missing.push("linkedin_url")
  if (!normalized.contact_name) missing.push("contact_name")
  return `Missing importable identity (${missing.join(", ") || "unknown"}).`
}

export function shouldLogDatamoonRawFetchAudit(existingStatus: string): boolean {
  return existingStatus !== "completed" && existingStatus !== "imported" && existingStatus !== "imported_partial"
}

export function logDatamoonRawFetchAudit(input: {
  runId: string
  datamoonAudienceId: string
  providerMode: DatamoonAudienceMode
  fetchClientStatus: string
  rawResponse: unknown
  providerStatus: string
  recordCount: number
  rawRecordsLength: number
  firstRawRecord: unknown
  previewCount: number
  skippedCount: number
  duplicateCount: number
}): void {
  const top = isPlainObject(input.rawResponse) ? input.rawResponse : {}
  const dataLayer = isPlainObject(top.data) ? top.data : null
  const countsLayer = isPlainObject(top.counts) ? top.counts : null
  const dataCountsLayer = dataLayer && isPlainObject(dataLayer.counts) ? dataLayer.counts : null

  const firstRawObject =
    input.firstRawRecord && typeof input.firstRawRecord === "object"
      ? (input.firstRawRecord as Record<string, unknown>)
      : null
  const firstRawRedacted = firstRawObject ? sanitizeDatamoonProviderRecord(firstRawObject) : null
  const firstNormalized = input.firstRawRecord
    ? normalizeDatamoonAudienceRecord(input.firstRawRecord, { providerMode: input.providerMode })
    : null
  const firstExtFiltered = firstRawObject ? filterDatamoonRecordToExtFields(firstRawObject) : null
  const importable = firstNormalized ? isDatamoonRecordImportable(firstNormalized) : null
  const importableReason = firstNormalized ? resolveImportableReason(firstNormalized) : null

  logGrowthEngine("datamoon_raw_fetch_audit_1", {
    qa_marker: GROWTH_DATAMOON_RAW_FETCH_AUDIT_1_QA_MARKER,
    run_id: input.runId,
    datamoon_audience_id: input.datamoonAudienceId,
    provider_mode: input.providerMode,
    fetch_client_status: input.fetchClientStatus,
    raw_response_keys: isPlainObject(input.rawResponse) ? Object.keys(input.rawResponse) : [],
    top_level_status: readStringField(top, "status"),
    data_status: dataLayer ? readStringField(dataLayer, "status") : null,
    record_count: readNumberField(top, "record_count") ?? (dataLayer ? readNumberField(dataLayer, "record_count") : null),
    total: dataLayer ? readNumberField(dataLayer, "total") : null,
    counts_total:
      (countsLayer ? readNumberField(countsLayer, "total") : null) ??
      (dataCountsLayer ? readNumberField(dataCountsLayer, "total") : null),
    array_property_lengths: summarizeArrayPropertyLengths(input.rawResponse),
    first_raw_record_redacted: firstRawRedacted,
    first_normalized_record: firstNormalized
      ? sanitizeDatamoonProviderRecord(firstNormalized as unknown as Record<string, unknown>)
      : null,
    first_ext_filtered_record: firstExtFiltered ? sanitizeDatamoonProviderRecord(firstExtFiltered) : null,
    is_datamoon_record_importable: importable,
    importable_reason: importableReason,
    resolved_record_count: input.recordCount,
    raw_records_length: input.rawRecordsLength,
    preview_count: input.previewCount,
    skipped_count: input.skippedCount,
    duplicate_count: input.duplicateCount,
    provider_status: input.providerStatus,
    has_first_raw_record: Boolean(input.firstRawRecord),
  })
}
