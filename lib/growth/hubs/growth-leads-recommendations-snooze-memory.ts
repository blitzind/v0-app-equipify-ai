/** Local snooze state for Leads operator recommendations (UX-AUDIT-4). Client-safe. */

export const GROWTH_LEADS_RECOMMENDATIONS_SNOOZED_STORAGE_KEY =
  "equipify:growth-leads-recommendations-snoozed/v1" as const
export const GROWTH_LEADS_RECOMMENDATIONS_SNOOZE_QA_MARKER = "growth-leads-recommendations-snooze-v1" as const

type SnoozedEntry = {
  id: string
  snoozedAt: string
}

function readJson(): SnoozedEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(GROWTH_LEADS_RECOMMENDATIONS_SNOOZED_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as SnoozedEntry[]) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeJson(entries: SnoozedEntry[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(GROWTH_LEADS_RECOMMENDATIONS_SNOOZED_STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // ignore
  }
}

export function readSnoozedGrowthLeadsRecommendationIds(): Set<string> {
  return new Set(readJson().map((entry) => entry.id))
}

export function snoozeGrowthLeadsRecommendation(id: string): void {
  const next: SnoozedEntry = { id, snoozedAt: new Date().toISOString() }
  writeJson([next, ...readJson().filter((entry) => entry.id !== id)])
}

export function unsnoozeGrowthLeadsRecommendation(id: string): void {
  writeJson(readJson().filter((entry) => entry.id !== id))
}
