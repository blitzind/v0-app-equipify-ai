/** GS-GROWTH-OPS-7A.1 — Operator notification deep-link builders (client-safe). */

import {
  buildGrowthActivityHref,
  buildGrowthLeadHref,
  buildGrowthOpportunityHref,
} from "@/lib/growth/navigation/growth-workspace-operator-links"

export const GROWTH_OPERATOR_NOTIFICATION_LINKS_QA_MARKER = "growth-operator-notification-links-7a1-v1" as const

export function growthOperatorLeadNotificationHref(
  leadId: string,
  focus?: string | null,
  highlight?: string | null,
): string {
  return buildGrowthLeadHref(leadId, { focus: focus ?? undefined, highlight: highlight ?? undefined })
}

export function growthOperatorOpportunityNotificationHref(input: {
  opportunityId?: string | null
  leadId?: string | null
}): string {
  return buildGrowthOpportunityHref({
    opportunityId: input.opportunityId,
    leadId: input.leadId,
  })
}

export function growthOperatorFollowUpNotificationHref(leadId: string): string {
  return buildGrowthActivityHref({ leadId, filter: "needs-attention" })
}
