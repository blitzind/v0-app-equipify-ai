/** Client-side Growth navigation usage memory (Prompt 35). */

export const GROWTH_NAVIGATION_USAGE_STORAGE_KEY = "equipify-growth-nav-usage-v1" as const

export const GROWTH_NAVIGATION_USAGE_MAX_RECENT = 10 as const

export type GrowthNavigationUsageEntry = {
  id: string
  href: string
  label: string
  lastOpenedAt: number
  openCount: number
}

export type GrowthNavigationUsageSnapshot = {
  recent: GrowthNavigationUsageEntry[]
}

export const EMPTY_GROWTH_NAVIGATION_USAGE: GrowthNavigationUsageSnapshot = {
  recent: [],
}

function normalizeHref(href: string): string {
  return href.split("?")[0] ?? href
}

export function readGrowthNavigationUsage(): GrowthNavigationUsageSnapshot {
  if (typeof window === "undefined") return EMPTY_GROWTH_NAVIGATION_USAGE
  try {
    const raw = window.localStorage.getItem(GROWTH_NAVIGATION_USAGE_STORAGE_KEY)
    if (!raw) return EMPTY_GROWTH_NAVIGATION_USAGE
    const parsed = JSON.parse(raw) as Partial<GrowthNavigationUsageSnapshot>
    if (!parsed || !Array.isArray(parsed.recent)) return EMPTY_GROWTH_NAVIGATION_USAGE
    return {
      recent: parsed.recent
        .filter(
          (entry): entry is GrowthNavigationUsageEntry =>
            Boolean(entry) &&
            typeof entry.id === "string" &&
            typeof entry.href === "string" &&
            typeof entry.label === "string" &&
            typeof entry.lastOpenedAt === "number" &&
            typeof entry.openCount === "number",
        )
        .slice(0, GROWTH_NAVIGATION_USAGE_MAX_RECENT),
    }
  } catch {
    return EMPTY_GROWTH_NAVIGATION_USAGE
  }
}

export function writeGrowthNavigationUsage(snapshot: GrowthNavigationUsageSnapshot): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      GROWTH_NAVIGATION_USAGE_STORAGE_KEY,
      JSON.stringify({
        recent: snapshot.recent.slice(0, GROWTH_NAVIGATION_USAGE_MAX_RECENT),
      }),
    )
  } catch {
    // localStorage may be unavailable.
  }
}

export function recordGrowthNavigationUsage(input: {
  id: string
  href: string
  label: string
}): GrowthNavigationUsageSnapshot {
  const normalizedHref = normalizeHref(input.href)
  const now = Date.now()
  const current = readGrowthNavigationUsage()
  const existing = current.recent.find(
    (entry) => entry.id === input.id || normalizeHref(entry.href) === normalizedHref,
  )

  const nextEntry: GrowthNavigationUsageEntry = {
    id: input.id,
    href: input.href,
    label: input.label,
    lastOpenedAt: now,
    openCount: (existing?.openCount ?? 0) + 1,
  }

  const nextRecent = [
    nextEntry,
    ...current.recent.filter(
      (entry) => entry.id !== input.id && normalizeHref(entry.href) !== normalizedHref,
    ),
  ].slice(0, GROWTH_NAVIGATION_USAGE_MAX_RECENT)

  const snapshot = { recent: nextRecent }
  writeGrowthNavigationUsage(snapshot)
  return snapshot
}

export function growthNavigationUsageBoost(
  entry: { id: string; href: string },
  usage: GrowthNavigationUsageSnapshot,
): { recentBoost: number; frequencyBoost: number } {
  const match = usage.recent.find((row) => row.id === entry.id)
  if (!match) return { recentBoost: 0, frequencyBoost: 0 }

  const index = usage.recent.findIndex((row) => row.id === entry.id)
  const recentBoost = index >= 0 ? Math.max(0, 40 - index * 4) : 0
  const frequencyBoost = Math.min(30, match.openCount * 3)
  return { recentBoost, frequencyBoost }
}
