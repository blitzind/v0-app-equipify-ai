/** Resume last session helpers (UX-AUDIT-5). Client-safe. */

import type { GrowthLeadsActivityItem } from "@/lib/growth/hubs/growth-leads-recent-work-memory"
import { formatGrowthLeadsActivityRelativeTime } from "@/lib/growth/hubs/growth-leads-recent-work-memory"
import { GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF } from "@/lib/growth/hubs/growth-workspace-hub-paths"

export const GROWTH_LEADS_HUB_RESUME_SESSION_QA_MARKER = "growth-leads-hub-resume-session-v1" as const

export type GrowthLeadsResumeSessionView = {
  category: string
  title: string
  relativeTime: string
  href: string
}

export function inferGrowthLeadsResumeSessionCategory(href: string, verb: string): string {
  if (href.includes("savedSearchId=")) return "Saved Search"
  if (href.includes("/prospect-search")) return "Prospect Search"
  if (href.includes("/research")) return "Revenue Queue"
  if (href.includes("/campaigns")) return "Campaign"
  if (href.match(/\/growth\/leads\/[^/]+$/) && !href.includes("/leads/crm") && !href.includes("/leads/queue")) {
    return "Lead"
  }
  if (verb === "Ran") return "Saved Search"
  return "Company"
}

export function buildGrowthLeadsResumeSessionView(
  item: GrowthLeadsActivityItem | undefined,
): GrowthLeadsResumeSessionView | null {
  if (!item) return null
  if (item.href === GROWTH_LEADS_HUB_PROSPECT_SEARCH_HREF && item.label === "Prospect Search") {
    return {
      category: "Prospect Search",
      title: "Prospect Search workspace",
      relativeTime: formatGrowthLeadsActivityRelativeTime(item.viewedAt),
      href: item.href,
    }
  }
  return {
    category: inferGrowthLeadsResumeSessionCategory(item.href, item.verb),
    title: item.label,
    relativeTime: formatGrowthLeadsActivityRelativeTime(item.viewedAt),
    href: item.href,
  }
}
