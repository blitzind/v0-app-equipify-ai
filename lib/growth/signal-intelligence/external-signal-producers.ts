/** External signal producers + normalize/route bridge — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthCompanyGrowthSignalType } from "@/lib/growth/company-growth-signals/company-growth-signal-types"
import type { GrowthSearchIntentCategory } from "@/lib/growth/search-intent/search-intent-types"
import {
  externalSignalConfidenceFromWeight,
  externalSignalRoutingPriority,
  externalSignalWeightPoints,
  externalSignalCommandCenterBoost,
} from "@/lib/growth/signal-intelligence/external-signal-scoring"
import {
  LEAD_SIGNAL_EVENT_ROUTER_QA_MARKER,
  type LeadSignalEvent,
  type LeadSignalRouteAction,
  type LeadSignalType,
  type LeadSignalUrgency,
  type RouteExternalSignalBatchResult,
  SIGNAL_EXTERNAL_BRIDGE_QA_MARKER,
} from "@/lib/growth/signal-intelligence/lead-signal-event-types"
import { matchSignalToLead, type SignalLeadMatchInput } from "@/lib/growth/signal-intelligence/signal-lead-matcher"
import { routeLeadSignalEvent } from "@/lib/growth/signal-intelligence/route-lead-signal-event"
import { persistUnmatchedExternalSignalAudit } from "@/lib/growth/signal-intelligence/signal-event-audit"
import { mergeSignalQueueHints } from "@/lib/growth/signal-intelligence/signal-queue-hints"

export type ExternalSignalSourceSystem =
  | "company_growth_signals"
  | "search_intent_signals"
  | "intent_pageview_events"
  | "growth.signals"

export type NormalizedExternalSignalInput = {
  source_system: ExternalSignalSourceSystem
  signal_type: LeadSignalType
  evidence_ref: { table: string; id: string }
  match: SignalLeadMatchInput
  confidence?: number
  urgency?: LeadSignalUrgency
  organization_id?: string | null
  occurred_at?: string
  metadata?: Record<string, unknown>
}

const COMPANY_TYPE_MAP: Partial<Record<GrowthCompanyGrowthSignalType, LeadSignalType>> = {
  hiring_technicians: "company_hiring",
  hiring_operations: "company_hiring",
  expansion: "expansion_event",
  new_location: "expansion_event",
  funding_or_acquisition: "funding_event",
  technology_change: "technology_change",
  competitor_detected: "competitor_search",
  buying_intent: "high_intent_search",
}

const SEARCH_CATEGORY_MAP: Partial<Record<GrowthSearchIntentCategory, LeadSignalType>> = {
  vendor_comparison: "competitor_search",
  competitor_research: "competitor_search",
  pricing_research: "pricing_page_visit",
  demo_intent: "demo_page_visit",
  solution_aware: "category_interest",
  problem_aware: "category_interest",
  urgent_service_need: "high_intent_search",
}

function defaultRouteActions(signalType: LeadSignalType): LeadSignalRouteAction[] {
  const actions: LeadSignalRouteAction[] = ["timeline", "attention"]
  if (
    signalType === "high_intent_search" ||
    signalType === "category_interest" ||
    signalType === "pricing_page_visit" ||
    signalType === "demo_page_visit" ||
    signalType === "contact_page_visit" ||
    signalType === "company_hiring" ||
    signalType === "expansion_event" ||
    signalType === "repeat_visit"
  ) {
    actions.push("queue_hint")
  }
  return actions
}

function sourceDomainForSignal(signalType: LeadSignalType): LeadSignalEvent["sourceDomain"] {
  if (
    signalType === "company_hiring" ||
    signalType === "leadership_change" ||
    signalType === "funding_event" ||
    signalType === "technology_change" ||
    signalType === "expansion_event"
  ) {
    return "company"
  }
  return "external"
}

export function normalizeLeadSignalEvent(input: NormalizedExternalSignalInput): Omit<LeadSignalEvent, "leadId"> {
  const weight = externalSignalWeightPoints(input.signal_type)
  const confidence = input.confidence ?? externalSignalConfidenceFromWeight(input.signal_type)
  const urgency =
    input.urgency ??
    (weight >= 20 ? "urgent" : weight >= 15 ? "high" : weight >= 10 ? "normal" : "low")

  return {
    sourceDomain: sourceDomainForSignal(input.signal_type),
    signalType: input.signal_type,
    confidence,
    urgency,
    evidenceRef: input.evidence_ref,
    attributionImpacting: false,
    recomputeScope: "full",
    routeActions: defaultRouteActions(input.signal_type),
    organizationId: input.organization_id ?? null,
    occurredAt: input.occurred_at,
    metadata: {
      qa_marker: SIGNAL_EXTERNAL_BRIDGE_QA_MARKER,
      source_system: input.source_system,
      external_signal_weight: weight,
      routing_priority: externalSignalRoutingPriority(input.signal_type),
      ...(input.metadata ?? {}),
    },
  }
}

export function mapCompanyGrowthSignalType(type: GrowthCompanyGrowthSignalType): LeadSignalType {
  return COMPANY_TYPE_MAP[type] ?? "expansion_event"
}

export function mapSearchIntentCategory(category: GrowthSearchIntentCategory): LeadSignalType {
  return SEARCH_CATEGORY_MAP[category] ?? "high_intent_search"
}

export function mapPagePathToWebsiteIntentSignal(pagePath: string, visitCount = 1): LeadSignalType {
  const path = pagePath.toLowerCase()
  if (/\/pricing\b|\/plans\b|\/quote\b/.test(path)) return "pricing_page_visit"
  if (/\/demo\b|\/request-demo\b|\/book-demo\b/.test(path)) return "demo_page_visit"
  if (/\/contact\b|\/get-in-touch\b/.test(path)) return "contact_page_visit"
  if (visitCount >= 2) return "repeat_visit"
  return "high_engagement_visit"
}

export function buildLeadSignalEventForMatch(
  draft: Omit<LeadSignalEvent, "leadId">,
  leadId: string,
  match: { match_source: string; confidence: number },
): LeadSignalEvent {
  return {
    ...draft,
    leadId,
    metadata: {
      ...(draft.metadata ?? {}),
      match_source: match.match_source,
      match_confidence: match.confidence,
    },
  }
}

export async function routeNormalizedExternalSignal(
  admin: SupabaseClient,
  input: NormalizedExternalSignalInput,
): Promise<RouteExternalSignalBatchResult> {
  const draft = normalizeLeadSignalEvent(input)
  const { matches } = await matchSignalToLead(admin, input.match)

  if (matches.length === 0) {
    const unmatchedAuditId = await persistUnmatchedExternalSignalAudit(admin, {
      source_system: input.source_system,
      signal_type: input.signal_type,
      evidence_ref: input.evidence_ref,
      match: input.match,
      metadata: draft.metadata ?? {},
      occurred_at: input.occurred_at,
      organization_id: input.organization_id ?? null,
    })

    return {
      qa_marker: SIGNAL_EXTERNAL_BRIDGE_QA_MARKER,
      ok: true,
      matched_lead_count: 0,
      routed_count: 0,
      unmatched_audit_event_id: unmatchedAuditId,
      results: [],
      queue_hints: [],
    }
  }

  const results = []
  for (const match of matches) {
    results.push(
      await routeLeadSignalEvent(admin, buildLeadSignalEventForMatch(draft, match.lead_id, match)),
    )
  }

  return {
    qa_marker: SIGNAL_EXTERNAL_BRIDGE_QA_MARKER,
    ok: true,
    matched_lead_count: matches.length,
    routed_count: results.filter((result) => !result.duplicate).length,
    unmatched_audit_event_id: null,
    results,
    queue_hints: mergeSignalQueueHints(results.map((result) => result.queue_hint)),
  }
}

export async function routeNormalizedExternalSignals(
  admin: SupabaseClient,
  inputs: NormalizedExternalSignalInput[],
): Promise<RouteExternalSignalBatchResult[]> {
  const batches: RouteExternalSignalBatchResult[] = []
  for (const input of inputs) {
    batches.push(await routeNormalizedExternalSignal(admin, input))
  }
  return batches
}

export function isExternalSignalBridgeEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return (
    env.GROWTH_SIGNAL_INTELLIGENCE_ENABLED?.trim().toLowerCase() === "true" &&
    (env.GROWTH_SIGNAL_INTELLIGENCE_ACK?.trim() === "1" ||
      env.GROWTH_SIGNAL_INTELLIGENCE_ACK?.trim().toLowerCase() === "true")
  )
}

export async function bridgeSearchIntentSignalRow(
  admin: SupabaseClient,
  row: {
    id: string
    intent_category: string
    company_domain?: string | null
    company_name?: string | null
    intent_score?: number
    created_at?: string
  },
): Promise<RouteExternalSignalBatchResult | null> {
  if (!isExternalSignalBridgeEnabled()) return null
  const signalType = mapSearchIntentCategory(row.intent_category as GrowthSearchIntentCategory)
  return routeNormalizedExternalSignal(admin, {
    source_system: "search_intent_signals",
    signal_type: signalType,
    evidence_ref: { table: "search_intent_signals", id: row.id },
    match: { domain: row.company_domain ?? null, company_name: row.company_name ?? null },
    confidence: Math.min(1, (row.intent_score ?? 50) / 100),
    occurred_at: row.created_at,
  })
}

export async function bridgeCompanyGrowthSignalRow(
  admin: SupabaseClient,
  row: {
    id: string
    company_id: string
    signal_type: GrowthCompanyGrowthSignalType
    confidence_score?: number
    detected_at?: string
  },
): Promise<RouteExternalSignalBatchResult | null> {
  if (!isExternalSignalBridgeEnabled()) return null
  return routeNormalizedExternalSignal(admin, {
    source_system: "company_growth_signals",
    signal_type: mapCompanyGrowthSignalType(row.signal_type),
    evidence_ref: { table: "company_growth_signals", id: row.id },
    match: { company_id: row.company_id },
    confidence: Math.min(1, (row.confidence_score ?? 70) / 100),
    occurred_at: row.detected_at,
  })
}

export async function bridgeIntentPageviewEvent(
  admin: SupabaseClient,
  input: {
    pageview_id: string
    page_path: string
    company_domain?: string | null
    visit_count?: number
    captured_at?: string
  },
): Promise<RouteExternalSignalBatchResult | null> {
  if (!isExternalSignalBridgeEnabled()) return null
  const signalType = mapPagePathToWebsiteIntentSignal(input.page_path, input.visit_count ?? 1)
  return routeNormalizedExternalSignal(admin, {
    source_system: "intent_pageview_events",
    signal_type: signalType,
    evidence_ref: { table: "intent_pageview_events", id: input.pageview_id },
    match: { domain: input.company_domain ?? null },
    occurred_at: input.captured_at,
    metadata: { page_path: input.page_path, visit_count: input.visit_count ?? 1 },
  })
}

export async function loadRecentExternalSignalBoostsByLead(
  admin: SupabaseClient,
  leadIds: string[],
): Promise<Map<string, number>> {
  const boosts = new Map<string, number>()
  if (leadIds.length === 0) return boosts

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await admin
    .schema("growth")
    .from("signal_events")
    .select("event_payload, occurred_at")
    .eq("event_type", "routed")
    .gte("occurred_at", since)
    .contains("event_payload", { qa_marker: LEAD_SIGNAL_EVENT_ROUTER_QA_MARKER })
    .order("occurred_at", { ascending: false })
    .limit(500)

  for (const row of data ?? []) {
    const payload = row.event_payload as Record<string, unknown> | null
    const leadId = typeof payload?.lead_id === "string" ? payload.lead_id : null
    const signalType = typeof payload?.signal_type === "string" ? payload.signal_type : null
    const sourceDomain = typeof payload?.source_domain === "string" ? payload.source_domain : null
    if (!leadId || !signalType || !leadIds.includes(leadId)) continue
    if (sourceDomain !== "external" && sourceDomain !== "company") continue
    const current = boosts.get(leadId) ?? 0
    boosts.set(
      leadId,
      current + externalSignalCommandCenterBoost(signalType as LeadSignalType),
    )
  }

  return boosts
}
