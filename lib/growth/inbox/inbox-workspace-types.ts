/** Client-safe Growth Inbox Workspace v2 — UI shell only (Phase 1). */

export const GROWTH_INBOX_WORKSPACE_V2_QA_MARKER = "growth-inbox-workspace-v2" as const
export const GROWTH_INBOX_WORKSPACE_PHASE2_QA_MARKER = "growth-inbox-workspace-phase2" as const
export const GROWTH_INBOX_WORKSPACE_PHASE3_QA_MARKER = "growth-inbox-workspace-phase3" as const
export const GROWTH_INBOX_WORKSPACE_PHASE4_QA_MARKER = "growth-inbox-workspace-phase4" as const

/**
 * V2 is the default inbox experience.
 * Set `GROWTH_INBOX_WORKSPACE_V2=false` or `NEXT_PUBLIC_GROWTH_INBOX_WORKSPACE_V2=false`
 * to roll back deployment-wide. Per-request legacy: `?inboxWorkspaceV2=0`.
 */
export function isGrowthInboxWorkspaceV2Enabled(): boolean {
  if (typeof process === "undefined") return true

  const publicFlag = process.env.NEXT_PUBLIC_GROWTH_INBOX_WORKSPACE_V2?.trim()
  if (publicFlag === "false") return false
  if (publicFlag === "true") return true

  const serverFlag = process.env.GROWTH_INBOX_WORKSPACE_V2?.trim()
  if (serverFlag === "false") return false
  if (serverFlag === "true") return true

  return true
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
export const GROWTH_INBOX_LEGACY_HREF = "/admin/growth/inbox?inboxWorkspaceV2=0" as const
