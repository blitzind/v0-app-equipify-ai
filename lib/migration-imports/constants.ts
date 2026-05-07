/** Private bucket for CSV / tabular migration uploads (server-side uploads). */
export const ORGANIZATION_IMPORTS_BUCKET = "organization-imports"

/** Sync processing limit — larger files should be split (future async jobs). */
export const MIGRATION_IMPORT_MAX_ROWS = 5000

export const MIGRATION_IMPORT_MAX_BYTES = 30 * 1024 * 1024
