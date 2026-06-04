/** Client-safe Growth Inbox Workspace v2 — UI shell only (Phase 1). */

export const GROWTH_INBOX_WORKSPACE_V2_QA_MARKER = "growth-inbox-workspace-v2" as const
export const GROWTH_INBOX_WORKSPACE_PHASE2_QA_MARKER = "growth-inbox-workspace-phase2" as const
export const GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER = "growth-inbox-workspace-phase3" as const

/**
 * Enable via `GROWTH_INBOX_WORKSPACE_V2=true` (server) or
 * `NEXT_PUBLIC_GROWTH_INBOX_WORKSPACE_V2=true` (client pages).
 */
export function isGrowthInboxWorkspaceV2Enabled(): boolean {
  if (typeof process === "undefined") return false
  const publicFlag = process.env.NEXT_PUBLIC_GROWTH_INBOX_WORKSPACE_V2?.trim()
  if (publicFlag === "true") return true
  const serverFlag = process.env.GROWTH_INBOX_WORKSPACE_V2?.trim()
  return serverFlag === "true"
}

export function resolveGrowthInboxWorkspaceV2FromSearchParams(
  searchParams: URLSearchParams | { get(name: string): string | null },
): boolean {
  const override = searchParams.get("inboxWorkspaceV2")
  if (override === "1" || override === "true") return true
  if (override === "0" || override === "false") return false
  return isGrowthInboxWorkspaceV2Enabled()
}

export const GROWTH_INBOX_DIAGNOSTICS_HREF = "/admin/growth/inbox/diagnostics" as const
export const GROWTH_INBOX_WORKSPACE_HREF = "/admin/growth/inbox" as const
