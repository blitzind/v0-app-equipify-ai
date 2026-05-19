/** Structured CSV catalog import logs — enable with CATALOG_CSV_IMPORT_DEBUG=1 or in development. */

export function isCatalogCsvImportDebugEnabled(): boolean {
  if (process.env.CATALOG_CSV_IMPORT_DEBUG === "1") return true
  return process.env.NODE_ENV === "development"
}

export function logCatalogCsvImport(stage: string, data: Record<string, unknown>): void {
  if (!isCatalogCsvImportDebugEnabled()) return
  console.info("[catalog-csv-import]", JSON.stringify({ stage, ...data }))
}
