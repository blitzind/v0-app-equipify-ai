/** Client-safe Growth Engine import types. */

export const GROWTH_IMPORT_VENDOR_KEYS = ["manual_csv", "seamless", "apollo"] as const

export type GrowthImportVendorKey = (typeof GROWTH_IMPORT_VENDOR_KEYS)[number]

export const GROWTH_IMPORT_BATCH_STATUSES = [
  "running",
  "completed",
  "partial",
  "failed",
  "cancelled",
] as const

export type GrowthImportBatchStatus = (typeof GROWTH_IMPORT_BATCH_STATUSES)[number]

export const GROWTH_IMPORT_BATCH_ROW_STATUSES = [
  "pending",
  "validated",
  "imported",
  "updated",
  "skipped",
  "duplicate",
  "error",
] as const

export type GrowthImportBatchRowStatus = (typeof GROWTH_IMPORT_BATCH_ROW_STATUSES)[number]

export const GROWTH_IMPORT_ROW_ACTIONS = ["create_new", "merge", "skip"] as const

export type GrowthImportRowAction = (typeof GROWTH_IMPORT_ROW_ACTIONS)[number]

export const GROWTH_IMPORT_BATCH_EVENT_TYPES = [
  "batch_created",
  "file_uploaded",
  "preview_generated",
  "mapping_saved",
  "dry_run_completed",
  "commit_started",
  "commit_row",
  "commit_completed",
  "commit_failed",
  "batch_cancelled",
] as const

export type GrowthImportBatchEventType = (typeof GROWTH_IMPORT_BATCH_EVENT_TYPES)[number]

export const GROWTH_IMPORT_CANONICAL_FIELDS = [
  "company_name",
  "first_name",
  "last_name",
  "contact_name",
  "email",
  "phone",
  "website",
  "linkedin_url",
  "title",
  "address_line1",
  "city",
  "state",
  "postal_code",
  "country",
  "notes",
  "external_ref",
] as const

export type GrowthImportCanonicalField = (typeof GROWTH_IMPORT_CANONICAL_FIELDS)[number]

export type GrowthImportColumnMapping = Partial<Record<GrowthImportCanonicalField, string>>

export const GROWTH_IMPORT_DUPLICATE_STRATEGIES = [
  "skip_high_confidence",
  "merge_empty_fields",
  "create_new",
] as const

export type GrowthImportDuplicateStrategy = (typeof GROWTH_IMPORT_DUPLICATE_STRATEGIES)[number]

export type GrowthImportBatchOptions = {
  duplicateStrategy?: GrowthImportDuplicateStrategy
  dryRun?: boolean
  phase?: "uploaded" | "mapped" | "validated" | "dry_run" | "committed"
  seamlessExportType?: "clean" | "raw" | "custom"
  autoTags?: string[]
}

export type NormalizedImportRow = {
  companyName: string
  contactName: string | null
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  website: string | null
  linkedinUrl: string | null
  title: string | null
  addressLine1: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
  notes: string | null
  externalRef: string | null
}

export type ImportValidationIssue = {
  code: string
  message: string
  severity: "error" | "warning"
}

export type GrowthImportBatch = {
  id: string
  batchName: string
  sourceVendor: GrowthImportVendorKey | string
  sourceChannel: string | null
  sourceCampaign: string | null
  vendorSchemaVersion: string
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
  createdBy: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthImportBatchRow = {
  id: string
  batchId: string
  rowIndex: number
  status: GrowthImportBatchRowStatus
  action: GrowthImportRowAction | null
  leadId: string | null
  dedupeKey: string | null
  dedupeConfidence: number | null
  matchedLeadId: string | null
  sourcePayload: Record<string, string>
  normalizedPayload: NormalizedImportRow
  codes: string[]
  message: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthImportBatchEvent = {
  id: string
  batchId: string
  eventType: GrowthImportBatchEventType
  title: string
  summary: string | null
  payload: Record<string, unknown>
  actorUserId: string | null
  actorEmail: string | null
  occurredAt: string
  createdAt: string
}

export type GrowthImportMappingProfile = {
  id: string
  name: string
  sourceVendor: string
  columnMapping: GrowthImportColumnMapping
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type DedupeMatch = {
  leadId: string
  rule: string
  confidence: number
  dedupeKey: string
}

export type ImportRowPreview = {
  rowIndex: number
  normalized: NormalizedImportRow
  issues: ImportValidationIssue[]
  dedupe: DedupeMatch | null
  proposedAction: GrowthImportRowAction
  contactabilityScore: number
  estimatedCallReady: boolean
}

export type ImportPreviewStats = {
  avgContactabilityScore: number
  estimatedCallReadyLeads: number
}

export type ImportPipelineSummary = {
  imported: number
  updated: number
  skipped: number
  duplicate: number
  error: number
  emailFillPercent: number
  phoneFillPercent: number
  websiteFillPercent: number
  decisionMakerFillPercent: number
  importQualityScore: number
  avgContactabilityScore: number
  estimatedCallReadyLeads: number
}
