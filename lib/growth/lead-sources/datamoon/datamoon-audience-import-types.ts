/** GE-DATAMOON-1B — Datamoon audience import types. Client-safe. */

import type { DatamoonAudienceFilter, DatamoonAudienceType } from "@/lib/growth/providers/datamoon"
import type { DatamoonAudienceMode } from "@/lib/growth/providers/datamoon/datamoon-config"

export const GROWTH_DATAMOON_AUDIENCE_IMPORT_QA_MARKER =
  "growth-datamoon-audience-import-ge-datamoon-1b-v1" as const

export const GROWTH_DATAMOON_AUDIENCE_IMPORT_SCHEMA_MIGRATION =
  "20270830120000_growth_datamoon_audience_import_ge_datamoon_1b.sql" as const

export const DATAMOON_MAX_TOPIC_IDS = 5 as const

export const DATAMOON_EXT_OUTPUT_FIELDS = [
  "first_name",
  "last_name",
  "personal_emails",
  "personal_phone",
  "linkedin_url",
  "personal_address",
  "personal_address_2",
  "personal_city",
  "personal_state",
  "personal_zip",
  "personal_zip4",
  "contact_country",
  "business_email",
] as const

export type DatamoonExtOutputField = (typeof DATAMOON_EXT_OUTPUT_FIELDS)[number]

export const GROWTH_DATAMOON_AUDIENCE_IMPORT_RUN_STATUSES = [
  "pending_build",
  "building",
  "completed",
  "failed",
  "importing",
  "imported",
  "imported_partial",
] as const

export type DatamoonAudienceImportRunStatus = (typeof GROWTH_DATAMOON_AUDIENCE_IMPORT_RUN_STATUSES)[number]

export const GROWTH_DATAMOON_AUDIENCE_IMPORT_RECORD_STATUSES = [
  "preview",
  "duplicate",
  "imported",
  "skipped",
  "error",
] as const

export type DatamoonAudienceImportRecordStatus =
  (typeof GROWTH_DATAMOON_AUDIENCE_IMPORT_RECORD_STATUSES)[number]

export type DatamoonAudienceImportRequest = {
  run_name: string
  audience_type: DatamoonAudienceType
  filters: DatamoonAudienceFilter[]
  topic_ids?: string[]
  limit?: number
  name?: string
  website_id?: string
  provider_mode?: DatamoonAudienceMode
}

export type DatamoonNormalizedLeadRecord = {
  first_name: string | null
  last_name: string | null
  contact_name: string | null
  business_email: string | null
  personal_emails: string | null
  email: string | null
  personal_phone: string | null
  phone: string | null
  linkedin_url: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string | null
  company_name: string | null
  company_domain: string | null
  source: "datamoon"
  source_confidence: "provider" | "default"
}

export type DatamoonAudienceImportRun = {
  id: string
  runName: string
  datamoonAudienceId: string | null
  providerMode: DatamoonAudienceMode
  audienceType: DatamoonAudienceType
  filters: DatamoonAudienceFilter[]
  topicIds: string[]
  requestedLimit: number | null
  audienceName: string | null
  websiteId: string | null
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
  dryRun: boolean
  createdBy: string | null
  lastPolledAt: string | null
  completedAt: string | null
  importedAt: string | null
  createdAt: string
  updatedAt: string
}

export type DatamoonAudienceImportRecord = {
  id: string
  runId: string
  recordIndex: number
  status: DatamoonAudienceImportRecordStatus
  normalized: DatamoonNormalizedLeadRecord
  dedupeRule: string | null
  dedupeKey: string | null
  matchedLeadId: string | null
  leadId: string | null
  message: string | null
  createdAt: string
  updatedAt: string
}

export type DatamoonAudienceImportValidationIssue = {
  code: string
  field?: string
  message: string
}
