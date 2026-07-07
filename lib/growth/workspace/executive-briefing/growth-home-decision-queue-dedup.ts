/** GE-GROWTH-HOME-DECISION-QUEUE-DEDUP-1 — Canonical Needs Your Decision queue (client-safe). */

import type { GrowthHomeWaitingOnYouItem } from "@/lib/growth/workspace/executive-briefing/growth-home-executive-briefing-types"

export const GROWTH_HOME_DECISION_QUEUE_DEDUP_QA_MARKER = "ge-growth-home-decision-queue-dedup-1-v1" as const

export const GROWTH_HOME_DECISION_QUEUE_EMPTY_MESSAGE =
  "Nothing requires your approval right now." as const

export type GrowthHomeDecisionQueueCategory =
  | "approval"
  | "mailbox"
  | "inbox"
  | "queue"
  | "operator"
  | "priority"
  | "other"

const FILLER_TITLE_PATTERNS = [
  /^follow the launch runbook$/i,
  /^review dashboard metrics$/i,
  /^monitor hot engagement$/i,
] as const

export function normalizeDecisionQueueTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/[.!?]+$/g, "")
}

export function normalizeDecisionQueueHref(href: string | null | undefined): string {
  if (!href) return ""
  try {
    const url = new URL(href, "https://equipify.local")
    return url.pathname.replace(/\/+$/, "") || "/"
  } catch {
    return href.trim().replace(/\/+$/, "") || "/"
  }
}

export function inferDecisionQueueCategory(
  item: Pick<GrowthHomeWaitingOnYouItem, "label" | "href" | "category">,
): GrowthHomeDecisionQueueCategory {
  if (item.category) return item.category
  const title = normalizeDecisionQueueTitle(item.label)
  const href = normalizeDecisionQueueHref(item.href)
  if (/mailbox|reconnect|sender health/i.test(title) || href.includes("/mailboxes")) return "mailbox"
  if (/approve|approval|pending send/i.test(title)) return "approval"
  if (/reply|inbox/i.test(title) || href.includes("/inbox")) return "inbox"
  if (href.includes("/leads/")) return "queue"
  if (/priority|review|opportunity|unblock/i.test(title)) return "priority"
  if (/runbook|metrics|engagement/i.test(title)) return "operator"
  return "other"
}

export function isGrowthHomeDecisionQueueFiller(
  item: Pick<GrowthHomeWaitingOnYouItem, "label">,
): boolean {
  const normalized = normalizeDecisionQueueTitle(item.label)
  return FILLER_TITLE_PATTERNS.some((pattern) => pattern.test(normalized))
}

export function growthHomeDecisionQueueDedupKey(
  item: Pick<GrowthHomeWaitingOnYouItem, "label" | "href" | "category">,
): string {
  const category = inferDecisionQueueCategory(item)
  const title = normalizeDecisionQueueTitle(item.label)
  const href = normalizeDecisionQueueHref(item.href)
  return `${category}|${title}|${href}`
}

function mergeDecisionQueueDetail(existing: string, incoming: string): string {
  if (!existing) return incoming
  if (!incoming || existing === incoming) return existing
  if (existing.includes(incoming) || incoming.includes(existing)) {
    return existing.length >= incoming.length ? existing : incoming
  }
  return `${existing} · ${incoming}`
}

export function dedupeGrowthHomeDecisionQueueItems(
  items: GrowthHomeWaitingOnYouItem[],
): GrowthHomeWaitingOnYouItem[] {
  const merged = new Map<string, GrowthHomeWaitingOnYouItem>()

  for (const item of items) {
    const key = growthHomeDecisionQueueDedupKey(item)
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, {
        ...item,
        category: inferDecisionQueueCategory(item),
        severity: item.severity ?? 0,
      })
      continue
    }

    const severity = Math.max(existing.severity ?? 0, item.severity ?? 0)
    merged.set(key, {
      ...existing,
      severity,
      detail: mergeDecisionQueueDetail(existing.detail, item.detail),
      id: (existing.severity ?? 0) >= (item.severity ?? 0) ? existing.id : item.id,
    })
  }

  return [...merged.values()].sort((a, b) => {
    const severityDiff = (b.severity ?? 0) - (a.severity ?? 0)
    if (severityDiff !== 0) return severityDiff
    return a.label.localeCompare(b.label)
  })
}

export function finalizeGrowthHomeDecisionQueue(
  items: GrowthHomeWaitingOnYouItem[],
  input?: { limit?: number },
): { items: GrowthHomeWaitingOnYouItem[]; overflowCount: number } {
  const limit = input?.limit ?? 5
  const filtered = items.filter((item) => !isGrowthHomeDecisionQueueFiller(item))
  const deduped = dedupeGrowthHomeDecisionQueueItems(filtered)
  return {
    items: deduped.slice(0, limit),
    overflowCount: Math.max(0, deduped.length - limit),
  }
}
