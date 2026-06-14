/** Signal queue hints — recommendations only, no auto-enrollment (client-safe). */

import type {
  LeadSignalEvent,
  LeadSignalType,
  SignalQueueHint,
} from "@/lib/growth/signal-intelligence/lead-signal-event-types"

export function resolveSignalQueueHint(event: LeadSignalEvent): SignalQueueHint | null {
  if (!event.routeActions.includes("queue_hint")) return null

  switch (event.signalType) {
    case "high_intent_search":
    case "category_interest":
      return {
        hint_type: "recommend_sequence",
        label: "Recommend sequence",
        reason: "High-intent search activity detected — review sequence fit before enrolling.",
        requires_human_approval: true,
      }
    case "pricing_page_visit":
    case "demo_page_visit":
    case "contact_page_visit":
    case "repeat_visit":
      return {
        hint_type: "recommend_meeting_outreach",
        label: "Recommend meeting outreach",
        reason: "Website intent indicates active evaluation — consider meeting outreach.",
        requires_human_approval: true,
      }
    case "company_hiring":
    case "expansion_event":
    case "funding_event":
      return {
        hint_type: "review_company",
        label: "Review company",
        reason: "Company growth signal suggests expansion opportunity.",
        requires_human_approval: true,
      }
    default:
      return null
  }
}

export function commandCenterLabelForSignalType(signalType: LeadSignalType): string | null {
  switch (signalType) {
    case "pricing_page_visit":
    case "demo_page_visit":
    case "high_intent_search":
      return "Hot Signal"
    case "company_hiring":
    case "expansion_event":
      return "Expansion Opportunity"
    case "funding_event":
      return "Funding Event"
    case "competitor_search":
      return "Competitor Research"
    default:
      return null
  }
}

export function mergeSignalQueueHints(hints: Array<SignalQueueHint | null>): SignalQueueHint[] {
  const seen = new Set<string>()
  const out: SignalQueueHint[] = []
  for (const hint of hints) {
    if (!hint) continue
    const key = `${hint.hint_type}:${hint.label}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(hint)
  }
  return out
}
