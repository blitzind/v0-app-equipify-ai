/** Persisted filter accordion expansion — collapsed by default on first load. */

export const GROWTH_SEARCH_FILTERS_COLLAPSED_DEFAULT_QA_MARKER =
  "growth-search-filters-collapsed-default-v1" as const

export const PROSPECT_SEARCH_FILTER_ACCORDION_STORAGE_KEY =
  "growth-prospect-search-filter-sections-v2" as const

const LEGACY_FILTER_ACCORDION_STORAGE_KEYS = [
  "growth-prospect-search-filter-sections",
  "growth-prospect-search-filter-sections-v1",
] as const

const FILTER_SECTION_IDS = [
  "industry",
  "company-size",
  "location",
  "territory",
  "intent",
  "technology",
  "title-targeting",
  "revenue",
  "confidence-fit",
  "account-safety",
] as const

function isValidSectionId(value: unknown): value is (typeof FILTER_SECTION_IDS)[number] {
  return typeof value === "string" && (FILTER_SECTION_IDS as readonly string[]).includes(value)
}

/** Remove legacy expanded-state keys so collapsed-default applies once. */
export function migrateProspectSearchFilterAccordionStorage(): void {
  if (typeof window === "undefined") return
  for (const key of LEGACY_FILTER_ACCORDION_STORAGE_KEYS) {
    window.localStorage.removeItem(key)
  }
}

export function readProspectSearchFilterAccordionExpanded(): string[] {
  if (typeof window === "undefined") return []
  migrateProspectSearchFilterAccordionStorage()
  try {
    const raw = window.localStorage.getItem(PROSPECT_SEARCH_FILTER_ACCORDION_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidSectionId)
  } catch {
    return []
  }
}

export function writeProspectSearchFilterAccordionExpanded(sections: string[]): void {
  if (typeof window === "undefined") return
  const valid = sections.filter(isValidSectionId)
  window.localStorage.setItem(PROSPECT_SEARCH_FILTER_ACCORDION_STORAGE_KEY, JSON.stringify(valid))
}
