import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { persistComputedLifecycleStages } from "@/lib/growth/outbound/inbox-lifecycle-engine"
import { runSenderMaintenanceScan } from "@/lib/growth/outbound/sender-maintenance-engine"
import { runOperationalAlertScan } from "@/lib/growth/outbound/operational-alerting"
import { computeDomainRotationRecommendations } from "@/lib/growth/outbound/domain-rotation-intelligence"
import {
  computeSustainabilityMetrics,
  persistOperationalAnalyticsSnapshots,
} from "@/lib/growth/outbound/operational-analytics-engine"

export type LifecycleOpsRunSummary = {
  lifecycleStagesUpdated: number
  maintenanceTasksCreated: number
  alertsCreated: number
  domainRotationRecommendations: number
}

export async function runLifecycleOpsMaintenanceScan(admin: SupabaseClient): Promise<LifecycleOpsRunSummary> {
  const lifecycleStagesUpdated = await persistComputedLifecycleStages(admin)
  const maintenance = await runSenderMaintenanceScan(admin)
  const alerts = await runOperationalAlertScan(admin)
  const rotation = await computeDomainRotationRecommendations(admin)
  const sustainability = await computeSustainabilityMetrics(admin)
  await persistOperationalAnalyticsSnapshots(admin, sustainability)

  return {
    lifecycleStagesUpdated,
    maintenanceTasksCreated: maintenance.tasksCreated,
    alertsCreated: alerts.alertsCreated,
    domainRotationRecommendations: rotation.length,
  }
}
