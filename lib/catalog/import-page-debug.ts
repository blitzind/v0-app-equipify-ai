/** Dev-only client debug for catalog import page. */

export type CatalogImportDebugEntry = {
  at: string
  stage: string
  detail?: Record<string, unknown>
}

const MAX_ENTRIES = 40

export function isCatalogImportPageDebugEnabled(): boolean {
  if (typeof window === "undefined") return false
  if (process.env.NODE_ENV !== "production") return true
  try {
    return window.localStorage.getItem("equipify.catalogImport.debug") === "1"
  } catch {
    return false
  }
}

export function pushCatalogImportDebug(
  entries: CatalogImportDebugEntry[],
  stage: string,
  detail?: Record<string, unknown>,
): CatalogImportDebugEntry[] {
  if (!isCatalogImportPageDebugEnabled()) {
    console.debug("[catalog-import]", stage, detail ?? {})
    return entries
  }
  const next = [...entries, { at: new Date().toISOString(), stage, detail }]
  return next.length > MAX_ENTRIES ? next.slice(next.length - MAX_ENTRIES) : next
}
