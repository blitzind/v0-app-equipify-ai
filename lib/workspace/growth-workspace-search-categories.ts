/**
 * Growth workspace global search categories — presentation config only.
 * Individual providers attach results per category without duplicating search UI.
 */

import type { GlobalSearchGroup } from "@/lib/global-search/run-global-search"

export const GROWTH_WORKSPACE_SEARCH_QA_MARKER = "growth-workspace-search-v2" as const

export const GROWTH_WORKSPACE_SEARCH_CATEGORIES = [
  { id: "leads", label: "Leads" },
  { id: "campaigns", label: "Campaigns" },
  { id: "inbox_threads", label: "Inbox Threads" },
  { id: "calls", label: "Calls" },
  { id: "meetings", label: "Meetings" },
  { id: "share_pages", label: "Share Pages" },
  { id: "media_assets", label: "Media Assets" },
  { id: "templates", label: "Templates" },
  { id: "opportunities", label: "Opportunities" },
  { id: "conversations", label: "Conversations" },
  { id: "relationships", label: "Relationships" },
] as const

export type GrowthWorkspaceSearchCategoryId = (typeof GROWTH_WORKSPACE_SEARCH_CATEGORIES)[number]["id"]

export const GROWTH_WORKSPACE_SEARCH_PLACEHOLDER =
  "Search leads, campaigns, inbox, calls, meetings…"

export const GROWTH_WORKSPACE_SEARCH_EMPTY_HINT =
  "Try a lead name, company, campaign, or conversation subject."

/** Ensures every configured category exists in the merged result set (empty when no provider yet). */
export function normalizeGrowthWorkspaceSearchGroups(
  partial: GlobalSearchGroup[],
): GlobalSearchGroup[] {
  const byId = new Map(partial.map((group) => [group.id, group]))
  return GROWTH_WORKSPACE_SEARCH_CATEGORIES.map(({ id, label }) => {
    const existing = byId.get(id)
    return existing ?? { id, label, results: [] }
  }).filter((group) => group.results.length > 0)
}
