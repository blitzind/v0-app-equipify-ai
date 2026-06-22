/** GS-GROWTH-OPS-7A.2 — Operator primary action helpers (client-safe). */

import { GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF } from "@/lib/growth/hubs/growth-workspace-hub-paths"
import type { GrowthNextBestAction } from "@/lib/growth/nba-types"
import {
  buildGrowthActivityHref,
  buildGrowthCallWorkspaceHref,
  buildGrowthLeadHref,
  buildGrowthMeetingsHref,
  buildGrowthOpportunityHref,
  buildGrowthPersonalizationHref,
} from "@/lib/growth/navigation/growth-workspace-operator-links"

export const GROWTH_OPS_CLICK_REDUCTION_7A2_QA_MARKER = "growth-ops-click-reduction-7a2-v1" as const

export const GROWTH_SEQUENCE_SEND_REVIEW_HREF = "/admin/growth/sequences/execution" as const
export const GROWTH_SEQUENCE_SEND_REVIEW_LABEL = "Queue for Send Review" as const
export const GROWTH_SEQUENCE_SEND_REVIEW_CONTROL_PLANE_LABELS = [
  "Admin approval queue",
  "Sequence send review",
  "Control-plane review",
] as const

export type GrowthNbaPrimaryActionLabel = "Generate Follow-Up" | "Start Call" | "Book Meeting"

export type GrowthOperatorQuickLink = {
  id: string
  label: string
  href: string
}

const CALL_NBA_ACTIONS = new Set<GrowthNextBestAction>([
  "call_now",
  "call_immediately",
  "call_after_email_reply",
  "call_primary_contact",
  "call_decision_maker",
  "retry_call",
  "immediate_sales_action",
])

const MEETING_NBA_ACTIONS = new Set<GrowthNextBestAction>([
  "owner_close_motion",
  "executive_close_motion",
  "accelerate_close_motion",
  "protect_close_motion",
  "secure_decision_maker",
])

/** Display-only mapping from persisted NBA — does not recalculate or mutate NBA. */
export function resolveGrowthOpportunityNbaPrimaryAction(
  action: GrowthNextBestAction | null | undefined,
  leadId: string,
): { label: GrowthNbaPrimaryActionLabel; href: string } {
  if (action && CALL_NBA_ACTIONS.has(action)) {
    return { label: "Start Call", href: buildGrowthCallWorkspaceHref({ leadId }) }
  }
  if (action && MEETING_NBA_ACTIONS.has(action)) {
    return { label: "Book Meeting", href: GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF }
  }
  return { label: "Generate Follow-Up", href: buildGrowthPersonalizationHref(leadId) }
}

export function buildGrowthOpportunityNbaSecondaryActions(
  leadId: string,
  primaryLabel: GrowthNbaPrimaryActionLabel,
): GrowthOperatorQuickLink[] {
  const candidates: GrowthOperatorQuickLink[] = [
    { id: "follow-up", label: "Generate Follow-Up", href: buildGrowthPersonalizationHref(leadId) },
    { id: "personalize", label: "Open Personalization", href: buildGrowthPersonalizationHref(leadId) },
    { id: "call", label: "Start Call", href: buildGrowthCallWorkspaceHref({ leadId }) },
    { id: "activity", label: "Open Activity", href: buildGrowthActivityHref({ leadId }) },
    { id: "meetings", label: "Meetings", href: buildGrowthMeetingsHref({ leadId }) },
    { id: "book", label: "Book Meeting", href: GROWTH_CAMPAIGNS_HUB_BOOKINGS_HREF },
  ]

  const seen = new Set<string>()
  return candidates.filter((entry) => {
    if (entry.label === primaryLabel) return false
    if (seen.has(entry.href)) return false
    seen.add(entry.href)
    return true
  })
}

export function buildGrowthActivityHotProspectHeroActions(leadId: string): {
  primary: GrowthOperatorQuickLink
  secondary: GrowthOperatorQuickLink[]
} {
  return {
    primary: { id: "open-lead", label: "Open Lead", href: buildGrowthLeadHref(leadId) },
    secondary: [
      { id: "personalize", label: "Personalize", href: buildGrowthPersonalizationHref(leadId) },
      { id: "call", label: "Call", href: buildGrowthCallWorkspaceHref({ leadId }) },
      { id: "opportunity", label: "Open Opportunity", href: buildGrowthOpportunityHref({ leadId }) },
    ],
  }
}

export function buildGrowthLeadDirectionsHref(input: {
  companyName?: string | null
  addressLine1?: string | null
  city?: string | null
  state?: string | null
}): string | null {
  const query = [input.addressLine1, input.city, input.state, input.companyName].filter(Boolean).join(", ")
  if (!query.trim()) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query.trim())}`
}
