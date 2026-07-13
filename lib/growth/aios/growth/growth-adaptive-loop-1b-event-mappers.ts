/**
 * GE-AIOS-ADAPTIVE-LOOP-1B — Map live production signals to canonical adaptive events (client-safe).
 * Reuses Reply Intelligence classifications — no duplicate reply parser.
 */

import { buildAdaptiveProspectEvent } from "@/lib/growth/aios/growth/growth-adaptive-loop-1a"
import type { AdaptiveProspectEvent, AdaptiveProspectEventType } from "@/lib/growth/aios/growth/growth-adaptive-loop-1a-types"
import type { GrowthReplyIntent } from "@/lib/growth/reply-intelligence/reply-intent-types"

export function mapReplyIntentToAdaptiveProspectEvent(input: {
  intent: GrowthReplyIntent
  occurredAt: string
  bodyPreview?: string | null
  summary?: string | null
}): AdaptiveProspectEvent | null {
  const excerpt = input.bodyPreview?.trim().slice(0, 240) ?? null
  const summary =
    input.summary?.trim() ||
    (excerpt ? excerpt : `Reply classified as ${input.intent.replaceAll("_", " ")}`)

  const typeByIntent: Partial<Record<GrowthReplyIntent, AdaptiveProspectEventType>> = {
    positive_interest: "reply_received",
    meeting_request: "meeting_booked",
    demo_request: "proposal_requested",
    pricing_question: "pricing_discussion",
    timing_delay: "timing_objection",
    objection: "objection",
    not_interested: "relationship_deterioration",
    unsubscribe: "unsubscribe",
    referral: "referral",
    wrong_contact: "contact_changed",
    competitor_mention: "competitor_mentioned",
    angry_complaint: "relationship_deterioration",
    needs_more_information: "reply_received",
    neutral_acknowledgement: "reply_received",
    support_request: "reply_received",
  }

  const type = typeByIntent[input.intent]
  if (!type) return null

  if (input.intent === "objection" && excerpt && /\balready have\b|\bincumbent\b|\bexisting software\b/i.test(excerpt)) {
    return buildAdaptiveProspectEvent({
      type: "already_have_software",
      occurredAt: input.occurredAt,
      summary: "Incumbent software objection in reply",
      detail: excerpt,
    })
  }

  if (input.intent === "objection" && excerpt && /\bbudget\b|\bcost\b|\bprice\b/i.test(excerpt)) {
    return buildAdaptiveProspectEvent({
      type: "budget_objection",
      occurredAt: input.occurredAt,
      summary: "Budget objection in reply",
      detail: excerpt,
    })
  }

  return buildAdaptiveProspectEvent({
    type,
    occurredAt: input.occurredAt,
    summary,
    detail: excerpt,
  })
}

export function mapMeetingStatusToAdaptiveProspectEvent(input: {
  status: "scheduled" | "completed" | "no_show" | "canceled"
  occurredAt: string
  companyName?: string | null
  outcome?: string | null
}): AdaptiveProspectEvent | null {
  switch (input.status) {
    case "scheduled":
      return buildAdaptiveProspectEvent({
        type: "meeting_booked",
        occurredAt: input.occurredAt,
        summary: `Meeting booked${input.companyName ? ` with ${input.companyName}` : ""}`,
      })
    case "completed":
      return buildAdaptiveProspectEvent({
        type: "meeting_completed",
        occurredAt: input.occurredAt,
        summary: `Meeting completed${input.outcome ? `: ${input.outcome}` : ""}`,
        detail: input.outcome ?? null,
      })
    case "no_show":
      return buildAdaptiveProspectEvent({
        type: "ghosting",
        occurredAt: input.occurredAt,
        summary: "Meeting no-show recorded",
        detail: "Prospect missed scheduled meeting.",
      })
    case "canceled":
      return buildAdaptiveProspectEvent({
        type: "timing_objection",
        occurredAt: input.occurredAt,
        summary: "Meeting canceled",
        detail: "Scheduled meeting was canceled before completion.",
      })
    default:
      return null
  }
}

export function mapBuyingCommitteeRoleChangeToAdaptiveProspectEvent(input: {
  committeeRole: string
  change: "appeared" | "left"
  personLabel?: string | null
  occurredAt: string
}): AdaptiveProspectEvent | null {
  const label = input.personLabel?.trim() || "Stakeholder"
  if (input.change === "left") {
    return buildAdaptiveProspectEvent({
      type: "organizational_changes",
      occurredAt: input.occurredAt,
      summary: `Stakeholder left committee: ${label}`,
      detail: `${label} (${input.committeeRole}) no longer active on buying committee.`,
    })
  }

  const typeByRole: Record<string, AdaptiveProspectEventType> = {
    champion: "champion_identified",
    executive_sponsor: "executive_engagement",
    economic_buyer: "executive_engagement",
    blocker_risk_stakeholder: "objection",
  }

  const type = typeByRole[input.committeeRole] ?? "buying_committee_expansion"
  const summaryByType: Partial<Record<AdaptiveProspectEventType, string>> = {
    champion_identified: `Champion identified: ${label}`,
    executive_engagement: `Executive engagement: ${label}`,
    objection: `Blocker risk stakeholder: ${label}`,
    buying_committee_expansion: `Committee expanded: ${label}`,
  }

  return buildAdaptiveProspectEvent({
    type,
    occurredAt: input.occurredAt,
    summary: summaryByType[type] ?? `Committee change: ${label}`,
    detail: `${label} joined as ${input.committeeRole.replaceAll("_", " ")}.`,
  })
}

export function mapOutboundEngagementToAdaptiveProspectEvent(input: {
  eventType: "opened" | "clicked"
  occurredAt: string
  subject?: string | null
}): AdaptiveProspectEvent | null {
  if (input.eventType === "opened") {
    return buildAdaptiveProspectEvent({
      type: "company_research_updated",
      occurredAt: input.occurredAt,
      summary: "Prospect opened outbound email",
      detail: input.subject ? `Opened: ${input.subject}` : "Email open detected.",
    })
  }
  return buildAdaptiveProspectEvent({
    type: "company_research_updated",
    occurredAt: input.occurredAt,
    summary: "Prospect clicked outbound link",
    detail: input.subject ? `Clicked from: ${input.subject}` : "Link click detected.",
  })
}
