/**
 * Inbox workspace tab navigation (Phase 8A).
 *
 * Inbox — operator communications (thread queue, compact metrics).
 * Workflow — human-in-the-loop execution and reply intelligence.
 * Operations — orchestration, campaigns, and diagnostics.
 */

import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_INBOX_WORKSPACE_NAV_QA_MARKER = "growth-inbox-workspace-nav-v2" as const

export type GrowthInboxWorkspaceTab = {
  id: string
  label: string
  href: string
  description: string
}

export const GROWTH_INBOX_WORKSPACE_TABS: GrowthInboxWorkspaceTab[] = [
  {
    id: "inbox",
    label: "Inbox",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
    description:
      "Operator queue — what needs attention, notifications, conversations, and next actions.",
  },
  {
    id: "workflow",
    label: "Workflow",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/inbox/workflow`,
    description:
      "Human interventions, reply intelligence, sequence preview, and follow-up policy execution.",
  },
  {
    id: "operations",
    label: "Operations",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/inbox/operations`,
    description:
      "Campaign builder, agent orchestration, event bus, and inbox diagnostics — planning surfaces kept out of the operator queue.",
  },
]

const TAB_ROUTES = new Set(GROWTH_INBOX_WORKSPACE_TABS.map((tab) => tab.href))

export function isGrowthInboxTabRoute(pathname: string): boolean {
  return TAB_ROUTES.has(pathname)
}

export function resolveGrowthInboxActiveTabId(pathname: string): string | null {
  if (pathname === `${GROWTH_WORKSPACE_BASE_PATH}/inbox`) return "inbox"
  if (pathname === `${GROWTH_WORKSPACE_BASE_PATH}/inbox/workflow`) return "workflow"
  if (pathname === `${GROWTH_WORKSPACE_BASE_PATH}/inbox/operations`) return "operations"
  return null
}

export function getGrowthInboxWorkspaceTabById(id: string): GrowthInboxWorkspaceTab | null {
  return GROWTH_INBOX_WORKSPACE_TABS.find((tab) => tab.id === id) ?? null
}

/** Phase 8H — hide Operations tab when Tier 2 shell is cold (operator_minimal). */
export function resolveGrowthInboxWorkspaceTabs(options?: { tier2ShellVisible?: boolean }): GrowthInboxWorkspaceTab[] {
  if (options?.tier2ShellVisible === false) {
    return GROWTH_INBOX_WORKSPACE_TABS.filter((tab) => tab.id !== "operations")
  }
  return GROWTH_INBOX_WORKSPACE_TABS
}
