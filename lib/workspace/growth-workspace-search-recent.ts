/** Local recent workspace searches — no server persistence. */

export const GROWTH_WORKSPACE_SEARCH_RECENT_STORAGE_KEY = "equipify:growth-workspace:search-recent/v1" as const
export const GROWTH_WORKSPACE_SEARCH_RECENT_LIMIT = 6 as const

export type GrowthWorkspaceSearchRecentEntry = {
  query: string
  searchedAt: string
}

export function readGrowthWorkspaceSearchRecent(): GrowthWorkspaceSearchRecentEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(GROWTH_WORKSPACE_SEARCH_RECENT_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as GrowthWorkspaceSearchRecentEntry[]
    return Array.isArray(parsed) ? parsed.slice(0, GROWTH_WORKSPACE_SEARCH_RECENT_LIMIT) : []
  } catch {
    return []
  }
}

export function recordGrowthWorkspaceSearchRecent(query: string): void {
  if (typeof window === "undefined") return
  const trimmed = query.trim()
  if (trimmed.length < 2) return
  const existing = readGrowthWorkspaceSearchRecent().filter(
    (entry) => entry.query.toLowerCase() !== trimmed.toLowerCase(),
  )
  const next: GrowthWorkspaceSearchRecentEntry[] = [
    { query: trimmed, searchedAt: new Date().toISOString() },
    ...existing,
  ].slice(0, GROWTH_WORKSPACE_SEARCH_RECENT_LIMIT)
  try {
    window.localStorage.setItem(GROWTH_WORKSPACE_SEARCH_RECENT_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore quota errors
  }
}
