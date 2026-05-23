/** Growth Engine CSV import limits (sync pipeline). */

export const GROWTH_IMPORTS_BUCKET = "growth-imports"

export const GROWTH_IMPORT_MAX_ROWS = 5000

export const GROWTH_IMPORT_MAX_BYTES = 30 * 1024 * 1024

export const GROWTH_IMPORT_PREVIEW_ROWS = 50

export const GROWTH_IMPORT_COMMIT_CHUNK_SIZE = 100

export const GROWTH_IMPORT_VENDOR_SCHEMA_VERSION = "1"

export const GROWTH_SEAMLESS_VENDOR_SCHEMA_VERSION = "2"

export const GROWTH_SEAMLESS_EXPORT_TYPES = ["clean", "raw", "custom"] as const

export type GrowthSeamlessExportType = (typeof GROWTH_SEAMLESS_EXPORT_TYPES)[number]

export const GROWTH_IMPORT_DEDUPE_SKIP_THRESHOLD = 0.85

export const GROWTH_IMPORT_DEDUPE_MERGE_THRESHOLD = 0.7
