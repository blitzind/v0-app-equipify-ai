/** Prospect Search filter UX — accordion sections, expand/collapse, diagnostics. Client-safe. */

export const GROWTH_PROSPECT_SEARCH_FILTER_UX_QA_MARKER =
  "growth-prospect-search-filter-ux-v1" as const

export const PROSPECT_SEARCH_FILTER_ACCORDION_SECTIONS = [
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

export type ProspectSearchFilterAccordionSection =
  (typeof PROSPECT_SEARCH_FILTER_ACCORDION_SECTIONS)[number]

export function allProspectSearchFilterSectionsExpanded(
  expanded: readonly string[],
): boolean {
  return PROSPECT_SEARCH_FILTER_ACCORDION_SECTIONS.every((id) => expanded.includes(id))
}

export function allProspectSearchFilterSectionsCollapsed(expanded: readonly string[]): boolean {
  return expanded.length === 0
}

export function safeProspectSearchFilterAccordionSections(
  value: string[] | null | undefined,
): string[] {
  if (!Array.isArray(value)) return []
  const allowed = new Set<string>(PROSPECT_SEARCH_FILTER_ACCORDION_SECTIONS)
  return value.filter((id) => typeof id === "string" && allowed.has(id))
}

/** Client-safe diagnostics — no secrets, console warnings only. */
export function logProspectSearchFilterUxIssue(
  code: string,
  context: Record<string, string | null | undefined> = {},
): void {
  if (typeof console === "undefined" || typeof console.warn !== "function") return
  console.warn(`[${GROWTH_PROSPECT_SEARCH_FILTER_UX_QA_MARKER}]`, code, context)
}
