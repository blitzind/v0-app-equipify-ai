/** Local Growth workspace activity memory — recent views and continue-working cards. */

export const GROWTH_WORKSPACE_ACTIVITY_QA_MARKER = "growth-workspace-activity-v1" as const

export const GROWTH_WORKSPACE_RECENT_VIEWS_KEY = "equipify:growth-workspace:recent-views/v1" as const
export const GROWTH_WORKSPACE_CONTINUE_KEY = "equipify:growth-workspace:continue/v1" as const
export const GROWTH_WORKSPACE_QUICK_ACTION_USAGE_KEY = "equipify:growth-workspace:quick-action-usage/v1" as const

export type GrowthWorkspaceRecentViewType = "lead" | "opportunity" | "inbox" | "meeting"

export type GrowthWorkspaceRecentView = {
  id: string
  type: GrowthWorkspaceRecentViewType
  title: string
  subtitle?: string | null
  href: string
  viewedAt: string
}

export type GrowthWorkspaceContinueType = "lead" | "campaign" | "opportunity" | "conversation"

export type GrowthWorkspaceContinueItem = {
  id: string
  type: GrowthWorkspaceContinueType
  title: string
  subtitle?: string | null
  href: string
  lastOpenedAt: string
}

function readJson<T>(key: string): T[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as T[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeJson<T>(key: string, value: T[]): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

function upsertById<T extends { id: string; viewedAt?: string; lastOpenedAt?: string }>(
  items: T[],
  next: T,
  limit: number,
): T[] {
  return [next, ...items.filter((item) => item.id !== next.id)].slice(0, limit)
}

export function readGrowthWorkspaceRecentViews(): GrowthWorkspaceRecentView[] {
  return readJson<GrowthWorkspaceRecentView>(GROWTH_WORKSPACE_RECENT_VIEWS_KEY).slice(0, 8)
}

export function readGrowthWorkspaceContinueItems(): GrowthWorkspaceContinueItem[] {
  const order: GrowthWorkspaceContinueType[] = ["lead", "campaign", "opportunity", "conversation"]
  const items = readJson<GrowthWorkspaceContinueItem>(GROWTH_WORKSPACE_CONTINUE_KEY)
  return order
    .map((type) => items.find((item) => item.type === type))
    .filter((item): item is GrowthWorkspaceContinueItem => Boolean(item))
}

export function recordGrowthWorkspaceRecentView(entry: Omit<GrowthWorkspaceRecentView, "viewedAt">): void {
  writeJson(
    GROWTH_WORKSPACE_RECENT_VIEWS_KEY,
    upsertById(readGrowthWorkspaceRecentViews(), { ...entry, viewedAt: new Date().toISOString() }, 8),
  )
}

export function recordGrowthWorkspaceContinueItem(entry: Omit<GrowthWorkspaceContinueItem, "lastOpenedAt">): void {
  const existing = readJson<GrowthWorkspaceContinueItem>(GROWTH_WORKSPACE_CONTINUE_KEY)
  const merged = upsertById(existing, { ...entry, lastOpenedAt: new Date().toISOString() }, 8)
  writeJson(GROWTH_WORKSPACE_CONTINUE_KEY, merged)
}

export function recordGrowthWorkspaceQuickActionUsage(actionId: string): void {
  const counts = readJson<{ id: string; count: number; lastUsedAt: string }>(
    GROWTH_WORKSPACE_QUICK_ACTION_USAGE_KEY,
  )
  const existing = counts.find((row) => row.id === actionId)
  const next = existing
    ? { ...existing, count: existing.count + 1, lastUsedAt: new Date().toISOString() }
    : { id: actionId, count: 1, lastUsedAt: new Date().toISOString() }
  writeJson(
    GROWTH_WORKSPACE_QUICK_ACTION_USAGE_KEY,
    [next, ...counts.filter((row) => row.id !== actionId)].slice(0, 20),
  )
}

export function readGrowthWorkspaceQuickActionUsage(): Array<{ id: string; count: number; lastUsedAt: string }> {
  return readJson(GROWTH_WORKSPACE_QUICK_ACTION_USAGE_KEY)
}

/** Derive recent/continue entries from workspace pathname changes (shell-level only). */
export function resolveGrowthWorkspaceActivityFromPathname(pathname: string): {
  recent?: Omit<GrowthWorkspaceRecentView, "viewedAt">
  continueItem?: Omit<GrowthWorkspaceContinueItem, "lastOpenedAt">
} | null {
  const leadMatch = pathname.match(/^\/growth\/leads\/([^/]+)$/)
  if (leadMatch && leadMatch[1] && !["crm", "queue", "captured", "lead-engine"].includes(leadMatch[1]!)) {
    const leadId = leadMatch[1]!
    const href = `/growth/leads/${encodeURIComponent(leadId)}`
    return {
      recent: { id: `lead:${leadId}`, type: "lead", title: "Lead detail", subtitle: leadId, href },
      continueItem: { id: `continue-lead:${leadId}`, type: "lead", title: "Resume lead", subtitle: "Pick up where you left off", href },
    }
  }

  if (pathname === "/growth/opportunities" || pathname.startsWith("/growth/opportunities/")) {
    const href = pathname.startsWith("/growth/opportunities/pipeline")
      ? "/growth/opportunities/pipeline"
      : "/growth/opportunities"
    return {
      recent: { id: `opportunity:${href}`, type: "opportunity", title: "Opportunities", href },
      continueItem: { id: "continue-opportunity", type: "opportunity", title: "Resume opportunity", subtitle: "Return to pipeline work", href },
    }
  }

  if (pathname === "/growth/inbox" || pathname.startsWith("/growth/inbox/")) {
    return {
      recent: { id: "inbox:workspace", type: "inbox", title: "Inbox", href: "/growth/inbox" },
    }
  }

  if (pathname === "/growth/meetings" || pathname.startsWith("/growth/meetings/")) {
    return {
      recent: { id: "meetings:workspace", type: "meeting", title: "Meetings", href: "/growth/meetings" },
    }
  }

  if (pathname === "/growth/campaigns" || pathname.startsWith("/growth/campaigns/")) {
    return {
      continueItem: { id: "continue-campaign", type: "campaign", title: "Resume campaign", subtitle: "Continue sequence work", href: "/growth/campaigns" },
    }
  }

  if (pathname === "/growth/conversations" || pathname.startsWith("/growth/conversations/")) {
    return {
      continueItem: {
        id: "continue-conversation",
        type: "conversation",
        title: "Resume conversation",
        subtitle: "Review active threads",
        href: "/growth/conversations",
      },
    }
  }

  return null
}
