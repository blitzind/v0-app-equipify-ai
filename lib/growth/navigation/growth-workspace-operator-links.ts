/** Client-safe workspace operator deep-link builders (Phase 7J, GS-GROWTH-OPS-6B). */

import type { GrowthInboxQueueView } from "@/lib/growth/inbox/inbox-thread-queue-filters"
import { GROWTH_ACTIVITY_WORKSPACE_PATH } from "@/lib/growth/activity/growth-activity-workspace-constants"
import { GROWTH_PERSONALIZATION_WORKSPACE_PATH } from "@/lib/growth/personalization/personalization-generation-ux"
import { buildGrowthPersonalizedVideosPageDetailPath } from "@/lib/growth/sendr/growth-sendr-branding"
import { GROWTH_WORKSPACE_CANONICAL_ALIASES } from "@/lib/growth/navigation/growth-workspace-cleanup-audit"
import { GROWTH_WORKSPACE_BASE_PATH } from "@/lib/growth/navigation/growth-route-metadata-types"
import { growthWorkspaceCallWorkspaceHref } from "@/lib/growth/navigation/growth-call-notification-links"

export const GROWTH_WORKSPACE_OPERATOR_LINKS_QA_MARKER = "growth-workspace-operator-links-v2" as const
export const GROWTH_OPS_NAVIGATION_6B_QA_MARKER = "growth-ops-navigation-6b-v1" as const
export const GROWTH_OPS_HANDOFF_6C_QA_MARKER = "growth-ops-handoff-6c-v1" as const

export type GrowthLeadHrefInput = {
  focus?: string | null
  highlight?: string | null
}

/** Canonical operator lead detail — CRM drawer with optional focus/highlight. */
export function buildGrowthLeadHref(leadId: string, input?: GrowthLeadHrefInput): string {
  const params = new URLSearchParams({ open: leadId })
  if (input?.focus) params.set("focus", input.focus)
  if (input?.highlight) params.set("highlight", input.highlight)
  return `${GROWTH_WORKSPACE_BASE_PATH}/leads/crm?${params.toString()}`
}

/** Back-compat alias used across inbox, calls, and meetings surfaces. */
export function growthWorkspaceLeadHref(leadId: string): string {
  return buildGrowthLeadHref(leadId)
}

/** Back-compat alias used by activity center quick actions. */
export function buildGrowthLeadWorkspaceHref(leadId: string): string {
  return buildGrowthLeadHref(leadId)
}

export function buildGrowthInboxForLeadHref(leadId: string): string {
  return growthWorkspaceInboxHref({ leadId })
}

export function buildGrowthOpportunityHref(input?: {
  leadId?: string | null
  opportunityId?: string | null
}): string {
  if (input?.opportunityId) {
    return growthWorkspacePipelineHref(input.opportunityId)
  }
  if (input?.leadId) {
    const params = new URLSearchParams({ leadId: input.leadId })
    return `${GROWTH_WORKSPACE_CANONICAL_ALIASES.pipeline}?${params.toString()}`
  }
  return GROWTH_WORKSPACE_CANONICAL_ALIASES.opportunities
}

/** Back-compat alias used by activity center quick actions. */
export function buildGrowthOpportunitiesHref(leadId?: string | null): string {
  return buildGrowthOpportunityHref({ leadId })
}

export function buildGrowthCallWorkspaceHref(input?: {
  leadId?: string | null
  phone?: string | null
  queueItemId?: string | null
  dialMode?: string | null
  callSessionId?: string | null
}): string {
  return growthWorkspaceCallWorkspaceHref(input)
}

/** Back-compat alias used by activity center quick actions. */
export function buildGrowthCallsWorkspaceHref(leadId?: string | null): string {
  return buildGrowthCallWorkspaceHref(leadId ? { leadId } : undefined)
}

export function buildGrowthActivityHref(input?: { filter?: string | null; leadId?: string | null } | string | null): string {
  if (typeof input === "string" || input == null) {
    if (!input) return GROWTH_ACTIVITY_WORKSPACE_PATH
    const params = new URLSearchParams({ filter: input })
    return `${GROWTH_ACTIVITY_WORKSPACE_PATH}?${params.toString()}`
  }
  const params = new URLSearchParams()
  if (input.filter) params.set("filter", input.filter)
  if (input.leadId) params.set("leadId", input.leadId)
  const query = params.toString()
  return query ? `${GROWTH_ACTIVITY_WORKSPACE_PATH}?${query}` : GROWTH_ACTIVITY_WORKSPACE_PATH
}

export {
  GROWTH_DELIVERY_SETTINGS_PATH,
  growthWorkspaceDeliverySetupHref,
} from "@/lib/growth/navigation/growth-delivery-settings-navigation"

export function buildGrowthMeetingsHref(input?: {
  leadId?: string | null
  meetingId?: string | null
}): string {
  const params = new URLSearchParams()
  if (input?.leadId) params.set("leadId", input.leadId)
  if (input?.meetingId) params.set("meetingId", input.meetingId)
  const query = params.toString()
  return query
    ? `${GROWTH_WORKSPACE_BASE_PATH}/meetings?${query}`
    : `${GROWTH_WORKSPACE_BASE_PATH}/meetings`
}

export function buildGrowthSharePageWorkspaceHref(input?: {
  leadId?: string | null
  pageId?: string | null
}): string {
  const params = new URLSearchParams()
  if (input?.leadId) params.set("leadId", input.leadId)
  if (input?.pageId) params.set("page_id", input.pageId)
  const query = params.toString()
  return query
    ? `${GROWTH_WORKSPACE_BASE_PATH}/share-pages/workspace?${query}`
    : `${GROWTH_WORKSPACE_BASE_PATH}/share-pages/workspace`
}

/** Back-compat alias — share page detail by id only. */
export function buildGrowthSharePagesWorkspaceHref(sharePageId?: string | null): string {
  if (sharePageId) return growthWorkspaceSharePageHref(sharePageId)
  return `${GROWTH_WORKSPACE_BASE_PATH}/share-pages`
}

export function buildGrowthPersonalizationHref(
  leadId: string,
  generationId?: string | null,
): string {
  const params = new URLSearchParams({ leadId })
  if (generationId) params.set("generationId", generationId)
  return `${GROWTH_PERSONALIZATION_WORKSPACE_PATH}?${params.toString()}`
}

/** Back-compat alias used by activity center quick actions. */
export function buildGrowthPersonalizationForLeadHref(
  leadId: string,
  generationId?: string | null,
): string {
  return buildGrowthPersonalizationHref(leadId, generationId)
}

export function buildGrowthVideoPageDetailHref(pageId: string): string {
  return buildGrowthPersonalizedVideosPageDetailPath(pageId)
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

export function growthWorkspaceConversationsHref(input?: {
  leadId?: string | null
  threadId?: string | null
  companyId?: string | null
  personId?: string | null
}): string {
  const params = new URLSearchParams()
  if (input?.leadId) params.set("leadId", input.leadId)
  if (input?.threadId) params.set("threadId", input.threadId)
  if (input?.companyId) params.set("companyId", input.companyId)
  if (input?.personId) params.set("personId", input.personId)
  const query = params.toString()
  return query
    ? `${GROWTH_WORKSPACE_BASE_PATH}/conversations?${query}`
    : `${GROWTH_WORKSPACE_BASE_PATH}/conversations`
}

export function growthWorkspaceInboxWorkflowHref(leadId?: string | null): string {
  if (!leadId) return GROWTH_WORKSPACE_CANONICAL_ALIASES.replyWorkflow
  const params = new URLSearchParams({ leadId })
  return `${GROWTH_WORKSPACE_CANONICAL_ALIASES.replyWorkflow}?${params.toString()}`
}

export function growthWorkspaceCallsHref(): string {
  return `${GROWTH_WORKSPACE_BASE_PATH}/calls`
}

export function growthWorkspaceMeetingsHref(leadId?: string | null, meetingId?: string | null): string {
  return buildGrowthMeetingsHref({ leadId, meetingId })
}

/** Resolve canonical leadId from legacy query param aliases. */
export function resolveGrowthLeadIdFromSearchParams(input: {
  get(name: string): string | null
}): string | null {
  return input.get("leadId") ?? input.get("lead_id") ?? input.get("lead")
}
