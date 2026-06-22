/** GS-AI-PLAYBOOK-5B/5C — Cross-workspace operator deep links (client-safe). */

import type { GrowthActivityCategory } from "@/lib/growth/activity/growth-activity-workspace-types"
import type { GrowthActivityQuickAction } from "@/lib/growth/activity/growth-activity-workspace-types"
import {
  buildGrowthCallWorkspaceHref,
  buildGrowthInboxForLeadHref,
  buildGrowthLeadWorkspaceHref,
  buildGrowthOpportunitiesHref,
  buildGrowthPersonalizationForLeadHref,
  buildGrowthSharePagesWorkspaceHref,
  buildGrowthVideoPageDetailHref,
} from "@/lib/growth/navigation/growth-workspace-operator-links"

export {
  buildGrowthCallWorkspaceHref,
  buildGrowthCallsWorkspaceHref,
  buildGrowthInboxForLeadHref,
  buildGrowthLeadWorkspaceHref,
  buildGrowthOpportunitiesHref,
  buildGrowthPersonalizationForLeadHref,
  buildGrowthSharePagesWorkspaceHref,
  buildGrowthVideoPageDetailHref,
} from "@/lib/growth/navigation/growth-workspace-operator-links"

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
      href: buildGrowthCallWorkspaceHref({ leadId: input.leadId }),
    })
  }

  return actions
}
