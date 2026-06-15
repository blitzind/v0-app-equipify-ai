/** Phase GS-4C — Deterministic realtime event routing (client-safe). */

import {
  REALTIME_EVENTS_QA_MARKER,
  type GrowthRealtimeEventRoute,
  type GrowthRealtimeEventSource,
  type GrowthRealtimeEventSubscriber,
} from "@/lib/growth/realtime-events/realtime-events-types"

const QA_MARKER_ROUTES: Record<string, GrowthRealtimeEventSubscriber[]> = {
  "growth-signal-feed-gs1d-v1": ["command_center", "signal_feed", "operator_inbox", "opportunity_intelligence"],
  "growth-operator-inbox-gs1e-v1": ["operator_inbox", "command_center", "inbox_v2"],
  "growth-campaign-readiness-gs2e-v1": ["campaign_readiness", "command_center", "campaign_builder"],
  "growth-conversational-playbooks-gs3d-v1": ["conversational_playbooks", "inbox_v2", "command_center"],
  "growth-human-interventions-gs3e-v1": ["human_interventions", "operator_inbox", "command_center"],
  "growth-follow-up-policies-gs5c-v1": ["follow_up_policies", "operator_inbox", "command_center"],
  "growth-sequence-preview-gs5b-v1": ["sequence_preview", "campaign_builder", "command_center"],
  "growth-campaign-builder-gs5d-v1": ["campaign_builder", "campaign_readiness", "command_center"],
  "growth-realtime-events-gs4c-v1": ["command_center", "operator_inbox"],
}

const SOURCE_ROUTES: Record<GrowthRealtimeEventSource, GrowthRealtimeEventSubscriber[]> = {
  signal_feed: ["signal_feed", "command_center", "operator_inbox"],
  operator_inbox: ["operator_inbox", "inbox_v2", "command_center"],
  campaign_readiness: ["campaign_readiness", "campaign_builder", "command_center"],
  human_interventions: ["human_interventions", "operator_inbox", "command_center"],
  follow_up_policies: ["follow_up_policies", "operator_inbox", "command_center"],
  sequence_preview: ["sequence_preview", "campaign_builder", "command_center"],
  campaign_builder: ["campaign_builder", "campaign_readiness", "command_center"],
  conversational_playbooks: ["conversational_playbooks", "inbox_v2", "command_center"],
  realtime_event_bus: ["command_center", "operator_inbox"],
  attention_feed: ["operator_inbox", "inbox_v2", "command_center"],
  unknown: ["command_center"],
}

function buildRouteHref(subscriber: GrowthRealtimeEventSubscriber, leadId: string | null): string | null {
  const q = leadId ? `?leadId=${encodeURIComponent(leadId)}` : ""
  switch (subscriber) {
    case "command_center":
      return `/admin/growth/command${q}`
    case "operator_inbox":
      return `/admin/growth/command${q}`
    case "inbox_v2":
      return `/admin/growth/inbox${q}`
    case "campaign_readiness":
    case "campaign_builder":
    case "sequence_preview":
      return `/admin/growth/sequences/builder${q}`
    case "human_interventions":
    case "follow_up_policies":
    case "conversational_playbooks":
      return `/admin/growth/command${q}`
    case "opportunity_intelligence":
      return `/admin/growth/opportunities${q}`
    case "signal_feed":
      return `/admin/growth/command${q}`
    default:
      return null
  }
}

/**
 * Deterministic routing — maps events to UI refresh subscribers only (no execution).
 */
export function routeGrowthRealtimeEvent(input: {
  event_type: string
  source: GrowthRealtimeEventSource
  qa_marker?: string | null
  lead_id?: string | null
}): GrowthRealtimeEventRoute[] {
  const fromMarker = input.qa_marker ? QA_MARKER_ROUTES[input.qa_marker] ?? [] : []
  const fromSource = SOURCE_ROUTES[input.source] ?? SOURCE_ROUTES.unknown
  const subscribers = [...new Set([...fromMarker, ...fromSource])]

  if (/inbox|reply|thread/i.test(input.event_type)) {
    if (!subscribers.includes("inbox_v2")) subscribers.push("inbox_v2")
  }
  if (/intervention|approval/i.test(input.event_type)) {
    if (!subscribers.includes("human_interventions")) subscribers.push("human_interventions")
  }

  return subscribers.map((subscriber) => ({
    route_id: `route_${subscriber}_${input.event_type}`,
    subscriber,
    refresh_hint: `Refresh ${subscriber.replace(/_/g, " ")} panels — planning signal only`,
    related_href: buildRouteHref(subscriber, input.lead_id ?? null),
    priority: subscriber === "command_center" || subscriber === "operator_inbox" ? "high" : "medium",
  }))
}

export function resolveSourceFromPayload(payload: Record<string, unknown>): GrowthRealtimeEventSource {
  const qa = typeof payload.qa_marker === "string" ? payload.qa_marker : ""
  if (qa.includes("signal-feed")) return "signal_feed"
  if (qa.includes("operator-inbox")) return "operator_inbox"
  if (qa.includes("campaign-readiness")) return "campaign_readiness"
  if (qa.includes("human-interventions")) return "human_interventions"
  if (qa.includes("follow-up-policies")) return "follow_up_policies"
  if (qa.includes("sequence-preview")) return "sequence_preview"
  if (qa.includes("campaign-builder")) return "campaign_builder"
  if (qa.includes("conversational-playbooks")) return "conversational_playbooks"
  if (qa.includes("realtime-events")) return "realtime_event_bus"

  const source = typeof payload.source === "string" ? payload.source : ""
  if (SOURCE_ROUTES[source as GrowthRealtimeEventSource]) return source as GrowthRealtimeEventSource
  return "unknown"
}

export function buildEnvelope(input: {
  event_id: string
  event_type: string
  source: GrowthRealtimeEventSource
  organization_id: string
  payload: Record<string, unknown>
  created_at: string
}): GrowthRealtimeEventEnvelope {
  return {
    event_id: input.event_id,
    event_type: input.event_type,
    source: input.source,
    organization_id: input.organization_id,
    payload: {
      ...input.payload,
      qa_marker: REALTIME_EVENTS_QA_MARKER,
    },
    created_at: input.created_at,
    requires_human_review: true,
    autonomous_execution_enabled: false,
    outreach_execution: false,
    enrollment_execution: false,
  }
}
