/** Map Command Center briefing links to workspace routes when opened from /growth/*. */

import { GROWTH_WORKSPACE_CANONICAL_ALIASES } from "@/lib/growth/navigation/growth-workspace-cleanup-audit"
import {
  GROWTH_ADMIN_BASE_PATH,
  GROWTH_WORKSPACE_BASE_PATH,
  growthFeaturePath,
} from "@/lib/growth/navigation/growth-workspace-base-path"

export const GROWTH_WORKSPACE_BRIEFING_LINKS_QA_MARKER = "growth-workspace-briefing-links-v1" as const

export function resolveGrowthWorkspaceBriefingHref(href: string): string {
  if (href.startsWith(GROWTH_WORKSPACE_BASE_PATH)) return href
  const adminPrefix = `${GROWTH_ADMIN_BASE_PATH}/`
  if (href.startsWith(adminPrefix)) {
    const segment = href.slice(adminPrefix.length)
    return growthFeaturePath(GROWTH_WORKSPACE_BASE_PATH, segment)
  }
  return href
}

export const GROWTH_WORKSPACE_BRIEFING_OPERATIONAL_LINKS = {
  mailboxHealth: GROWTH_WORKSPACE_CANONICAL_ALIASES.connectedMailboxes,
  repliesNeedingAttention: GROWTH_WORKSPACE_CANONICAL_ALIASES.inbox,
  meetingRequests: `${GROWTH_WORKSPACE_BASE_PATH}/meetings`,
  pendingApprovals: `${GROWTH_WORKSPACE_BASE_PATH}/campaigns`,
  blockedJobs: `${GROWTH_WORKSPACE_BASE_PATH}/campaigns`,
} as const
