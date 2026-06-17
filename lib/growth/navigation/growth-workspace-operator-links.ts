/** Client-safe workspace operator deep-link builders (Phase 7J). */

import type { GrowthInboxQueueView } from "@/lib/growth/inbox/inbox-thread-queue-filters"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import { GROWTH_WORKSPACE_CANONICAL_ALIASES } from "@/lib/growth/navigation/growth-workspace-cleanup-audit"

export const GROWTH_WORKSPACE_OPERATOR_LINKS_QA_MARKER = "growth-workspace-operator-links-v1" as const

export function growthWorkspaceLeadHref(leadId: string): string {
  return `${GROWTH_WORKSPACE_BASE_PATH}/leads/${encodeURIComponent(leadId)}`
}

export function growthWorkspaceSharePageHref(sharePageId: string): string {
  return `${GROWTH_WORKSPACE_CANONICAL_ALIASES.sharePages}/${encodeURIComponent(sharePageId)}`
}

export function growthWorkspaceInboxHref(input?: {
  threadId?: string | null
  leadId?: string | null
  replyId?: string | null
  view?: GrowthInboxQueueView | string | null
}): string {
  const params = new URLSearchParams()
  if (input?.threadId) params.set("threadId", input.threadId)
  if (input?.leadId) params.set("leadId", input.leadId)
  if (input?.replyId) params.set("replyId", input.replyId)
  if (input?.view) params.set("view", input.view)
  const query = params.toString()
  return query ? `${GROWTH_WORKSPACE_CANONICAL_ALIASES.inbox}?${query}` : GROWTH_WORKSPACE_CANONICAL_ALIASES.inbox
}

export function growthWorkspaceInboxViewHref(
  view: GrowthInboxQueueView,
  preserve?: { toString(): string } | null,
): string {
  const params = new URLSearchParams(preserve?.toString() ?? "")
  params.set("view", view)
  return `${GROWTH_WORKSPACE_CANONICAL_ALIASES.inbox}?${params.toString()}`
}

export function growthWorkspacePipelineHref(opportunityId?: string | null): string {
  if (!opportunityId) return GROWTH_WORKSPACE_CANONICAL_ALIASES.pipeline
  const params = new URLSearchParams({ opportunityId })
  return `${GROWTH_WORKSPACE_CANONICAL_ALIASES.pipeline}?${params.toString()}`
}
