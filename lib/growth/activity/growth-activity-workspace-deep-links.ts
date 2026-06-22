/** GS-AI-PLAYBOOK-5B/5C — Cross-workspace operator deep links (client-safe). */

import type { GrowthActivityCategory } from "@/lib/growth/activity/growth-activity-workspace-types"
import { GROWTH_PERSONALIZATION_WORKSPACE_PATH } from "@/lib/growth/personalization/personalization-generation-ux"
import { buildGrowthPersonalizedVideosPageDetailPath } from "@/lib/growth/sendr/growth-sendr-branding"
import type { GrowthActivityQuickAction } from "@/lib/growth/activity/growth-activity-workspace-types"

export function buildGrowthLeadWorkspaceHref(leadId: string): string {
  return `/growth/leads/${leadId}`
}

export function buildGrowthInboxForLeadHref(leadId: string): string {
  return `/growth/inbox?leadId=${encodeURIComponent(leadId)}`
}

export function buildGrowthOpportunitiesHref(leadId?: string | null): string {
  if (leadId) return `/growth/opportunities?leadId=${encodeURIComponent(leadId)}`
  return "/growth/opportunities"
}

export function buildGrowthCallsWorkspaceHref(leadId?: string | null): string {
  if (leadId) return `/growth/calls/workspace?leadId=${encodeURIComponent(leadId)}`
  return "/growth/calls/workspace"
}

export function buildGrowthSharePagesWorkspaceHref(sharePageId?: string | null): string {
  if (sharePageId) return `/growth/share-pages/${sharePageId}`
  return "/growth/share-pages"
}

export function buildGrowthPersonalizationForLeadHref(
  leadId: string,
  generationId?: string | null,
): string {
  const params = new URLSearchParams({ leadId })
  if (generationId) params.set("generationId", generationId)
  return `${GROWTH_PERSONALIZATION_WORKSPACE_PATH}?${params.toString()}`
}

export function buildGrowthVideoPageDetailHref(pageId: string): string {
  return buildGrowthPersonalizedVideosPageDetailPath(pageId)
}

export function buildGrowthActivityEventQuickActions(input: {
  leadId?: string | null
  landingPageId?: string | null
  sharePageId?: string | null
  generationId?: string | null
  category?: GrowthActivityCategory
}): GrowthActivityQuickAction[] {
  const actions: GrowthActivityQuickAction[] = []
  if (input.leadId) {
    actions.push({ id: "open-lead", label: "Open Lead", href: buildGrowthLeadWorkspaceHref(input.leadId) })
    actions.push({
      id: "open-conversation",
      label: "Open Conversation",
      href: buildGrowthInboxForLeadHref(input.leadId),
    })
  }

  if (input.category === "personalization" && input.leadId) {
    actions.push({
      id: "open-personalization",
      label: "Open Personalization",
      href: buildGrowthPersonalizationForLeadHref(input.leadId, input.generationId),
    })
  } else if (input.leadId) {
    actions.push({
      id: "open-personalization",
      label: "Open Personalization",
      href: buildGrowthPersonalizationForLeadHref(input.leadId),
    })
  }

  if (input.category === "sales" && input.leadId) {
    actions.push({
      id: "open-opportunity",
      label: "Open Opportunity",
      href: buildGrowthOpportunitiesHref(input.leadId),
    })
  } else {
    actions.push({ id: "open-opportunity", label: "Open Opportunity", href: buildGrowthOpportunitiesHref() })
  }

  if (input.landingPageId) {
    actions.push({
      id: "open-video-page",
      label: "Open Video Page",
      href: buildGrowthVideoPageDetailHref(input.landingPageId),
    })
  }

  if (input.sharePageId) {
    actions.push({
      id: "open-share-page",
      label: "Open Share Page",
      href: buildGrowthSharePagesWorkspaceHref(input.sharePageId),
    })
  }

  if (input.leadId) {
    actions.push({
      id: "start-call",
      label: "Start Call",
      href: buildGrowthCallsWorkspaceHref(input.leadId),
    })
  }

  return actions
}
