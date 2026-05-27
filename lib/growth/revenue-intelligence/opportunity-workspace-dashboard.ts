import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_REVENUE_INTELLIGENCE_QA_MARKER,
  type GrowthBuyingMomentumTrend,
  type GrowthOpportunityWorkspaceDashboard,
  type GrowthOpportunityWorkspaceItem,
  type GrowthOpportunityWorkspaceView,
} from "@/lib/growth/revenue-intelligence/revenue-intelligence-phase6-types"

function maskLabel(leadId: string, companyName: string | null): string {
  if (companyName?.trim()) return companyName.trim()
  return `Account ${leadId.slice(0, 8)}`
}

function matchesView(item: GrowthOpportunityWorkspaceItem, view?: GrowthOpportunityWorkspaceView): boolean {
  if (!view || view === "active_opportunities") return item.signalCount > 0 || item.momentumScore >= 40
  if (view === "hottest_accounts") return item.momentumScore >= 65 && item.momentumTrend === "accelerating"
  if (view === "stalled_conversations") return item.momentumTrend === "stalled" || item.momentumTrend === "cooling"
  if (view === "unresolved_objections") return item.unresolvedObjectionCount > 0
  if (view === "demo_ready") return item.demoReady
  if (view === "pricing_stage") return item.pricingStage
  if (view === "high_risk") return item.highRisk
  if (view === "multi_thread") return item.multiThread
  if (view === "buying_committee") return item.committeeCompleteness >= 40
  return true
}

export async function fetchOpportunityWorkspaceDashboard(
  admin: SupabaseClient,
  input?: { view?: GrowthOpportunityWorkspaceView; limit?: number },
): Promise<GrowthOpportunityWorkspaceDashboard> {
  const limit = input?.limit ?? 50
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [momentumRes, signalsRes, objectionsRes, committeeRes, opportunitiesRes] = await Promise.all([
    admin
      .schema("growth")
      .from("buying_momentum_snapshots")
      .select("lead_id, momentum_score, momentum_trend, stakeholder_count, snapshot_date, updated_at")
      .gte("snapshot_date", since)
      .order("momentum_score", { ascending: false })
      .limit(200),
    admin.schema("growth").from("opportunity_signals").select("lead_id, signal_type").gte("detected_at", `${since}T00:00:00.000Z`),
    admin
      .schema("growth")
      .from("outbound_replies")
      .select("lead_id, intent")
      .in("intent", ["objection", "timing_delay", "angry_complaint", "competitor_mention"])
      .gte("received_at", `${since}T00:00:00.000Z`),
    admin
      .schema("growth")
      .from("buying_committee_maps")
      .select("lead_id, completeness_score, stakeholder_count")
      .gte("snapshot_date", since),
    admin.schema("growth").from("opportunities").select("lead_id, stage").neq("stage", "closed_lost"),
  ])

  if (momentumRes.error) throw new Error(momentumRes.error.message)

  const leadIds = [...new Set((momentumRes.data ?? []).map((r) => String((r as { lead_id: string }).lead_id)))]
  const companyNames = new Map<string, string>()
  if (leadIds.length > 0) {
    const { data: leads } = await admin.schema("growth").from("leads").select("id, company_name").in("id", leadIds)
    for (const lead of leads ?? []) {
      companyNames.set(String((lead as { id: string }).id), maskLabel(String((lead as { id: string }).id), (lead as { company_name?: string }).company_name ?? null))
    }
  }

  const signalCounts = new Map<string, number>()
  for (const row of signalsRes.data ?? []) {
    const leadId = String((row as { lead_id: string }).lead_id)
    signalCounts.set(leadId, (signalCounts.get(leadId) ?? 0) + 1)
  }

  const objectionCounts = new Map<string, number>()
  for (const row of objectionsRes.data ?? []) {
    const leadId = String((row as { lead_id: string }).lead_id)
    objectionCounts.set(leadId, (objectionCounts.get(leadId) ?? 0) + 1)
  }

  const committeeByLead = new Map<string, { completeness: number; stakeholders: number }>()
  for (const row of committeeRes.data ?? []) {
    const leadId = String((row as { lead_id: string }).lead_id)
    committeeByLead.set(leadId, {
      completeness: Number((row as { completeness_score?: number }).completeness_score ?? 0),
      stakeholders: Number((row as { stakeholder_count?: number }).stakeholder_count ?? 0),
    })
  }

  const activeOpportunityLeads = new Set((opportunitiesRes.data ?? []).map((r) => String((r as { lead_id?: string }).lead_id)).filter(Boolean))

  const signalTypesByLead = new Map<string, Set<string>>()
  for (const row of signalsRes.data ?? []) {
    const leadId = String((row as { lead_id: string }).lead_id)
    const types = signalTypesByLead.get(leadId) ?? new Set<string>()
    types.add(String((row as { signal_type: string }).signal_type))
    signalTypesByLead.set(leadId, types)
  }

  const items: GrowthOpportunityWorkspaceItem[] = (momentumRes.data ?? []).map((row) => {
    const record = row as Record<string, unknown>
    const leadId = String(record.lead_id)
    const types = signalTypesByLead.get(leadId) ?? new Set<string>()
    const committee = committeeByLead.get(leadId)
    const momentumTrend = String(record.momentum_trend) as GrowthBuyingMomentumTrend
    const momentumScore = Number(record.momentum_score ?? 0)
    const unresolvedObjectionCount = objectionCounts.get(leadId) ?? 0

    return {
      leadId,
      companyLabel: companyNames.get(leadId) ?? maskLabel(leadId, null),
      momentumScore,
      momentumTrend,
      signalCount: signalCounts.get(leadId) ?? 0,
      unresolvedObjectionCount,
      demoReady: types.has("demo_request") || types.has("meeting_interest"),
      pricingStage: types.has("pricing_interest") || types.has("budget_signal"),
      highRisk: momentumTrend === "stalled" || unresolvedObjectionCount >= 2,
      multiThread: (committee?.stakeholders ?? Number(record.stakeholder_count ?? 0)) > 1,
      committeeCompleteness: committee?.completeness ?? 0,
      lastActivityAt: (record.updated_at as string | null) ?? null,
      recommendedAction: momentumScore >= 65 ? "Review for demo/pricing follow-up — human executes." : "Monitor momentum — operator review if stalled.",
    }
  })

  const filtered = items.filter((item) => matchesView(item, input?.view)).slice(0, limit)

  return {
    qaMarker: GROWTH_REVENUE_INTELLIGENCE_QA_MARKER,
    activeOpportunityCount: items.filter((i) => activeOpportunityLeads.has(i.leadId) || i.signalCount > 0).length,
    hottestAccountCount: items.filter((i) => i.momentumScore >= 65 && i.momentumTrend === "accelerating").length,
    stalledConversationCount: items.filter((i) => i.momentumTrend === "stalled" || i.momentumTrend === "cooling").length,
    unresolvedObjectionCount: items.filter((i) => i.unresolvedObjectionCount > 0).length,
    demoReadyCount: items.filter((i) => i.demoReady).length,
    pricingStageCount: items.filter((i) => i.pricingStage).length,
    highRiskCount: items.filter((i) => i.highRisk).length,
    multiThreadCount: items.filter((i) => i.multiThread).length,
    buyingCommitteeCount: items.filter((i) => i.committeeCompleteness >= 40).length,
    items: filtered,
  }
}
