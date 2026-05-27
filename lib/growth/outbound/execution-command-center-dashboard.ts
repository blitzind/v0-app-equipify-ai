import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listDeliveryTimelineEvents } from "@/lib/growth/deliverability/delivery-event-timeline"
import { fetchDeliverabilityIntelligenceDashboard } from "@/lib/growth/deliverability/deliverability-intelligence-dashboard"
import { buildInfrastructureRecommendations, detectOperationalAnomalies } from "@/lib/growth/outbound/deliverability-trend-engine"
import { computeThroughputUtilization, persistThroughputSnapshots } from "@/lib/growth/outbound/throughput-allocator"
import {
  GROWTH_REPUTATION_SAFE_SCALING_QA_MARKER,
  type GrowthExecutionCommandCenterSummary,
  type GrowthInfrastructureRecommendation,
  type GrowthThroughputUtilizationRow,
} from "@/lib/growth/outbound/reputation-safe-scaling-types"
import { listSequenceExecutionDiagnostics } from "@/lib/growth/outbound/sequence-execution-hardening"

export type GrowthExecutionCommandCenterDashboard = {
  qa_marker: typeof GROWTH_REPUTATION_SAFE_SCALING_QA_MARKER
  summary: GrowthExecutionCommandCenterSummary
  throughput_utilization: GrowthThroughputUtilizationRow[]
  infrastructure_recommendations: GrowthInfrastructureRecommendation[]
  operational_timeline: Awaited<ReturnType<typeof listDeliveryTimelineEvents>>
  sequence_diagnostics: Awaited<ReturnType<typeof listSequenceExecutionDiagnostics>>
  deliverability_anomalies: Awaited<ReturnType<typeof detectOperationalAnomalies>>
  partial_telemetry_note: string
}

export async function fetchExecutionCommandCenterDashboard(
  admin: SupabaseClient,
): Promise<GrowthExecutionCommandCenterDashboard> {
  const [throughput, deliverabilityIntel, timeline, diagnostics, anomalies] = await Promise.all([
    computeThroughputUtilization(admin),
    fetchDeliverabilityIntelligenceDashboard(admin),
    listDeliveryTimelineEvents(admin, 50),
    listSequenceExecutionDiagnostics(admin, 20),
    detectOperationalAnomalies(admin),
  ])

  await persistThroughputSnapshots(admin, throughput).catch(() => undefined)

  const throughputCritical = throughput.filter((r) => r.saturationLevel === "critical").length
  const recommendations = buildInfrastructureRecommendations(anomalies, throughputCritical)

  const { data: engagementRows } = await admin
    .schema("growth")
    .from("campaign_engagement_metrics")
    .select("reply_quality_score")
    .order("updated_at", { ascending: false })
    .limit(50)

  const avgReplyQuality =
    engagementRows && engagementRows.length > 0
      ? Math.round(
          engagementRows.reduce((sum, row) => sum + Number((row as Record<string, unknown>).reply_quality_score ?? 0), 0) /
            engagementRows.length,
        )
      : 0

  const { count: deferredCount } = await admin
    .schema("growth")
    .from("outbound_scheduler_decisions")
    .select("id", { count: "exact", head: true })
    .eq("decision", "defer")
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  const { count: activeEnrollments } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")

  let infrastructureRiskLevel: GrowthExecutionCommandCenterSummary["infrastructureRiskLevel"] = "low"
  if (deliverabilityIntel.intelligence_summary.unhealthyDomainCount >= 2 || throughputCritical >= 3) {
    infrastructureRiskLevel = "critical"
  } else if (
    deliverabilityIntel.intelligence_summary.degradedMailboxCount >= 2 ||
    throughputCritical >= 1 ||
    anomalies.length >= 2
  ) {
    infrastructureRiskLevel = "high"
  } else if (anomalies.length > 0 || deliverabilityIntel.intelligence_summary.dnsFailureCount > 0) {
    infrastructureRiskLevel = "medium"
  }

  return {
    qa_marker: GROWTH_REPUTATION_SAFE_SCALING_QA_MARKER,
    summary: {
      activeCampaignLoad: activeEnrollments ?? 0,
      deferredSends24h: deferredCount ?? 0,
      throttledPools: throughput.filter((r) => r.entityType === "pool" && r.saturationLevel === "elevated").length,
      overloadedSenders: throughput.filter((r) => r.entityType === "mailbox" && r.saturationLevel === "critical").length,
      pausedDomains: deliverabilityIntel.intelligence_summary.unhealthyDomainCount,
      degradedCampaigns: engagementRows?.filter((r) => Number((r as Record<string, unknown>).reply_quality_score ?? 100) < 50).length ?? 0,
      avgReplyQuality,
      infrastructureRiskLevel,
    },
    throughput_utilization: throughput,
    infrastructure_recommendations: recommendations,
    operational_timeline: timeline,
    sequence_diagnostics: diagnostics,
    deliverability_anomalies: anomalies,
    partial_telemetry_note:
      "Partial visibility — no inbox placement, Postmaster, or blacklist data unless separately integrated. Reply quality from deterministic classification only.",
  }
}
