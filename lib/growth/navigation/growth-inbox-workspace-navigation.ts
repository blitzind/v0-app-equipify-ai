/**
 * Inbox workspace tab navigation (Phase 7G).
 *
 * Overview and Workflow are contextual tabs under Inbox — Replies are filters, not routes.
 */

import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"

export const GROWTH_INBOX_WORKSPACE_NAV_QA_MARKER = "growth-inbox-workspace-nav-v1" as const

export type GrowthInboxWorkspaceTab = {
  id: string
  label: string
  href: string
  description: string
}

export const GROWTH_INBOX_WORKSPACE_TABS: GrowthInboxWorkspaceTab[] = [
  {
    id: "overview",
    label: "Overview",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/inbox`,
    description:
      "Unified operator inbox — thread queue, conversation, action center, operator notifications, and reply intelligence.",
  },
  {
    id: "workflow",
    label: "Workflow",
    href: `${GROWTH_WORKSPACE_BASE_PATH}/inbox/workflow`,
    description:
      "Follow-up actions, human intervention, opportunity creation, meeting handling, and workflow execution.",
  },
]

const TAB_ROUTES = new Set(GROWTH_INBOX_WORKSPACE_TABS.map((tab) => tab.href))

export function isGrowthInboxTabRoute(pathname: string): boolean {
  return TAB_ROUTES.has(pathname)
}

export function resolveGrowthInboxActiveTabId(pathname: string): string | null {
  if (pathname === `${GROWTH_WORKSPACE_BASE_PATH}/inbox`) return "overview"
  if (pathname === `${GROWTH_WORKSPACE_BASE_PATH}/inbox/workflow`) return "workflow"
  return null
}

export function getGrowthInboxWorkspaceTabById(id: string): GrowthInboxWorkspaceTab | null {
  return GROWTH_INBOX_WORKSPACE_TABS.find((tab) => tab.id === id) ?? null
}
