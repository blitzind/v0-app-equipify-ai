import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-influence-context"
import {
  readGrowthLeadRevenueReadinessSnapshot,
} from "@/lib/growth/revenue-workflow/recompute-revenue-readiness"
import {
  GROWTH_REVENUE_WORKFLOW_QA_MARKER,
  type GrowthRevenueWorkflowWorkspaceDashboard,
  type GrowthRevenueWorkflowWorkspaceLead,
} from "@/lib/growth/revenue-workflow/revenue-workflow-types"

type Row = Record<string, unknown>

function maskLabel(leadId: string, companyName: string | null): string {
  if (companyName?.trim()) return companyName.trim()
  return `Account ${leadId.slice(0, 8)}`
}

function readRecommendationScore(metadata: Record<string, unknown> | undefined): number | null {
  const score = metadata?.opportunityScore
  return typeof score === "number" ? score : null
}

export async function fetchRevenueWorkflowWorkspaceDashboard(
  admin: SupabaseClient,
  input?: { limit?: number; leadId?: string },
): Promise<GrowthRevenueWorkflowWorkspaceDashboard> {
  const limit = input?.limit ?? 50

  let leadQuery = admin
    .schema("growth")
    .from("leads")
    .select(
      "id, company_name, call_priority_score, call_priority_tier, next_best_action, metadata, status, revenue_probability_score",
    )
    .not("status", "in", '("converted","disqualified","archived")')
    .order("call_priority_score", { ascending: false, nullsFirst: false })
    .limit(limit)

  if (input?.leadId) {
    leadQuery = admin
      .schema("growth")
      .from("leads")
      .select(
        "id, company_name, call_priority_score, call_priority_tier, next_best_action, metadata, status, revenue_probability_score",
      )
      .eq("id", input.leadId)
      .limit(1)
  }

  const [leadsRes, recRes, workflowRes, signalsRes] = await Promise.all([
    leadQuery,
    admin
      .schema("growth")
      .from("opportunity_recommendations")
      .select("lead_id, status, metadata, recommendation_type")
      .eq("status", "pending")
      .limit(200),
    admin
      .schema("growth")
      .from("reply_workflow_actions")
      .select("id, status")
      .eq("status", "pending")
      .limit(200)
      .catch(() => ({ data: [], error: null })),
    admin
      .schema("growth")
      .from("opportunity_signals")
      .select("lead_id, signal_type, evidence_snippet")
      .gte("detected_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .limit(500),
  ])

  if (leadsRes.error) throw new Error(leadsRes.error.message)

  const recByLead = new Map<string, number>()
  for (const row of recRes.data ?? []) {
    const leadId = String((row as Row).lead_id)
    const score = readRecommendationScore((row as Row).metadata as Record<string, unknown> | undefined) ?? 0
    recByLead.set(leadId, Math.max(recByLead.get(leadId) ?? 0, score))
  }

  const signalsByLead = new Map<string, string[]>()
  for (const row of signalsRes.data ?? []) {
    const leadId = String((row as Row).lead_id)
    const list = signalsByLead.get(leadId) ?? []
    list.push(String((row as Row).evidence_snippet ?? (row as Row).signal_type))
    signalsByLead.set(leadId, list)
  }

  const workspaceLeads: GrowthRevenueWorkflowWorkspaceLead[] = []
  let readinessTotal = 0

  for (const row of leadsRes.data ?? []) {
    const leadId = String((row as Row).id)
    const companyName = maskLabel(leadId, (row as Row).company_name as string | null)
    const metadata = (row as Row).metadata as Record<string, unknown> | undefined
    const snapshot = readGrowthLeadRevenueReadinessSnapshot(metadata)
    const memory = await buildLeadMemoryInfluenceContext(admin, leadId).catch(() => null)
    readinessTotal += snapshot?.score ?? 0

    workspaceLeads.push({
      leadId,
      companyName,
      revenueReadinessScore: snapshot?.score ?? 0,
      revenueReadinessTier: snapshot?.tier ?? "cold",
      callPriorityScore: (row as Row).call_priority_score != null ? Number((row as Row).call_priority_score) : null,
      callPriorityTier: (row as Row).call_priority_tier ? String((row as Row).call_priority_tier) : null,
      opportunityRecommendationScore: recByLead.get(leadId) ?? null,
      topBuyingSignals: (signalsByLead.get(leadId) ?? []).slice(0, 3),
      openObjections: memory?.topObjections?.slice(0, 3) ?? [],
      commitments: memory?.commitmentSummaries?.slice(0, 3) ?? [],
      riskFactors: [...(memory?.riskFlags ?? []), ...(snapshot?.topRisks.map((r) => r.label) ?? [])].slice(0, 4),
      recommendedNextAction: snapshot?.summary ?? null,
      nextBestAction: (row as Row).next_best_action ? String((row as Row).next_best_action) : null,
    })
  }

  workspaceLeads.sort(
    (a, b) =>
      b.revenueReadinessScore - a.revenueReadinessScore ||
      (b.opportunityRecommendationScore ?? 0) - (a.opportunityRecommendationScore ?? 0),
  )

  return {
    qaMarker: GROWTH_REVENUE_WORKFLOW_QA_MARKER,
    generatedAt: new Date().toISOString(),
    leads: workspaceLeads,
    pendingOpportunityRecommendations: recRes.data?.length ?? 0,
    pendingWorkflowActions: workflowRes.data?.length ?? 0,
    averageRevenueReadiness: workspaceLeads.length ? Math.round(readinessTotal / workspaceLeads.length) : 0,
  }
}
