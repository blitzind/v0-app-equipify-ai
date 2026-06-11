import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-influence-context"
import { readGrowthLeadRevenueReadinessSnapshot } from "@/lib/growth/revenue-workflow/recompute-revenue-readiness"
import {
  GROWTH_REVENUE_EXECUTION_QA_MARKER,
  GROWTH_REVENUE_COMMAND_CENTER_VIEWS,
  type GrowthRevenueCommandCenterDashboard,
  type GrowthRevenueCommandCenterLead,
  type GrowthRevenueCommandCenterView,
} from "@/lib/growth/revenue-execution/revenue-execution-types"

type Row = Record<string, unknown>

const MAX_CANDIDATE_LEADS = 250
const ACTIVE_LEAD_STATUS_FILTER = '("converted","disqualified","archived")'

function maskLabel(leadId: string, companyName: string | null): string {
  if (companyName?.trim()) return companyName.trim()
  return `Account ${leadId.slice(0, 8)}`
}

function isRevenueReady(readinessScore: number, readinessTier: string): boolean {
  return readinessScore >= 65 || readinessTier === "sales_ready" || readinessTier === "revenue_ready"
}

function isSnoozedRecommendation(meta: Record<string, unknown> | undefined): boolean {
  return (
    meta?.reviewState === "snoozed" &&
    typeof meta.snoozedUntil === "string" &&
    new Date(meta.snoozedUntil).getTime() > Date.now()
  )
}

function classifyLead(
  view: GrowthRevenueCommandCenterView,
  input: {
    readinessScore: number
    readinessTier: string
    oppScore: number | null
    oppConfidence: number | null
    workflowHealth: string | null
    objectionCount: number
    engagementTrend: string | null
    hasCompetitive: boolean
    recId: string | null
  },
): GrowthRevenueCommandCenterLead | null {
  const base = {
    revenueReadinessScore: input.readinessScore,
    revenueReadinessTier: input.readinessTier,
    opportunityScore: input.oppScore,
    opportunityConfidence: input.oppConfidence,
    pendingRecommendationId: input.recId,
  }

  if (view === "revenue_ready" && isRevenueReady(input.readinessScore, input.readinessTier)) {
    return {
      ...base,
      view,
      leadId: "",
      companyName: "",
      callPriorityScore: null,
      nextBestAction: null,
      primaryReason: `Revenue readiness ${input.readinessScore}`,
    }
  }
  if (view === "high_confidence_opportunities" && (input.oppConfidence ?? 0) >= 50) {
    return { ...base, view, leadId: "", companyName: "", callPriorityScore: null, nextBestAction: null, primaryReason: `Opportunity confidence ${input.oppConfidence}` }
  }
  if (view === "stalled_opportunities" && (input.workflowHealth === "stalled" || input.workflowHealth === "blocked")) {
    return { ...base, view, leadId: "", companyName: "", callPriorityScore: null, nextBestAction: null, primaryReason: `Workflow ${input.workflowHealth}` }
  }
  if (view === "objection_heavy" && input.objectionCount > 0) {
    return { ...base, view, leadId: "", companyName: "", callPriorityScore: null, nextBestAction: null, primaryReason: `${input.objectionCount} unresolved objection(s)` }
  }
  if (view === "re_engagement" && (input.engagementTrend === "cooling" || input.engagementTrend === "declining")) {
    return { ...base, view, leadId: "", companyName: "", callPriorityScore: null, nextBestAction: null, primaryReason: `Engagement ${input.engagementTrend}` }
  }
  if (view === "competitive_risk" && input.hasCompetitive) {
    return { ...base, view, leadId: "", companyName: "", callPriorityScore: null, nextBestAction: null, primaryReason: "Competitive signal detected" }
  }
  return null
}

async function collectCommandCenterCandidateLeadIds(
  admin: SupabaseClient,
  input: {
    recRows: Row[]
    competitiveRows: Row[]
  },
): Promise<string[]> {
  const ids = new Set<string>()

  for (const row of input.recRows) {
    const meta = row.metadata as Record<string, unknown> | undefined
    if (!isSnoozedRecommendation(meta)) ids.add(String(row.lead_id))
  }

  for (const row of input.competitiveRows) {
    ids.add(String(row.lead_id))
  }

  const [stalledRes, priorityRes, recentRes] = await Promise.all([
    admin
      .schema("growth")
      .from("leads")
      .select("id")
      .not("status", "in", ACTIVE_LEAD_STATUS_FILTER)
      .in("workflow_health", ["stalled", "blocked"])
      .limit(150),
    admin
      .schema("growth")
      .from("leads")
      .select("id")
      .not("status", "in", ACTIVE_LEAD_STATUS_FILTER)
      .order("call_priority_score", { ascending: false, nullsFirst: false })
      .limit(100),
    admin
      .schema("growth")
      .from("leads")
      .select("id, metadata")
      .not("status", "in", ACTIVE_LEAD_STATUS_FILTER)
      .order("updated_at", { ascending: false })
      .limit(200),
  ])

  for (const row of stalledRes.data ?? []) ids.add(String((row as Row).id))
  for (const row of priorityRes.data ?? []) ids.add(String((row as Row).id))

  for (const row of recentRes.data ?? []) {
    const leadId = String((row as Row).id)
    const readiness = readGrowthLeadRevenueReadinessSnapshot((row as Row).metadata as Record<string, unknown>)
    if (readiness && isRevenueReady(readiness.score, readiness.tier)) ids.add(leadId)
  }

  return [...ids].slice(0, MAX_CANDIDATE_LEADS)
}

export async function fetchRevenueCommandCenterDashboard(
  admin: SupabaseClient,
  input?: { limit?: number },
): Promise<GrowthRevenueCommandCenterDashboard> {
  const limit = input?.limit ?? 30
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [recRes, signalsRes] = await Promise.all([
    admin
      .schema("growth")
      .from("opportunity_recommendations")
      .select("id, lead_id, metadata, status")
      .eq("status", "pending"),
    admin
      .schema("growth")
      .from("opportunity_signals")
      .select("lead_id, signal_type")
      .eq("signal_type", "competitive_signal")
      .gte("detected_at", since),
  ])

  const candidateLeadIds = await collectCommandCenterCandidateLeadIds(admin, {
    recRows: (recRes.data ?? []) as Row[],
    competitiveRows: (signalsRes.data ?? []) as Row[],
  })

  let leadsRes =
    candidateLeadIds.length > 0
      ? await admin
          .schema("growth")
          .from("leads")
          .select("id, company_name, metadata, call_priority_score, next_best_action, workflow_health")
          .in("id", candidateLeadIds)
      : await admin
          .schema("growth")
          .from("leads")
          .select("id, company_name, metadata, call_priority_score, next_best_action, workflow_health")
          .not("status", "in", ACTIVE_LEAD_STATUS_FILTER)
          .order("call_priority_score", { ascending: false, nullsFirst: false })
          .limit(100)

  if (leadsRes.error) throw new Error(leadsRes.error.message)

  const leadRows = [...((leadsRes.data ?? []) as Row[])].sort(
    (a, b) => Number(b.call_priority_score ?? 0) - Number(a.call_priority_score ?? 0),
  )

  const recByLead = new Map<string, { id: string; score: number | null; confidence: number | null }>()
  for (const row of recRes.data ?? []) {
    const leadId = String((row as Row).lead_id)
    const meta = (row as Row).metadata as Record<string, unknown> | undefined
    if (isSnoozedRecommendation(meta)) continue
    recByLead.set(leadId, {
      id: String((row as Row).id),
      score: typeof meta?.opportunityScore === "number" ? meta.opportunityScore : null,
      confidence: typeof meta?.confidence === "number" ? meta.confidence : null,
    })
  }

  const competitiveLeads = new Set(
    (signalsRes.data ?? []).map((row) => String((row as Row).lead_id)),
  )

  const sections = Object.fromEntries(
    GROWTH_REVENUE_COMMAND_CENTER_VIEWS.map((view) => [view, [] as GrowthRevenueCommandCenterLead[]]),
  ) as GrowthRevenueCommandCenterDashboard["sections"]

  for (const row of leadRows) {
    const leadId = String(row.id)
    const memory = await buildLeadMemoryInfluenceContext(admin, leadId).catch(() => null)
    const readiness = readGrowthLeadRevenueReadinessSnapshot(row.metadata as Record<string, unknown>)
    const rec = recByLead.get(leadId)

    const ctx = {
      readinessScore: readiness?.score ?? 0,
      readinessTier: readiness?.tier ?? "cold",
      oppScore: rec?.score ?? null,
      oppConfidence: rec?.confidence ?? null,
      workflowHealth: row.workflow_health ? String(row.workflow_health) : null,
      objectionCount: memory?.unresolvedObjectionCount ?? 0,
      engagementTrend: memory?.engagementTrend ?? null,
      hasCompetitive: competitiveLeads.has(leadId),
      recId: rec?.id ?? null,
    }

    for (const view of GROWTH_REVENUE_COMMAND_CENTER_VIEWS) {
      const match = classifyLead(view, ctx)
      if (!match) continue
      const bucket = sections[view]
      if (bucket.length >= limit) continue
      bucket.push({
        ...match,
        leadId,
        companyName: maskLabel(leadId, row.company_name as string | null),
        callPriorityScore: row.call_priority_score != null ? Number(row.call_priority_score) : null,
        nextBestAction: row.next_best_action ? String(row.next_best_action) : null,
      })
    }
  }

  for (const view of GROWTH_REVENUE_COMMAND_CENTER_VIEWS) {
    sections[view].sort((a, b) => b.revenueReadinessScore - a.revenueReadinessScore)
  }

  const totalActionable = GROWTH_REVENUE_COMMAND_CENTER_VIEWS.reduce((sum, view) => sum + sections[view].length, 0)

  return {
    qaMarker: GROWTH_REVENUE_EXECUTION_QA_MARKER,
    generatedAt: new Date().toISOString(),
    view: "all",
    sections,
    totalActionable,
  }
}
