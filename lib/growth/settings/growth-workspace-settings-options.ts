/** Phase 8B — validated option lists for workspace settings forms (client-safe). */

import { GROWTH_INBOX_THREAD_QUEUE_VIEWS } from "@/lib/growth/inbox/inbox-thread-queue-filters"
import { GROWTH_OPPORTUNITIES_WORKSPACE_TABS } from "@/lib/growth/navigation/growth-opportunities-workspace-navigation"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import { listGrowthWorkspaceShellNavHrefs } from "@/lib/growth/navigation/growth-workspace-shell-navigation"
import type {
  GrowthWorkspaceCallsDefaultView,
  GrowthWorkspaceOpportunitiesDefaultTab,
} from "@/lib/growth/settings/growth-workspace-settings-types"

export const GROWTH_WORKSPACE_SETTINGS_TIMEZONE_OPTIONS = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const

export const GROWTH_WORKSPACE_SETTINGS_LANDING_PAGE_OPTIONS = [
  { value: `${GROWTH_WORKSPACE_BASE_PATH}/inbox`, label: "Inbox" },
  { value: `${GROWTH_WORKSPACE_BASE_PATH}/dashboard`, label: "Dashboard" },
  { value: `${GROWTH_WORKSPACE_BASE_PATH}/leads`, label: "Leads" },
  { value: `${GROWTH_WORKSPACE_BASE_PATH}/calls`, label: "Calls" },
  { value: `${GROWTH_WORKSPACE_BASE_PATH}/opportunities`, label: "Opportunities" },
  { value: `${GROWTH_WORKSPACE_BASE_PATH}/conversations`, label: "Conversations" },
] as const

export const GROWTH_WORKSPACE_SETTINGS_CALLS_VIEW_OPTIONS: Array<{
  value: GrowthWorkspaceCallsDefaultView
  label: string
}> = [
  { value: "workspace", label: "Call workspace" },
  { value: "queue", label: "Today's queue" },
  { value: "live", label: "Live calls" },
  { value: "coaching", label: "Live coaching" },
  { value: "overview", label: "Intelligence overview" },
]

export const GROWTH_WORKSPACE_SETTINGS_OPPORTUNITIES_TAB_OPTIONS: Array<{
  value: GrowthWorkspaceOpportunitiesDefaultTab
  label: string
}> = GROWTH_OPPORTUNITIES_WORKSPACE_TABS.map((tab) => ({
  value: tab.id as GrowthWorkspaceOpportunitiesDefaultTab,
  label: tab.label,
}))

export const GROWTH_WORKSPACE_SETTINGS_INBOX_FILTER_OPTIONS = GROWTH_INBOX_THREAD_QUEUE_VIEWS.map((view) => ({
  value: view,
  label: view
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" "),
}))

const SHELL_NAV_HREFS = new Set(listGrowthWorkspaceShellNavHrefs())

export function isGrowthWorkspaceFavoriteDestination(href: string): boolean {
  const trimmed = href.trim()
  if (!trimmed.startsWith(`${GROWTH_WORKSPACE_BASE_PATH}/`)) return false
  return SHELL_NAV_HREFS.has(trimmed) || trimmed === `${GROWTH_WORKSPACE_BASE_PATH}/settings`
}

export function normalizeGrowthWorkspaceFavoriteDestinations(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const normalized: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed || !isGrowthWorkspaceFavoriteDestination(trimmed) || seen.has(trimmed)) continue
    seen.add(trimmed)
    normalized.push(trimmed)
  }
  return normalized
}
