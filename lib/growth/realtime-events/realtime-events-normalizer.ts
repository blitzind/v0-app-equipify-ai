/** Phase GS-4C — Normalize growth.signal_events rows to realtime bus events (client-safe). */

import { routeGrowthRealtimeEvent, resolveSourceFromPayload } from "@/lib/growth/realtime-events/realtime-events-router"
import {
  REALTIME_EVENTS_QA_MARKER,
  type GrowthRealtimeEvent,
  type GrowthRealtimeEventDeliveryStatus,
  type GrowthRealtimeEventSource,
} from "@/lib/growth/realtime-events/realtime-events-types"

export type RawSignalEventRow = {
  id: string
  organization_id: string
  event_type: string
  event_payload: Record<string, unknown>
  occurred_at: string
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function resolveTitle(eventType: string, payload: Record<string, unknown>): string {
  const logical = asString(payload.logical_event_type)
  const eventName = asString(payload.event_name)
  if (eventName) return eventName.replace(/_/g, " ")
  if (logical) return logical.replace(/[._]/g, " ")
  return eventType.replace(/_/g, " ")
}

function resolveDescription(payload: Record<string, unknown>): string {
  const parts: string[] = []
  const qa = asString(payload.qa_marker)
  if (qa) parts.push(`Source marker: ${qa}`)
  if (payload.human_intervention) parts.push("Human intervention signal")
  if (payload.follow_up_policy) parts.push("Follow-up policy signal")
  if (payload.sequence_preview) parts.push("Sequence preview signal")
  if (payload.campaign_builder) parts.push("Campaign builder signal")
  if (payload.realtime_event) parts.push("Realtime bus signal")
  if (parts.length === 0) parts.push("Growth engine event — refresh signal only, no autonomous execution")
  return parts.join(" · ")
}

function resolveDeliveryStatus(payload: Record<string, unknown>): GrowthRealtimeEventDeliveryStatus {
  const status = asString(payload.delivery_status)
  if (status === "routed" || status === "delivered" || status === "failed" || status === "reviewed" || status === "dismissed") {
    return status
  }
  if (asString(payload.event_name) === "realtime_event_routed") return "routed"
  if (payload.routes && Array.isArray(payload.routes) && payload.routes.length > 0) return "routed"
  return "pending"
}

function resolveReviewStatus(payload: Record<string, unknown>): GrowthRealtimeEvent["review_status"] {
  const eventName = asString(payload.event_name)
  if (eventName.includes("dismissed")) return "dismissed"
  if (eventName.includes("reviewed")) return "reviewed"
  return "pending"
}

function resolveRelatedEntity(payload: Record<string, unknown>): {
  type: string | null
  id: string | null
  href: string | null
} {
  const leadId = asString(payload.lead_id) || null
  if (leadId) {
    return {
      type: "lead",
      id: leadId,
      href: `/admin/growth/command?leadId=${encodeURIComponent(leadId)}`,
    }
  }
  const policyId = asString(payload.policy_id)
  if (policyId) return { type: "policy", id: policyId, href: null }
  const previewId = asString(payload.preview_id)
  if (previewId) return { type: "preview", id: previewId, href: null }
  const wizardId = asString(payload.wizard_id)
  if (wizardId) return { type: "wizard", id: wizardId, href: null }
  return { type: null, id: null, href: null }
}

/**
 * Normalize a growth.signal_events row into a GrowthRealtimeEvent.
 */
export function normalizeGrowthRealtimeEvent(row: RawSignalEventRow): GrowthRealtimeEvent {
  const payload = row.event_payload ?? {}
  const qa_marker = asString(payload.qa_marker) || null
  const source: GrowthRealtimeEventSource = resolveSourceFromPayload(payload)
  const lead_id = asString(payload.lead_id) || null
  const logical_event_type = asString(payload.logical_event_type) || row.event_type
  const routes =
    Array.isArray(payload.routes) && payload.routes.length > 0
      ? (payload.routes as GrowthRealtimeEvent["routes"])
      : routeGrowthRealtimeEvent({
          event_type: logical_event_type,
          source,
          qa_marker,
          lead_id,
        })

  const related = resolveRelatedEntity(payload)
  const created_at = row.occurred_at

  const envelope = {
    event_id: row.id,
    event_type: logical_event_type,
    source,
    organization_id: row.organization_id,
    payload,
    created_at,
    requires_human_review: true as const,
    autonomous_execution_enabled: false as const,
    outreach_execution: false as const,
    enrollment_execution: false as const,
  }

  return {
    qa_marker: REALTIME_EVENTS_QA_MARKER,
    event_id: row.id,
    event_type: logical_event_type,
    source,
    organization_id: row.organization_id,
    title: resolveTitle(row.event_type, payload),
    description: resolveDescription(payload),
    delivery_status: resolveDeliveryStatus(payload),
    routes,
    related_entity_type: related.type,
    related_entity_id: related.id,
    related_href: related.href,
    lead_id,
    review_status: resolveReviewStatus(payload),
    envelope,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
    occurred_at: created_at,
  }
}
