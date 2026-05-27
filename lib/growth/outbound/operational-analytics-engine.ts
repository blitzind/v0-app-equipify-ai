import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthInfrastructureSustainabilityMetrics } from "@/lib/growth/outbound/lifecycle-ops-types"
import { listInboxLifecycleRows } from "@/lib/growth/outbound/inbox-lifecycle-engine"
import { listSenderDomains } from "@/lib/growth/sender/sender-repository"

export async function computeSustainabilityMetrics(
  admin: SupabaseClient,
): Promise<GrowthInfrastructureSustainabilityMetrics> {
  const lifecycleRows = await listInboxLifecycleRows(admin)
  const domains = await listSenderDomains(admin)

  const inboxAges = lifecycleRows.map((r) => r.inboxAgeDays).filter((d): d is number => d != null)
  const avgInboxAgeDays =
    inboxAges.length > 0 ? Math.round(inboxAges.reduce((sum, d) => sum + d, 0) / inboxAges.length) : 0

  const agingSenderCount = lifecycleRows.filter((r) => (r.inboxAgeDays ?? 0) >= 90).length
  const coolingDomainCount = domains.filter((d) => d.domain_segment === "warming" || d.operational_status === "warming").length
  const retirementCandidateCount = lifecycleRows.filter((r) => r.retirementCandidate).length
  const inactiveInfrastructureCount = lifecycleRows.filter(
    (r) => (r.inactivityDays ?? 0) >= 21 || r.lifecycleStage === "cooling_down",
  ).length

  const since30d = new Date(Date.now() - 30 * 86400000).toISOString()
  const { count: interventions } = await admin
    .schema("growth")
    .from("deliverability_protection_events")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since30d)

  const elevatedRisk = lifecycleRows.filter((r) => r.lifecycleStage === "elevated_risk").length
  const paused = lifecycleRows.filter((r) => r.lifecycleStage === "paused").length
  const riskAccumulationScore = Math.min(100, elevatedRisk * 15 + paused * 10 + retirementCandidateCount * 8)

  return {
    avgInboxAgeDays,
    agingSenderCount,
    coolingDomainCount,
    retirementCandidateCount,
    inactiveInfrastructureCount,
    operationalInterventions30d: interventions ?? 0,
    riskAccumulationScore,
  }
}

export async function persistOperationalAnalyticsSnapshots(
  admin: SupabaseClient,
  metrics: GrowthInfrastructureSustainabilityMetrics,
): Promise<void> {
  const snapshotDate = new Date().toISOString().slice(0, 10)
  const entries: Array<[string, number]> = [
    ["avg_inbox_age_days", metrics.avgInboxAgeDays],
    ["aging_sender_count", metrics.agingSenderCount],
    ["cooling_domain_count", metrics.coolingDomainCount],
    ["retirement_candidate_count", metrics.retirementCandidateCount],
    ["inactive_infrastructure_count", metrics.inactiveInfrastructureCount],
    ["operational_interventions_30d", metrics.operationalInterventions30d],
    ["risk_accumulation_score", metrics.riskAccumulationScore],
  ]

  for (const [key, value] of entries) {
    await admin.schema("growth").from("operational_analytics_snapshots").upsert(
      { snapshot_date: snapshotDate, metric_key: key, metric_value: value },
      { onConflict: "snapshot_date,metric_key" },
    )
  }
}

export async function fetchOperationalTrendHistory(
  admin: SupabaseClient,
  metricKey: string,
  limit = 14,
): Promise<Array<{ date: string; value: number }>> {
  const { data, error } = await admin
    .schema("growth")
    .from("operational_analytics_snapshots")
    .select("snapshot_date, metric_value")
    .eq("metric_key", metricKey)
    .order("snapshot_date", { ascending: false })
    .limit(limit)

  if (error) return []

  return ((data ?? []) as Array<{ snapshot_date: string; metric_value: number }>).map((row) => ({
    date: row.snapshot_date,
    value: Number(row.metric_value),
  }))
}
