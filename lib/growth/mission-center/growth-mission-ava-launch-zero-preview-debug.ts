/** GE-DATAMOON-ZERO-RESULTS-RESPONSE-TRACE-1 — Client-visible zero-preview Ava launch debug (client-safe). */

import type { DatamoonAudienceImportRequest } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"
import type {
  DatamoonAudienceImportRecord,
  DatamoonAudienceImportRecordStatus,
  DatamoonAudienceImportRun,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-types"

export const GROWTH_DATAMOON_ZERO_RESULTS_RESPONSE_TRACE_1_QA_MARKER =
  "ge-datamoon-zero-results-response-trace-1-v1" as const

export const GROWTH_HOME_FIND_LEADS_ZERO_PREVIEW_DEBUG_TITLE = "Debug run details" as const

export type GrowthMissionAvaLaunchZeroPreviewDebugChildRecordSample = {
  recordIndex: number
  status: DatamoonAudienceImportRecordStatus
  message: string | null
}

export type GrowthMissionAvaLaunchZeroPreviewDebug = {
  qa_marker: typeof GROWTH_DATAMOON_ZERO_RESULTS_RESPONSE_TRACE_1_QA_MARKER
  reason: "zero_preview_import_trace"
  runId: string
  datamoonAudienceId: string | null
  provider_status: string | null
  run_status: string
  record_count: number
  preview_count: number
  skipped_count: number
  duplicate_count: number
  imported_count: number
  loading_count: number
  provider_metadata: {
    poll_status: string | null
    fetch_response_keys: string[] | null
  }
  filters: DatamoonAudienceImportRequest["filters"]
  topic_ids: string[]
  audience_type: DatamoonAudienceImportRequest["audience_type"]
  omittedWorkbenchFilterFields: string[]
  childRecordStatusCounts: Record<DatamoonAudienceImportRecordStatus, number>
  childRecordSamples: GrowthMissionAvaLaunchZeroPreviewDebugChildRecordSample[]
}

export const GROWTH_MISSION_AVA_LAUNCH_ZERO_PREVIEW_DEBUG_PII_KEYS = [
  "normalized",
  "provider_record",
  "first_name",
  "last_name",
  "contact_name",
  "business_email",
  "personal_emails",
  "email",
  "personal_phone",
  "phone",
  "linkedin_url",
  "personal_address",
  "company_domain",
] as const

function readMetadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key]
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function readMetadataStringArray(metadata: Record<string, unknown>, key: string): string[] | null {
  const value = metadata[key]
  if (!Array.isArray(value)) return null
  const strings = value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
  return strings.length > 0 ? strings : null
}

function countChildRecordStatuses(
  records: DatamoonAudienceImportRecord[],
): Record<DatamoonAudienceImportRecordStatus, number> {
  const counts: Record<DatamoonAudienceImportRecordStatus, number> = {
    preview: 0,
    duplicate: 0,
    imported: 0,
    skipped: 0,
    error: 0,
  }
  for (const record of records) {
    counts[record.status] += 1
  }
  return counts
}

export function buildGrowthMissionAvaLaunchZeroPreviewDebug(input: {
  run: DatamoonAudienceImportRun
  records: DatamoonAudienceImportRecord[]
  importRequest: DatamoonAudienceImportRequest
}): GrowthMissionAvaLaunchZeroPreviewDebug {
  const metadata = input.run.providerMetadata ?? {}

  return {
    qa_marker: GROWTH_DATAMOON_ZERO_RESULTS_RESPONSE_TRACE_1_QA_MARKER,
    reason: "zero_preview_import_trace",
    runId: input.run.id,
    datamoonAudienceId: input.run.datamoonAudienceId,
    provider_status: readMetadataString(metadata, "poll_status"),
    run_status: input.run.status,
    record_count: input.run.recordCount,
    preview_count: input.run.previewCount,
    skipped_count: input.run.skippedCount,
    duplicate_count: input.run.duplicateCount,
    imported_count: input.run.importedCount,
    loading_count: input.run.loadingCount,
    provider_metadata: {
      poll_status: readMetadataString(metadata, "poll_status"),
      fetch_response_keys: readMetadataStringArray(metadata, "fetch_response_keys"),
    },
    filters: input.importRequest.filters,
    topic_ids: input.importRequest.topic_ids ?? input.run.topicIds,
    audience_type: input.importRequest.audience_type,
    omittedWorkbenchFilterFields: input.importRequest.workbench_context?.omittedWorkbenchFilterFields ?? [],
    childRecordStatusCounts: countChildRecordStatuses(input.records),
    childRecordSamples: input.records.slice(0, 3).map((record) => ({
      recordIndex: record.recordIndex,
      status: record.status,
      message: record.message,
    })),
  }
}

export function growthMissionAvaLaunchZeroPreviewDebugContainsPii(debug: GrowthMissionAvaLaunchZeroPreviewDebug): boolean {
  const serialized = JSON.stringify(debug).toLowerCase()
  if (serialized.includes("@")) return true
  for (const key of GROWTH_MISSION_AVA_LAUNCH_ZERO_PREVIEW_DEBUG_PII_KEYS) {
    if (serialized.includes(`"${key.toLowerCase()}"`)) return true
  }
  return false
}
