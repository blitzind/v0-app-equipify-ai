/** Local activity timeline for the Inbox operator home (UX-AUDIT-7). Client-safe. */

export const GROWTH_INBOX_RECENT_WORK_STORAGE_KEY = "equipify:growth-inbox-recent-work/v1" as const
export const GROWTH_INBOX_RECENT_WORK_QA_MARKER = "growth-inbox-recent-work-v1" as const

export type GrowthInboxActivityKind = "thread" | "lead" | "meeting" | "workflow"

export type GrowthInboxActivityItem = {
  id: string
  kind: GrowthInboxActivityKind
  label: string
  href: string
  viewedAt: string
}

const LIMIT = 25

function readJson(): GrowthInboxActivityItem[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(GROWTH_INBOX_RECENT_WORK_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as GrowthInboxActivityItem[]) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeJson(items: GrowthInboxActivityItem[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(GROWTH_INBOX_RECENT_WORK_STORAGE_KEY, JSON.stringify(items.slice(0, LIMIT)))
  } catch {
    // ignore
  }
}

export function formatGrowthInboxActivityRelativeTime(viewedAt: string): string {
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

export function formatGrowthInboxActivityLine(item: GrowthInboxActivityItem): string {
  const prefix =
    item.kind === "thread"
      ? "Opened thread"
      : item.kind === "lead"
        ? "Viewed lead"
        : item.kind === "meeting"
          ? "Reviewed meeting"
          : "Inspected workflow"
  return `${prefix}: ${item.label}`
}

export function readGrowthInboxActivityTimeline(): GrowthInboxActivityItem[] {
  return readJson().slice(0, LIMIT)
}

export function recordGrowthInboxActivity(entry: Omit<GrowthInboxActivityItem, "viewedAt">): void {
  const next: GrowthInboxActivityItem = { ...entry, viewedAt: new Date().toISOString() }
  writeJson([next, ...readJson().filter((item) => item.id !== next.id)])
}

export function inferGrowthInboxActivityKind(href: string): GrowthInboxActivityKind {
  if (href.includes("/inbox/workflow")) return "workflow"
  if (href.includes("/meetings") || href.includes("/bookings")) return "meeting"
  if (href.includes("/leads/")) return "lead"
  return "thread"
}
