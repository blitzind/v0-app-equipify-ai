/** Local activity timeline for the Leads operator home (UX-AUDIT-4). Client-safe. */

export const GROWTH_LEADS_RECENT_WORK_STORAGE_KEY = "equipify:growth-leads-recent-work/v2" as const
export const GROWTH_LEADS_RECENT_WORK_LEGACY_STORAGE_KEY = "equipify:growth-leads-recent-work/v1" as const
export const GROWTH_LEADS_RECENT_WORK_QA_MARKER = "growth-leads-recent-work-v2" as const

export type GrowthLeadsActivityItem = {
  id: string
  verb: string
  label: string
  href: string
  viewedAt: string
}

const LIMIT = 25

function readJson(): GrowthLeadsActivityItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(GROWTH_LEADS_RECENT_WORK_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as GrowthLeadsActivityItem[]) : []
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
    return migrateLegacyV1()
  } catch {
    return []
  }
}

function migrateLegacyV1(): GrowthLeadsActivityItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(GROWTH_LEADS_RECENT_WORK_LEGACY_STORAGE_KEY)
    if (!raw) return []
    const legacy = JSON.parse(raw) as Array<{ id: string; kind?: string; title: string; href: string; viewedAt: string }>
    if (!Array.isArray(legacy)) return []
    const migrated = legacy.map((item) => ({
      id: item.id,
      verb: inferActivityVerb(item.href, item.kind),
      label: item.title,
      href: item.href,
      viewedAt: item.viewedAt,
    }))
    writeJson(migrated)
    return migrated
  } catch {
    return []
  }
}

function writeJson(items: GrowthLeadsActivityItem[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(GROWTH_LEADS_RECENT_WORK_STORAGE_KEY, JSON.stringify(items.slice(0, LIMIT)))
  } catch {
    // ignore
  }
}

function inferActivityVerb(href: string, kind?: string): string {
  if (href.includes("savedSearchId=") || kind === "search") return "Ran"
  if (href.includes("/research") || href.includes("/queue")) return "Opened"
  if (href.includes("/campaigns")) return "Opened"
  if (href.includes("/share-pages")) return "Viewed"
  return "Opened"
}

export function formatGrowthLeadsActivityLine(item: GrowthLeadsActivityItem): string {
  return `${item.verb} ${item.label}`
}

export function formatGrowthLeadsActivityRelativeTime(viewedAt: string): string {
  const deltaMs = Date.now() - new Date(viewedAt).getTime()
  if (!Number.isFinite(deltaMs) || deltaMs < 0) return "just now"
  const minutes = Math.floor(deltaMs / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function readGrowthLeadsActivityTimeline(): GrowthLeadsActivityItem[] {
  return readJson().slice(0, LIMIT)
}

export function recordGrowthLeadsActivity(entry: Omit<GrowthLeadsActivityItem, "viewedAt">): void {
  const next: GrowthLeadsActivityItem = { ...entry, viewedAt: new Date().toISOString() }
  writeJson([next, ...readJson().filter((item) => item.id !== next.id)])
}

/** @deprecated Use recordGrowthLeadsActivity — kept for incremental migration. */
export function recordGrowthLeadsRecentWork(entry: {
  id: string
  kind?: string
  title: string
  href: string
}): void {
  recordGrowthLeadsActivity({
    id: entry.id,
    verb: inferActivityVerb(entry.href, entry.kind),
    label: entry.title,
    href: entry.href,
  })
}

export function inferGrowthLeadsRecentWorkKind(href: string): string {
  if (href.includes("/campaigns")) return "campaign"
  if (href.includes("savedSearchId=") || href.includes("/prospect-search")) return "search"
  if (href.match(/\/growth\/leads\/[^/]+$/) && !href.includes("/leads/crm") && !href.includes("/leads/queue")) {
    return "lead"
  }
  return "company"
}
