/** Lead signal event audit + side effects — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { appendGrowthLeadTimelineEvent } from "@/lib/growth/timeline-repository"
import type { GrowthLeadTimelineEventType } from "@/lib/growth/timeline-types"
import { recordAttributionTouch } from "@/lib/growth/revenue-attribution/record-attribution-touch"
import type { GrowthAttributionTouchType } from "@/lib/growth/revenue-attribution/attribution-touch-types"
import { isGrowthSignalFoundationSchemaReady } from "@/lib/growth/signals/signal-schema-health"
import type { LeadSignalEvent } from "@/lib/growth/signal-intelligence/lead-signal-event-types"
import { LEAD_SIGNAL_EVENT_ROUTER_QA_MARKER } from "@/lib/growth/signal-intelligence/lead-signal-event-types"
import { scoreLeadSignalEvent } from "@/lib/growth/signal-intelligence/signal-event-scoring"

type SignalEventAuditRow = {
  event_type: "routed" | "rejected_duplicate" | "error"
  organization_id: string | null
  event_payload: Record<string, unknown>
  occurred_at: string
}

function timelineEventTypeForSignal(event: LeadSignalEvent): GrowthLeadTimelineEventType {
  switch (event.signalType) {
    case "reply_received":
      return "reply_workflow_routed"
    case "positive_reply":
      return "reply_buying_signal_detected"
    case "negative_reply":
      return "reply_objection_detected"
    case "meeting_requested":
      return "meeting_requested"
    case "meeting_booked":
      return "meeting_scheduled"
    case "meeting_completed":
      return "meeting_completed"
    case "meeting_no_show":
      return "meeting_no_show"
    case "opportunity_created":
      return "opportunity_created"
    case "stage_advanced":
      return "opportunity_stage_changed"
    case "deal_won":
      return "opportunity_closed_won"
    case "deal_lost":
      return "opportunity_closed_lost"
    default:
      return "reply_workflow_routed"
  }
}

function attributionTouchTypeForSignal(event: LeadSignalEvent): GrowthAttributionTouchType | null {
  switch (event.signalType) {
    case "reply_received":
    case "positive_reply":
    case "negative_reply":
    case "meeting_requested":
      return "reply"
    case "meeting_booked":
    case "meeting_completed":
    case "meeting_no_show":
      return "meeting"
    case "opportunity_created":
      return "opportunity_created"
    case "deal_won":
      return "opportunity_won"
    default:
      return null
  }
}

function buildAuditPayload(
  event: LeadSignalEvent,
  dedupeHash: string,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const scored = scoreLeadSignalEvent(event)
  return {
    qa_marker: LEAD_SIGNAL_EVENT_ROUTER_QA_MARKER,
    dedupe_hash: dedupeHash,
    lead_id: event.leadId,
    organization_id: event.organizationId ?? null,
    source_domain: event.sourceDomain,
    signal_type: event.signalType,
    confidence: event.confidence,
    urgency: scored.urgency,
    signal_score: scored.signal_score,
    routing_priority: scored.routing_priority,
    evidence_ref: event.evidenceRef,
    attribution_impacting: event.attributionImpacting,
    recompute_scope: event.recomputeScope,
    route_actions: event.routeActions,
    metadata: event.metadata ?? {},
    occurred_at: event.occurredAt ?? new Date().toISOString(),
    ...extra,
  }
}

export async function persistLeadSignalAuditEvent(
  admin: SupabaseClient,
  row: SignalEventAuditRow,
): Promise<string | null> {
  if (!(await isGrowthSignalFoundationSchemaReady(admin))) return null

  const { data, error } = await admin
    .schema("growth")
    .from("signal_events")
    .insert({
      signal_id: null,
      organization_id: row.organization_id,
      event_type: row.event_type,
      event_payload: row.event_payload,
      occurred_at: row.occurred_at,
    })
    .select("id")
    .single()

  if (error) return null
  return typeof data?.id === "string" ? data.id : null
}

export async function persistDuplicateLeadSignalAudit(
  admin: SupabaseClient,
  event: LeadSignalEvent,
  dedupeHash: string,
): Promise<string | null> {
  return persistLeadSignalAuditEvent(admin, {
    event_type: "rejected_duplicate",
    organization_id: event.organizationId ?? null,
    occurred_at: event.occurredAt ?? new Date().toISOString(),
    event_payload: buildAuditPayload(event, dedupeHash, { router_outcome: "duplicate" }),
  })
}

export async function persistRoutedLeadSignalAudit(
  admin: SupabaseClient,
  event: LeadSignalEvent,
  dedupeHash: string,
): Promise<string | null> {
  return persistLeadSignalAuditEvent(admin, {
    event_type: "routed",
    organization_id: event.organizationId ?? null,
    occurred_at: event.occurredAt ?? new Date().toISOString(),
    event_payload: buildAuditPayload(event, dedupeHash, { router_outcome: "routed" }),
  })
}

export async function emitLeadSignalTimelineEvent(
  admin: SupabaseClient,
  event: LeadSignalEvent,
): Promise<boolean> {
  if (!event.routeActions.includes("timeline")) return false

  const eventType = timelineEventTypeForSignal(event)
  await appendGrowthLeadTimelineEvent(admin, {
    leadId: event.leadId,
    eventType,
    title: `Signal routed: ${event.signalType.replace(/_/g, " ")}`,
    summary: `Lead signal event (${event.sourceDomain}) scored and routed through signal intelligence.`,
    occurredAt: event.occurredAt,
    payload: {
      qa_marker: LEAD_SIGNAL_EVENT_ROUTER_QA_MARKER,
      source_domain: event.sourceDomain,
      signal_type: event.signalType,
      evidence_ref: event.evidenceRef,
      confidence: event.confidence,
      urgency: event.urgency,
      metadata: event.metadata ?? {},
    },
  }).catch(() => undefined)

  return true
}

export async function recordLeadSignalAttributionTouch(
  admin: SupabaseClient,
  event: LeadSignalEvent,
): Promise<boolean> {
  if (!event.attributionImpacting) return false
  if (!event.routeActions.includes("attribution_touch")) return false

  const touchType = attributionTouchTypeForSignal(event)
  if (!touchType) return false

  const opportunityId =
    typeof event.metadata?.opportunity_id === "string" ? event.metadata.opportunity_id : null

  await recordAttributionTouch(admin, {
    leadId: event.leadId,
    touchType,
    touchedAt: event.occurredAt,
    opportunityId,
    attributionSource: LEAD_SIGNAL_EVENT_ROUTER_QA_MARKER,
    attributionConfidence: event.confidence,
    metadata: {
      signal_type: event.signalType,
      source_domain: event.sourceDomain,
      evidence_ref: event.evidenceRef,
      ...(event.metadata ?? {}),
    },
  }).catch(() => undefined)

  return true
}
