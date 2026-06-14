/** Phase GS-1B/GS-1C — Lead signal event types (client-safe). */

export const LEAD_SIGNAL_EVENT_ROUTER_QA_MARKER = "growth-signal-event-router-gs1b-v1" as const
export const SIGNAL_EXTERNAL_BRIDGE_QA_MARKER = "growth-signal-external-bridge-gs1c-v1" as const

export const LEAD_SIGNAL_SOURCE_DOMAINS = [
  "reply",
  "meeting",
  "opportunity",
  "engagement",
  "sequence",
  "external",
  "company",
] as const

export type LeadSignalSourceDomain = (typeof LEAD_SIGNAL_SOURCE_DOMAINS)[number]

export const LEAD_SIGNAL_TYPES = [
  "reply_received",
  "positive_reply",
  "negative_reply",
  "meeting_requested",
  "meeting_booked",
  "meeting_completed",
  "meeting_no_show",
  "opportunity_created",
  "stage_advanced",
  "deal_won",
  "deal_lost",
  "company_hiring",
  "leadership_change",
  "funding_event",
  "technology_change",
  "expansion_event",
  "high_intent_search",
  "category_interest",
  "competitor_search",
  "pricing_page_visit",
  "repeat_visit",
  "high_engagement_visit",
  "demo_page_visit",
  "contact_page_visit",
] as const

export type LeadSignalType = (typeof LEAD_SIGNAL_TYPES)[number]

export const LEAD_SIGNAL_URGENCY_LEVELS = ["low", "normal", "high", "urgent"] as const

export type LeadSignalUrgency = (typeof LEAD_SIGNAL_URGENCY_LEVELS)[number]

export const LEAD_SIGNAL_RECOMPUTE_SCOPES = ["full", "engagement_only", "nba_only"] as const

export type LeadSignalRecomputeScope = (typeof LEAD_SIGNAL_RECOMPUTE_SCOPES)[number]

export const LEAD_SIGNAL_ROUTE_ACTIONS = [
  "timeline",
  "attribution_touch",
  "attention",
  "queue_hint",
] as const

export type LeadSignalRouteAction = (typeof LEAD_SIGNAL_ROUTE_ACTIONS)[number]

export type LeadSignalEvidenceRef = {
  table: string
  id: string
}

export type LeadSignalEvent = {
  leadId: string
  organizationId?: string | null
  sourceDomain: LeadSignalSourceDomain
  signalType: LeadSignalType
  confidence: number
  urgency: LeadSignalUrgency
  evidenceRef: LeadSignalEvidenceRef
  attributionImpacting: boolean
  recomputeScope: LeadSignalRecomputeScope
  routeActions: LeadSignalRouteAction[]
  metadata?: Record<string, unknown>
  occurredAt?: string
}

export type SignalQueueHint = {
  hint_type: "recommend_sequence" | "recommend_meeting_outreach" | "review_company" | "hot_signal_alert"
  label: string
  reason: string
  requires_human_approval: true
}

export type RouteLeadSignalEventResult = {
  qa_marker: typeof LEAD_SIGNAL_EVENT_ROUTER_QA_MARKER
  ok: boolean
  duplicate: boolean
  audit_event_id: string | null
  timeline_emitted: boolean
  attribution_touch_recorded: boolean
  recompute_succeeded: boolean
  attention_evaluated: boolean
  queue_hint: SignalQueueHint | null
  dedupe_hash: string
  error?: string
}

export type RouteExternalSignalBatchResult = {
  qa_marker: typeof SIGNAL_EXTERNAL_BRIDGE_QA_MARKER
  ok: boolean
  matched_lead_count: number
  routed_count: number
  unmatched_audit_event_id: string | null
  results: RouteLeadSignalEventResult[]
  queue_hints: SignalQueueHint[]
}

export const LEAD_SIGNAL_TYPE_SOURCE_DOMAIN: Record<LeadSignalType, LeadSignalSourceDomain> = {
  reply_received: "reply",
  positive_reply: "reply",
  negative_reply: "reply",
  meeting_requested: "reply",
  meeting_booked: "meeting",
  meeting_completed: "meeting",
  meeting_no_show: "meeting",
  opportunity_created: "opportunity",
  stage_advanced: "opportunity",
  deal_won: "opportunity",
  deal_lost: "opportunity",
  company_hiring: "company",
  leadership_change: "company",
  funding_event: "company",
  technology_change: "company",
  expansion_event: "company",
  high_intent_search: "external",
  category_interest: "external",
  competitor_search: "external",
  pricing_page_visit: "external",
  repeat_visit: "external",
  high_engagement_visit: "external",
  demo_page_visit: "external",
  contact_page_visit: "external",
}

export function assertLeadSignalEventShape(event: LeadSignalEvent): void {
  if (!event.leadId.trim()) throw new Error("lead_signal_event_lead_id_required")
  if (!event.evidenceRef.table.trim() || !event.evidenceRef.id.trim()) {
    throw new Error("lead_signal_event_evidence_ref_required")
  }
  if (!Number.isFinite(event.confidence) || event.confidence < 0 || event.confidence > 1) {
    throw new Error("lead_signal_event_confidence_out_of_range")
  }
  if (LEAD_SIGNAL_TYPE_SOURCE_DOMAIN[event.signalType] !== event.sourceDomain) {
    throw new Error("lead_signal_event_source_domain_mismatch")
  }
}
