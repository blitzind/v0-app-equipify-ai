import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_OUTBOUND_LIFECYCLE_OPS_QA_MARKER,
  type GrowthInfrastructureFitAssessment,
  type GrowthInfrastructureInventorySummary,
  type GrowthInfrastructureSustainabilityMetrics,
  type GrowthInboxLifecycleRow,
  type GrowthMaintenanceTaskRow,
  type GrowthOperationalAlertRow,
} from "@/lib/growth/outbound/lifecycle-ops-types"
import { listInboxLifecycleRows, listLifecycleTimeline } from "@/lib/growth/outbound/inbox-lifecycle-engine"
import { listOpenMaintenanceTasks } from "@/lib/growth/outbound/sender-maintenance-engine"
import { computeDomainRotationRecommendations } from "@/lib/growth/outbound/domain-rotation-intelligence"
import {
  fetchInfrastructureInventoryRows,
  fetchInfrastructureInventorySummary,
} from "@/lib/growth/outbound/infrastructure-inventory-dashboard"
import { listOperationalAlerts } from "@/lib/growth/outbound/operational-alerting"
import {
  computeSustainabilityMetrics,
  fetchOperationalTrendHistory,
} from "@/lib/growth/outbound/operational-analytics-engine"

export type GrowthLifecycleOpsDashboard = {
  qa_marker: typeof GROWTH_OUTBOUND_LIFECYCLE_OPS_QA_MARKER
  lifecycle_rows: GrowthInboxLifecycleRow[]
  lifecycle_timeline: Awaited<ReturnType<typeof listLifecycleTimeline>>
  maintenance_tasks: GrowthMaintenanceTaskRow[]
  operational_alerts: GrowthOperationalAlertRow[]
  inventory_summary: GrowthInfrastructureInventorySummary
  inventory_rows: Awaited<ReturnType<typeof fetchInfrastructureInventoryRows>>
  domain_rotation_recommendations: Awaited<ReturnType<typeof computeDomainRotationRecommendations>>
  sustainability_metrics: GrowthInfrastructureSustainabilityMetrics
  trend_history: {
    risk_accumulation: Array<{ date: string; value: number }>
    inactive_infrastructure: Array<{ date: string; value: number }>
  }
  partial_telemetry_note: string
}

export async function fetchLifecycleOpsDashboard(admin: SupabaseClient): Promise<GrowthLifecycleOpsDashboard> {
  const [
    lifecycleRows,
    lifecycleTimeline,
    maintenanceTasks,
    operationalAlerts,
    inventorySummary,
    inventoryRows,
    domainRotation,
    sustainabilityMetrics,
    riskTrend,
    inactiveTrend,
  ] = await Promise.all([
    listInboxLifecycleRows(admin),
    listLifecycleTimeline(admin, 25),
    listOpenMaintenanceTasks(admin, 40),
    listOperationalAlerts(admin, 25),
    fetchInfrastructureInventorySummary(admin),
    fetchInfrastructureInventoryRows(admin),
    computeDomainRotationRecommendations(admin),
    computeSustainabilityMetrics(admin),
    fetchOperationalTrendHistory(admin, "risk_accumulation_score", 14),
    fetchOperationalTrendHistory(admin, "inactive_infrastructure_count", 14),
  ])

  return {
    qa_marker: GROWTH_OUTBOUND_LIFECYCLE_OPS_QA_MARKER,
    lifecycle_rows: lifecycleRows,
    lifecycle_timeline: lifecycleTimeline,
    maintenance_tasks: maintenanceTasks,
    operational_alerts: operationalAlerts,
    inventory_summary: inventorySummary,
    inventory_rows: inventoryRows,
    domain_rotation_recommendations: domainRotation,
    sustainability_metrics: sustainabilityMetrics,
    trend_history: {
      risk_accumulation: riskTrend,
      inactive_infrastructure: inactiveTrend,
    },
    partial_telemetry_note:
      "Lifecycle ops use real send/complaint/OAuth telemetry only — no automated warming networks, inbox placement, or AI reputation forecasting.",
  }
}

export type { GrowthInfrastructureFitAssessment }
