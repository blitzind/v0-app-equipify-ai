/** Phase GS-2D — Prospect recommendation repository — server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { commandLeadFocusHref } from "@/lib/growth/command/command-action-catalog"
import { generateProspectRecommendations } from "@/lib/growth/prospect-discovery/prospect-recommendation-engine"
import {
  PROSPECT_RECOMMENDATION_QA_MARKER,
  PROSPECT_RECOMMENDATION_TYPE_LABELS,
  type GrowthProspectRecommendationsResponse,
  type ProspectRecommendation,
  type ProspectRecommendationActionType,
  type ProspectRecommendationFilter,
  type ProspectRecommendationSortField,
  type ProspectRecommendationStatus,
  type TopProspectOpportunityCard,
} from "@/lib/growth/prospect-discovery/prospect-recommendation-types"
import { loadProspectExecutionRunById } from "@/lib/growth/prospect-discovery/prospect-execution-results"
import { isGrowthSignalFoundationSchemaReady } from "@/lib/growth/signals/signal-schema-health"
import type { GrowthSignalFeedItem } from "@/lib/growth/signal-intelligence/signal-feed-types"
import { SIGNAL_FEED_QA_MARKER } from "@/lib/growth/signal-intelligence/signal-feed-types"

type RawRecommendationRow = {
  id: string
  event_payload: Record<string, unknown>
  occurred_at: string
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function parseRecommendationStatus(payload: Record<string, unknown>): ProspectRecommendationStatus {
  const status = asString(payload.recommendation_status)
  if (status === "viewed" || status === "acted_on" || status === "dismissed") return status
  return "new"
}

function priorityRank(priority: string): number {
  if (priority === "urgent") return 4
  if (priority === "high") return 3
  if (priority === "medium") return 2
  return 1
}

function rowToRecommendation(row: RawRecommendationRow): ProspectRecommendation | null {
  const payload = row.event_payload ?? {}
  const rec = payload.recommendation as ProspectRecommendation | undefined
  if (!rec || rec.qa_marker !== PROSPECT_RECOMMENDATION_QA_MARKER) return null
  return {
    ...rec,
    audit_event_id: row.id,
    status: parseRecommendationStatus(payload),
    requires_human_approval: true,
    enrollment_enabled: false,
    outreach_enabled: false,
  }
}

function sortRecommendations(
  items: ProspectRecommendation[],
  sort: ProspectRecommendationSortField,
): ProspectRecommendation[] {
  return [...items].sort((a, b) => {
    if (sort === "confidence") return b.confidence - a.confidence
    if (sort === "estimated_revenue_impact") {
      return b.estimated_revenue_impact.sort_score - a.estimated_revenue_impact.sort_score
    }
    const byPriority = priorityRank(b.priority) - priorityRank(a.priority)
    if (byPriority !== 0) return byPriority
    return b.confidence - a.confidence
  })
}

function filterRecommendations(
  items: ProspectRecommendation[],
  filter: ProspectRecommendationFilter | null,
): ProspectRecommendation[] {
  if (!filter) return items
  return items.filter((item) => item.priority === filter && item.status !== "dismissed")
}

function buildCta(lead_id: string | null, company_id: string): TopProspectOpportunityCard["cta"] {
  if (lead_id) {
    return {
      review_company: commandLeadFocusHref(lead_id, "company"),
      view_signals: commandLeadFocusHref(lead_id, "signals"),
      review_sequence: commandLeadFocusHref(lead_id, "sequences"),
    }
  }
  const params = new URLSearchParams({ highlight: company_id, focus: "company" })
  return {
    review_company: `/admin/growth/prospect-search?${params.toString()}`,
    view_signals: `/admin/growth/prospect-search?${params.toString()}&panel=signals`,
    review_sequence: null,
  }
}

export function buildTopProspectOpportunityCards(
  recommendations: ProspectRecommendation[],
): TopProspectOpportunityCard[] {
  const byCompany = new Map<string, ProspectRecommendation[]>()

  for (const item of recommendations) {
    if (item.status === "dismissed") continue
    const list = byCompany.get(item.company_id) ?? []
    list.push(item)
    byCompany.set(item.company_id, list)
  }

  const cards: TopProspectOpportunityCard[] = []

  for (const [, companyRecs] of byCompany) {
    const sorted = [...companyRecs].sort((a, b) => {
      const byPriority = priorityRank(b.priority) - priorityRank(a.priority)
      if (byPriority !== 0) return byPriority
      return b.confidence - a.confidence
    })
    const primary = sorted[0]
    if (!primary?.audit_event_id) continue

    cards.push({
      qa_marker: PROSPECT_RECOMMENDATION_QA_MARKER,
      recommendation_id: primary.recommendation_id,
      audit_event_id: primary.audit_event_id,
      execution_run_id: primary.execution_run_id,
      company_id: primary.company_id,
      company_name: primary.company_name,
      lead_id: primary.lead_id,
      signals: primary.signals.slice(0, 4),
      primary_recommendation: PROSPECT_RECOMMENDATION_TYPE_LABELS[primary.recommendation_type],
      recommendation_type: primary.recommendation_type,
      priority: primary.priority,
      confidence: primary.confidence,
      estimated_revenue_impact: primary.estimated_revenue_impact.summary,
      estimated_revenue_impact_level: primary.estimated_revenue_impact.level,
      recommended_actions: primary.recommended_actions,
      status: primary.status,
      collapsed_count: sorted.length,
      cta: buildCta(primary.lead_id, primary.company_id),
      requires_human_approval: true,
      enrollment_enabled: false,
      outreach_enabled: false,
    })
  }

  return cards.sort((a, b) => {
    const byPriority = priorityRank(b.priority) - priorityRank(a.priority)
    if (byPriority !== 0) return byPriority
    return b.confidence - a.confidence
  })
}

export function prospectRecommendationToSignalFeedItem(
  card: TopProspectOpportunityCard,
): GrowthSignalFeedItem {
  const signalLabels = card.signals.slice(0, 3).join(" · ") || "Strong Fit"
  return {
    qa_marker: SIGNAL_FEED_QA_MARKER,
    id: `prospect-rec:${card.recommendation_id}`,
    audit_event_id: card.audit_event_id,
    lead_id: card.lead_id,
    company_name: card.company_name,
    signal_type: "top_prospect_opportunity",
    signal_label: "Top Prospect Opportunity",
    source_domain: "company",
    confidence: card.confidence,
    urgency: card.priority === "urgent" ? "urgent" : card.priority === "high" ? "high" : "normal",
    signal_score: card.confidence,
    occurred_at: new Date().toISOString(),
    recommended_action: card.primary_recommendation,
    expected_impact: card.estimated_revenue_impact,
    reasoning: `${card.company_name}: ${signalLabels}. Recommendation: ${card.primary_recommendation}.`,
    priority: card.priority,
    status: card.status === "new" ? "new" : card.status === "viewed" ? "viewed" : card.status === "acted_on" ? "acted_on" : "dismissed",
    dedupe_hash: `prospect-opportunity:${card.company_id}`,
    collapsed_count: card.collapsed_count,
    queue_hint: null,
    cta: {
      view_lead: card.cta.review_company,
      review_company: card.cta.review_company,
      open_timeline: card.cta.view_signals,
      review_sequence: card.cta.review_sequence,
    },
    requires_human_approval: true,
  }
}

export async function persistProspectRecommendations(
  admin: SupabaseClient,
  recommendations: ProspectRecommendation[],
): Promise<{ ok: boolean; persisted: number; error?: string }> {
  if (!(await isGrowthSignalFoundationSchemaReady(admin))) {
    return { ok: false, persisted: 0, error: "schema_not_ready" }
  }
  if (recommendations.length === 0) return { ok: true, persisted: 0 }

  const rows = recommendations.map((recommendation) => ({
    signal_id: null,
    organization_id: null,
    event_type: "scored" as const,
    event_payload: {
      qa_marker: PROSPECT_RECOMMENDATION_QA_MARKER,
      prospect_recommendation: true,
      execution_run_id: recommendation.execution_run_id,
      recommendation,
      recommendation_status: recommendation.status,
      recommendation_status_at: recommendation.created_at,
      enrollment_enabled: false,
      outreach_enabled: false,
      requires_human_approval: true,
    },
    occurred_at: recommendation.created_at,
  }))

  const { error } = await admin.schema("growth").from("signal_events").insert(rows)
  if (error) return { ok: false, persisted: 0, error: error.message }
  return { ok: true, persisted: rows.length }
}

export async function loadPersistedProspectRecommendations(
  admin: SupabaseClient,
  input?: {
    execution_run_id?: string | null
    limit?: number
  },
): Promise<ProspectRecommendation[]> {
  if (!(await isGrowthSignalFoundationSchemaReady(admin))) return []

  let query = admin
    .schema("growth")
    .from("signal_events")
    .select("id, event_payload, occurred_at")
    .eq("event_type", "scored")
    .contains("event_payload", {
      qa_marker: PROSPECT_RECOMMENDATION_QA_MARKER,
      prospect_recommendation: true,
    })
    .order("occurred_at", { ascending: false })
    .limit(input?.limit ?? 500)

  if (input?.execution_run_id) {
    query = query.contains("event_payload", { execution_run_id: input.execution_run_id })
  }

  const { data } = await query
  const items: ProspectRecommendation[] = []
  for (const row of (data as RawRecommendationRow[] | null) ?? []) {
    const rec = rowToRecommendation(row)
    if (rec) items.push(rec)
  }
  return items
}

export async function ensureProspectRecommendationsForExecutionRun(
  admin: SupabaseClient,
  execution_run_id: string,
  search_industry_hint?: string | null,
): Promise<{ ok: boolean; recommendations: ProspectRecommendation[]; generated: boolean; error?: string }> {
  const existing = await loadPersistedProspectRecommendations(admin, { execution_run_id, limit: 200 })
  if (existing.length > 0) {
    return { ok: true, recommendations: existing, generated: false }
  }

  const loaded = await loadProspectExecutionRunById(admin, execution_run_id)
  if (!loaded.run || !loaded.results) {
    return { ok: false, recommendations: [], generated: false, error: "execution_run_not_found" }
  }
  if (loaded.run.status !== "completed") {
    return { ok: false, recommendations: [], generated: false, error: "execution_run_not_completed" }
  }

  const recommendations = generateProspectRecommendations({
    execution_run_id,
    companies: loaded.results.companies,
    qualified_company_ids: loaded.run.qualified_company_ids,
    search_industry_hint,
  })

  const persisted = await persistProspectRecommendations(admin, recommendations)
  if (!persisted.ok) {
    return { ok: false, recommendations: [], generated: false, error: persisted.error }
  }

  const reloaded = await loadPersistedProspectRecommendations(admin, { execution_run_id, limit: 200 })
  return { ok: true, recommendations: reloaded, generated: true }
}

export async function loadGrowthProspectRecommendations(
  admin: SupabaseClient,
  input?: {
    execution_run_id?: string | null
    filter?: ProspectRecommendationFilter | null
    sort?: ProspectRecommendationSortField
    limit?: number
    ensure_for_run?: boolean
    search_industry_hint?: string | null
  },
): Promise<GrowthProspectRecommendationsResponse> {
  if (input?.ensure_for_run && input.execution_run_id) {
    await ensureProspectRecommendationsForExecutionRun(
      admin,
      input.execution_run_id,
      input.search_industry_hint,
    )
  }

  const raw = await loadPersistedProspectRecommendations(admin, {
    execution_run_id: input?.execution_run_id,
    limit: input?.limit ?? 500,
  })

  const filtered = filterRecommendations(raw, input?.filter ?? null)
  const sorted = sortRecommendations(filtered, input?.sort ?? "priority").slice(0, input?.limit ?? 100)
  const top_opportunities = buildTopProspectOpportunityCards(sorted).slice(0, 20)

  return {
    qa_marker: PROSPECT_RECOMMENDATION_QA_MARKER,
    generated_at: new Date().toISOString(),
    total: sorted.length,
    collapsed_from: raw.length - sorted.length,
    items: sorted,
    top_opportunities,
    enrollment_enabled: false,
    outreach_enabled: false,
    requires_human_approval: true,
  }
}

export async function loadTopProspectOpportunitiesForCommandCenter(
  admin: SupabaseClient,
  limit = 8,
): Promise<TopProspectOpportunityCard[]> {
  const response = await loadGrowthProspectRecommendations(admin, {
    sort: "priority",
    limit: Math.max(limit * 4, 32),
  })
  return response.top_opportunities.slice(0, limit)
}

export async function loadTopProspectOpportunityFeedItems(
  admin: SupabaseClient,
  limit = 6,
): Promise<GrowthSignalFeedItem[]> {
  const cards = await loadTopProspectOpportunitiesForCommandCenter(admin, limit)
  return cards.map(prospectRecommendationToSignalFeedItem)
}

export async function applyProspectRecommendationAction(
  admin: SupabaseClient,
  input: {
    audit_event_id: string
    action: ProspectRecommendationActionType
  },
): Promise<{ ok: boolean; status: ProspectRecommendationStatus | null; error?: string }> {
  if (!(await isGrowthSignalFoundationSchemaReady(admin))) {
    return { ok: false, status: null, error: "schema_not_ready" }
  }

  const { data, error } = await admin
    .schema("growth")
    .from("signal_events")
    .select("id, event_payload")
    .eq("id", input.audit_event_id)
    .maybeSingle()

  if (error || !data) {
    return { ok: false, status: null, error: error?.message ?? "not_found" }
  }

  const payload = (data.event_payload as Record<string, unknown>) ?? {}
  if (payload.qa_marker !== PROSPECT_RECOMMENDATION_QA_MARKER || payload.prospect_recommendation !== true) {
    return { ok: false, status: null, error: "not_found" }
  }

  const nextStatus: ProspectRecommendationStatus =
    input.action === "mark_viewed"
      ? "viewed"
      : input.action === "mark_acted_on"
        ? "acted_on"
        : "dismissed"

  const updatedPayload = {
    ...payload,
    recommendation_status: nextStatus,
    recommendation_status_at: new Date().toISOString(),
    recommendation_status_action: input.action,
    recommendation: {
      ...(payload.recommendation as Record<string, unknown>),
      status: nextStatus,
    },
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
