/** Signal Feed repository — server-only. Reads routed signal_events, no duplicate stores. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { commandLeadFocusHref } from "@/lib/growth/command/command-action-catalog"
import {
  LEAD_SIGNAL_EVENT_ROUTER_QA_MARKER,
  type LeadSignalEvent,
  type LeadSignalRouteAction,
  type LeadSignalSourceDomain,
  type LeadSignalType,
  type LeadSignalUrgency,
} from "@/lib/growth/signal-intelligence/lead-signal-event-types"
import { isGrowthSignalFoundationSchemaReady } from "@/lib/growth/signals/signal-schema-health"
import {
  SIGNAL_FEED_QA_MARKER,
  type GrowthSignalFeedItem,
  type GrowthSignalFeedResponse,
  type SignalFeedActionType,
  type SignalFeedFilter,
  type SignalFeedSortField,
  type SignalFeedStatus,
} from "@/lib/growth/signal-intelligence/signal-feed-types"
import { buildSignalRecommendations } from "@/lib/growth/signal-intelligence/signal-recommendation-engine"
import { commandCenterLabelForSignalType } from "@/lib/growth/signal-intelligence/signal-queue-hints"

type RawAuditRow = {
  id: string
  event_type: string
  event_payload: Record<string, unknown>
  occurred_at: string
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function parseFeedStatus(payload: Record<string, unknown>): SignalFeedStatus {
  const status = asString(payload.feed_status)
  if (status === "viewed" || status === "acted_on" || status === "dismissed") return status
  return "new"
}

function signalLabel(signalType: string): string {
  const mapped = commandCenterLabelForSignalType(signalType as LeadSignalType)
  if (mapped) return mapped
  return signalType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function urgencyRank(urgency: string): number {
  if (urgency === "urgent") return 4
  if (urgency === "high") return 3
  if (urgency === "normal") return 2
  return 1
}

function filterMatches(item: GrowthSignalFeedItem, filter: SignalFeedFilter | null): boolean {
  if (!filter) return true
  if (filter === "new") return item.status === "new"
  if (filter === "hot") return item.priority === "urgent" || item.priority === "high"
  if (filter === "company") return item.source_domain === "company"
  if (filter === "external") return item.source_domain === "external"
  if (filter === "meeting") {
    return (
      item.signal_type.startsWith("meeting_") ||
      item.recommended_action.toLowerCase().includes("meeting")
    )
  }
  if (filter === "opportunity") {
    return (
      item.signal_type.includes("opportunity") ||
      item.signal_type === "stage_advanced" ||
      item.signal_type === "deal_won" ||
      item.signal_type === "deal_lost"
    )
  }
  if (filter === "engagement") {
    return (
      item.source_domain === "external" ||
      item.signal_type.includes("reply") ||
      item.signal_type.includes("visit") ||
      item.signal_type.includes("engagement")
    )
  }
  return true
}

function sortItems(items: GrowthSignalFeedItem[], sort: SignalFeedSortField): GrowthSignalFeedItem[] {
  return [...items].sort((a, b) => {
    if (sort === "confidence") return b.confidence - a.confidence
    if (sort === "urgency") return urgencyRank(b.urgency) - urgencyRank(a.urgency)
    return Date.parse(b.occurred_at) - Date.parse(a.occurred_at)
  })
}

function collapseByDedupeHash(items: GrowthSignalFeedItem[]): {
  items: GrowthSignalFeedItem[]
  collapsed_from: number
} {
  const byHash = new Map<string, GrowthSignalFeedItem>()
  const noHash: GrowthSignalFeedItem[] = []

  for (const item of items) {
    if (!item.dedupe_hash) {
      noHash.push(item)
      continue
    }
    const existing = byHash.get(item.dedupe_hash)
    if (!existing) {
      byHash.set(item.dedupe_hash, item)
      continue
    }
    existing.collapsed_count += 1
    if (Date.parse(item.occurred_at) > Date.parse(existing.occurred_at)) {
      byHash.set(item.dedupe_hash, { ...item, collapsed_count: existing.collapsed_count })
    }
  }

  const collapsed = [...byHash.values(), ...noHash]
  return { items: collapsed, collapsed_from: items.length }
}

async function loadLeadContextMap(
  admin: SupabaseClient,
  leadIds: string[],
): Promise<Map<string, LeadFeedContext>> {
  const map = new Map<string, LeadFeedContext>()
  if (leadIds.length === 0) return map

  const { data } = await admin
    .schema("growth")
    .from("leads")
    .select(
      "id, company_name, score, engagement_score, engagement_tier, opportunity_readiness_score, opportunity_readiness_tier, revenue_probability_score",
    )
    .in("id", leadIds)

  for (const row of data ?? []) {
    const id = asString((row as Record<string, unknown>).id)
    if (!id) continue
    map.set(id, {
      company_name: asString((row as Record<string, unknown>).company_name) || "Unknown",
      score: asNumber((row as Record<string, unknown>).score),
      engagement_score: asNumber((row as Record<string, unknown>).engagement_score),
      engagement_tier: asString((row as Record<string, unknown>).engagement_tier) || null,
      opportunity_readiness_score: asNumber((row as Record<string, unknown>).opportunity_readiness_score),
      opportunity_readiness_tier: asString((row as Record<string, unknown>).opportunity_readiness_tier) || null,
      revenue_probability_score: asNumber((row as Record<string, unknown>).revenue_probability_score),
    })
  }
  return map
}

type LeadFeedContext = {
  company_name: string
  score: number | null
  engagement_score: number | null
  engagement_tier: string | null
  opportunity_readiness_score: number | null
  opportunity_readiness_tier: string | null
  revenue_probability_score: number | null
}

function mapAuditRowToFeedItem(
  row: RawAuditRow,
  leadContext: LeadFeedContext | undefined,
  leadId: string | null,
): GrowthSignalFeedItem | null {
  const payload = row.event_payload
  const qaMarker = asString(payload.qa_marker)
  if (qaMarker !== LEAD_SIGNAL_EVENT_ROUTER_QA_MARKER) return null
  if (row.event_type !== "routed") return null
  if (asString(payload.router_outcome) === "unmatched_external_signal") return null

  const signalType = asString(payload.signal_type) as LeadSignalType
  if (!signalType) return null

  const sourceDomain = asString(payload.source_domain) as LeadSignalSourceDomain
  const confidence = asNumber(payload.confidence) ?? 0.5
  const urgency = (asString(payload.urgency) || "normal") as LeadSignalUrgency
  const routeActions = Array.isArray(payload.route_actions)
    ? (payload.route_actions as string[]).filter((a) => typeof a === "string")
    : ["timeline", "attention"]

  const recommendation = buildSignalRecommendations({
    event: {
      signalType,
      sourceDomain,
      confidence,
      urgency,
      routeActions: routeActions as LeadSignalRouteAction[],
      metadata: (payload.metadata as Record<string, unknown>) ?? {},
    },
    lead: leadContext
      ? {
          score: leadContext.score,
          engagement_score: leadContext.engagement_score,
          engagement_tier: leadContext.engagement_tier,
          opportunity_readiness_score: leadContext.opportunity_readiness_score,
          opportunity_readiness_tier: leadContext.opportunity_readiness_tier,
          revenue_probability_score: leadContext.revenue_probability_score,
        }
      : null,
  })

  const effectiveLeadId = leadId ?? (asString(payload.lead_id) || null)
  const companyName = leadContext?.company_name ?? null

  return {
    qa_marker: SIGNAL_FEED_QA_MARKER,
    id: row.id,
    audit_event_id: row.id,
    lead_id: effectiveLeadId,
    company_name: companyName,
    signal_type: signalType,
    signal_label: signalLabel(signalType),
    source_domain: sourceDomain,
    confidence,
    urgency,
    signal_score: asNumber(payload.signal_score),
    occurred_at: asString(payload.occurred_at) || row.occurred_at,
    recommended_action: recommendation.recommended_action,
    expected_impact: recommendation.expected_impact,
    reasoning: recommendation.reasoning,
    priority: recommendation.priority,
    status: parseFeedStatus(payload),
    dedupe_hash: asString(payload.dedupe_hash) || null,
    collapsed_count: 1,
    queue_hint: recommendation.queue_hint,
    cta: {
      view_lead: effectiveLeadId ? commandLeadFocusHref(effectiveLeadId, "command") : null,
      review_company: effectiveLeadId ? commandLeadFocusHref(effectiveLeadId, "research") : null,
      open_timeline: effectiveLeadId ? commandLeadFocusHref(effectiveLeadId, "timeline") : null,
      review_sequence:
        recommendation.queue_hint?.hint_type === "recommend_sequence" && effectiveLeadId
          ? commandLeadFocusHref(effectiveLeadId, "sequence")
          : null,
    },
    requires_human_approval: true,
  }
}

export async function loadGrowthSignalFeed(
  admin: SupabaseClient,
  input?: {
    lead_id?: string | null
    filter?: SignalFeedFilter | null
    sort?: SignalFeedSortField
    limit?: number
    since?: string | null
  },
): Promise<GrowthSignalFeedResponse> {
  const empty: GrowthSignalFeedResponse = {
    qa_marker: SIGNAL_FEED_QA_MARKER,
    generated_at: new Date().toISOString(),
    total: 0,
    collapsed_from: 0,
    items: [],
    hot_signals: [],
  }

  if (!(await isGrowthSignalFoundationSchemaReady(admin))) return empty

  const since =
    input?.since ??
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const limit = Math.min(input?.limit ?? 100, 500)

  let query = admin
    .schema("growth")
    .from("signal_events")
    .select("id, event_type, event_payload, occurred_at")
    .eq("event_type", "routed")
    .contains("event_payload", { qa_marker: LEAD_SIGNAL_EVENT_ROUTER_QA_MARKER })
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(limit * 3)

  if (input?.lead_id) {
    query = query.contains("event_payload", { lead_id: input.lead_id })
  }

  const { data, error } = await query
  if (error || !data) return empty

  const rows = data as RawAuditRow[]
  const leadIds = [
    ...new Set(
      rows
        .map((row) => asString(row.event_payload.lead_id))
        .filter(Boolean),
    ),
  ]
  const leadMap = await loadLeadContextMap(admin, leadIds)

  const mapped: GrowthSignalFeedItem[] = []
  for (const row of rows) {
    const leadId = asString(row.event_payload.lead_id) || null
    const leadContext = leadId ? leadMap.get(leadId) : undefined
    const item = mapAuditRowToFeedItem(row, leadContext, leadId)
    if (!item) continue
    if (input?.filter && !filterMatches(item, input.filter)) continue
    mapped.push(item)
  }

  const { items: collapsed, collapsed_from } = collapseByDedupeHash(mapped)
  const sorted = sortItems(collapsed, input?.sort ?? "occurred_at").slice(0, limit)
  const hot_signals = sorted.filter(
    (item) => item.priority === "urgent" || item.priority === "high" || item.status === "new",
  ).slice(0, 12)

  return {
    qa_marker: SIGNAL_FEED_QA_MARKER,
    generated_at: new Date().toISOString(),
    total: sorted.length,
    collapsed_from,
    items: sorted,
    hot_signals,
  }
}

export async function applySignalFeedAction(
  admin: SupabaseClient,
  input: { audit_event_id: string; action: SignalFeedActionType },
): Promise<{ ok: boolean; status: SignalFeedStatus | null; error?: string }> {
  if (!(await isGrowthSignalFoundationSchemaReady(admin))) {
    return { ok: false, status: null, error: "schema_not_ready" }
  }

  const statusMap: Record<SignalFeedActionType, SignalFeedStatus> = {
    mark_viewed: "viewed",
    mark_acted_on: "acted_on",
    dismiss: "dismissed",
  }
  const nextStatus = statusMap[input.action]

  const { data, error: fetchError } = await admin
    .schema("growth")
    .from("signal_events")
    .select("id, event_payload")
    .eq("id", input.audit_event_id)
    .maybeSingle()

  if (fetchError || !data) {
    return { ok: false, status: null, error: "not_found" }
  }

  const payload = (data.event_payload as Record<string, unknown>) ?? {}
  const updatedPayload = {
    ...payload,
    feed_status: nextStatus,
    feed_status_at: new Date().toISOString(),
    feed_status_action: input.action,
  }

  const { error: updateError } = await admin
    .schema("growth")
    .from("signal_events")
    .update({ event_payload: updatedPayload })
    .eq("id", input.audit_event_id)

  if (updateError) {
    return { ok: false, status: null, error: updateError.message }
  }

  return { ok: true, status: nextStatus }
}

export async function loadCommandCenterHotSignals(
  admin: SupabaseClient,
  limit = 8,
): Promise<GrowthSignalFeedItem[]> {
  const feed = await loadGrowthSignalFeed(admin, {
    sort: "urgency",
    limit: Math.max(limit * 3, 24),
  })
  const hot = feed.hot_signals.length > 0 ? feed.hot_signals : feed.items
  return hot.slice(0, limit)
}
