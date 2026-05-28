/** Unified account timeline for Prospect Search — evidence-backed, client-safe. */

import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"
import type { GrowthProspectSearchPeopleResultRow } from "@/lib/growth/prospect-search/prospect-search-contact-discovery"
import type { ProspectSearchRelationshipMemorySnapshot } from "@/lib/growth/prospect-search/prospect-search-relationship-memory"
import { GROWTH_RELATIONSHIP_MEMORY_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-relationship-memory"

export const GROWTH_ACCOUNT_TIMELINE_QA_MARKER = "growth-account-timeline-v1" as const

export const PROSPECT_SEARCH_ACCOUNT_TIMELINE_KINDS = [
  "discovery",
  "enrichment",
  "refresh",
  "queue_push",
  "call_attempt",
  "call_connected",
  "email_attempt",
  "email_reply",
  "meeting",
  "pipeline_transition",
  "operator_action",
  "verification_change",
  "suppression",
  "contact_change",
  "persona_change",
  "territory_change",
  "relationship_status_change",
  "lead_timeline",
  "no_response",
  "email_bounce",
] as const

export type ProspectSearchAccountTimelineEventKind =
  (typeof PROSPECT_SEARCH_ACCOUNT_TIMELINE_KINDS)[number]

export type ProspectSearchAccountTimelineEvent = {
  id: string
  kind: ProspectSearchAccountTimelineEventKind
  label: string
  detail: string
  occurred_at: string | null
  contact_id: string | null
  contact_name: string | null
  source: string
  evidence: string[]
  filter_group: "discovery" | "outreach" | "relationship" | "compliance" | "verification"
}

export type ProspectSearchAccountTimeline = {
  qa_marker: typeof GROWTH_ACCOUNT_TIMELINE_QA_MARKER
  company_id: string
  company_name: string
  events: ProspectSearchAccountTimelineEvent[]
  timeline_summary: string | null
  recommended_next_action: string | null
  recent_outreach_count: number
  days_since_last_interaction: number | null
}

export type ProspectSearchAccountTimelineFilter =
  | "all"
  | "discovery"
  | "outreach"
  | "relationship"
  | "compliance"
  | "verification"

const LEAD_TIMELINE_KIND_MAP: Record<string, ProspectSearchAccountTimelineEventKind> = {
  call_started: "call_connected",
  call_attempted: "call_attempt",
  email_sent: "email_attempt",
  email_replied: "email_reply",
  email_bounced: "email_bounce",
  email_unsubscribed: "suppression",
  suppression_applied: "suppression",
  manual_touch: "operator_action",
  follow_up_completed: "operator_action",
  interested: "email_reply",
  notes_updated: "operator_action",
  outreach_queued: "queue_push",
  decision_maker_added: "contact_change",
  decision_maker_confirmed: "contact_change",
  research_completed: "enrichment",
  research_started: "enrichment",
  relationship_strength_changed: "relationship_status_change",
  relationship_cooled: "relationship_status_change",
  status_changed: "pipeline_transition",
}

function mapPeopleTimelineKind(
  kind: string,
): ProspectSearchAccountTimelineEventKind {
  switch (kind) {
    case "discovered":
      return "discovery"
    case "verified":
    case "verification":
      return "verification_change"
    case "refreshed":
      return "refresh"
    case "routed_queue":
      return "queue_push"
    case "added_pipeline":
      return "pipeline_transition"
    case "suppressed":
      return "suppression"
    case "freshness":
      return "verification_change"
    default:
      return "discovery"
  }
}

function resolveFilterGroup(
  kind: ProspectSearchAccountTimelineEventKind,
): ProspectSearchAccountTimelineEvent["filter_group"] {
  if (kind === "discovery" || kind === "enrichment" || kind === "contact_change" || kind === "persona_change") {
    return "discovery"
  }
  if (kind === "suppression" || kind === "email_bounce") return "compliance"
  if (kind === "verification_change" || kind === "refresh") return "verification"
  if (kind === "relationship_status_change") return "relationship"
  return "outreach"
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return null
  return Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000))
}

export function filterProspectSearchAccountTimeline(
  timeline: ProspectSearchAccountTimeline,
  filter: ProspectSearchAccountTimelineFilter,
): ProspectSearchAccountTimelineEvent[] {
  if (filter === "all") return timeline.events
  return timeline.events.filter((event) => event.filter_group === filter)
}

export function buildProspectSearchAccountTimeline(input: {
  company: GrowthProspectSearchCompanyResult
  peopleRows: GrowthProspectSearchPeopleResultRow[]
  relationshipMemory?: ProspectSearchRelationshipMemorySnapshot | null
  leadTimelineEvents?: Array<{
    id: string
    event_type: string
    title: string
    summary?: string | null
    occurred_at: string
  }>
}): ProspectSearchAccountTimeline {
  const events: ProspectSearchAccountTimelineEvent[] = []

  for (const row of input.peopleRows) {
    for (const event of row.timeline_events ?? []) {
      events.push({
        id: `${row.contact_id}:${event.id}`,
        kind: mapPeopleTimelineKind(event.kind),
        label: event.label,
        detail: event.detail,
        occurred_at: event.occurred_at,
        contact_id: row.contact_id,
        contact_name: row.full_name,
        source: "contact_discovery",
        evidence: [event.detail],
        filter_group: resolveFilterGroup(mapPeopleTimelineKind(event.kind)),
      })
    }
    if (row.persona_label) {
      events.push({
        id: `${row.contact_id}:persona`,
        kind: "persona_change",
        label: `${row.full_name ?? "Contact"} — ${row.persona_label}`,
        detail: `Persona classified from title evidence: ${row.persona_evidence?.slice(0, 2).join(" · ") ?? row.title ?? "—"}`,
        occurred_at: row.discovered_at ?? row.last_checked_at ?? null,
        contact_id: row.contact_id,
        contact_name: row.full_name,
        source: "persona_intelligence",
        evidence: row.persona_evidence?.slice(0, 3) ?? [],
        filter_group: "discovery",
      })
    }
  }

  for (const leadEvent of input.leadTimelineEvents ?? []) {
    const kind = LEAD_TIMELINE_KIND_MAP[leadEvent.event_type] ?? "lead_timeline"
    events.push({
      id: `lead:${leadEvent.id}`,
      kind,
      label: leadEvent.title,
      detail: leadEvent.summary?.trim() || leadEvent.title,
      occurred_at: leadEvent.occurred_at,
      contact_id: null,
      contact_name: null,
      source: "lead_timeline",
      evidence: [leadEvent.summary?.trim() || leadEvent.title],
      filter_group: resolveFilterGroup(kind),
    })
  }

  if (input.company.is_suppressed) {
    events.push({
      id: "company:suppression",
      kind: "suppression",
      label: "Outreach suppressed",
      detail: input.company.suppression_reason ?? "Account flagged for suppression",
      occurred_at: input.company.suppressed_at ?? null,
      contact_id: null,
      contact_name: null,
      source: "compliance",
      evidence: [input.company.suppression_reason ?? "Suppression active"],
      filter_group: "compliance",
    })
  }

  if (input.company.in_lead_inbox) {
    events.push({
      id: "company:inbox",
      kind: "pipeline_transition",
      label: "In Lead Inbox",
      detail: "Account linked to Lead Inbox — operator relationship context available",
      occurred_at: null,
      contact_id: null,
      contact_name: null,
      source: "lead_inbox",
      evidence: ["Lead Inbox record exists"],
      filter_group: "relationship",
    })
  }

  if (input.relationshipMemory?.relationship_status) {
    events.push({
      id: "relationship:status",
      kind: "relationship_status_change",
      label: `Relationship: ${input.relationshipMemory.relationship_status.replace(/_/g, " ")}`,
      detail: input.relationshipMemory.strength_reasons[0] ?? "Relationship status inferred from observed evidence",
      occurred_at: input.relationshipMemory.last_interaction_at,
      contact_id: null,
      contact_name: null,
      source: GROWTH_RELATIONSHIP_MEMORY_QA_MARKER,
      evidence: input.relationshipMemory.strength_reasons.slice(0, 3),
      filter_group: "relationship",
    })
  }

  const sorted = events.sort((a, b) => {
    const aTs = a.occurred_at ? Date.parse(a.occurred_at) : 0
    const bTs = b.occurred_at ? Date.parse(b.occurred_at) : 0
    return bTs - aTs
  })

  const outreachKinds = new Set<ProspectSearchAccountTimelineEventKind>([
    "call_attempt",
    "call_connected",
    "email_attempt",
    "email_reply",
    "queue_push",
  ])
  const recent_outreach_count = sorted.filter((e) => outreachKinds.has(e.kind)).length
  const lastInteraction = sorted.find((e) => e.occurred_at)?.occurred_at ?? null
  const days_since_last_interaction = daysSince(lastInteraction)

  const recommended = resolveTimelineAwareRecommendation({
    events: sorted,
    relationshipMemory: input.relationshipMemory,
    recent_outreach_count,
    days_since_last_interaction,
  })

  let timeline_summary: string | null = null
  if (sorted.length === 0) {
    timeline_summary = "No recorded interactions yet — discovery and contact research only"
  } else if (input.relationshipMemory?.relationship_status === "engaged") {
    timeline_summary = "Active relationship signals — follow up on prior engagement"
  } else if (recent_outreach_count >= 3 && !sorted.some((e) => e.kind === "email_reply" || e.kind === "call_connected")) {
    timeline_summary = "Multiple outreach attempts without recorded response"
  } else {
    timeline_summary = `${sorted.length} timeline events from observed operator and system activity`
  }

  return {
    qa_marker: GROWTH_ACCOUNT_TIMELINE_QA_MARKER,
    company_id: input.company.id,
    company_name: input.company.company_name,
    events: sorted,
    timeline_summary,
    recommended_next_action: recommended,
    recent_outreach_count,
    days_since_last_interaction,
  }
}

function resolveTimelineAwareRecommendation(input: {
  events: ProspectSearchAccountTimelineEvent[]
  relationshipMemory?: ProspectSearchRelationshipMemorySnapshot | null
  recent_outreach_count: number
  days_since_last_interaction: number | null
}): string | null {
  if (input.relationshipMemory?.recommended_next_action) {
    return input.relationshipMemory.recommended_next_action
  }
  const hasStaleVerification = input.events.some(
    (e) => e.kind === "verification_change" && /stale|expired|aging/i.test(e.detail),
  )
  if (hasStaleVerification) {
    return "Refresh stale contact verification before outreach"
  }
  if (input.recent_outreach_count >= 3 && input.days_since_last_interaction != null && input.days_since_last_interaction < 14) {
    return "Avoid repeated outreach — recent no-response pattern detected"
  }
  if (input.days_since_last_interaction != null && input.days_since_last_interaction >= 60) {
    return "Re-engage stalled account — review relationship context first"
  }
  const lastDiscovery = input.events.find((e) => e.kind === "discovery")
  if (lastDiscovery && input.recent_outreach_count === 0) {
    return `Follow up on ${lastDiscovery.contact_name ?? "discovered contact"} after research review`
  }
  return null
}
