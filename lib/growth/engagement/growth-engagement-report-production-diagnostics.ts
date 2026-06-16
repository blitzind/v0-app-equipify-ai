import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { probeGrowthEngagementDashboardSourceAvailability } from "@/lib/growth/engagement/growth-engagement-dashboard-repository"
import {
  GROWTH_ENGAGEMENT_REPORT_QA_MARKER,
  GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS,
} from "@/lib/growth/engagement/growth-engagement-report-types"

export type GrowthEngagementReportProductionDiagnosticsResult = {
  qa_marker: typeof GROWTH_ENGAGEMENT_REPORT_QA_MARKER
  ok: boolean
  read_only: true
  no_db_mutations: true
  no_file_writes: true
  sourceAvailability: Awaited<ReturnType<typeof probeGrowthEngagementDashboardSourceAvailability>>
  routeModules: Array<{ path: string; ok: boolean }>
  uiModules: Array<{ path: string; ok: boolean }>
  safetyFlags: typeof GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS
}

const REPORT_ROUTE_MODULES = [
  "app/api/platform/growth/engagement-dashboard/reports/route.ts",
  "app/api/platform/growth/engagement-dashboard/reports/[reportType]/route.ts",
  "app/api/platform/growth/engagement-dashboard/reports/[reportType]/csv/route.ts",
] as const

const REPORT_UI_MODULES = [
  "components/growth/engagement/growth-engagement-reports-panel.tsx",
  "components/growth/engagement/growth-engagement-report-card.tsx",
  "components/growth/engagement/growth-engagement-report-table.tsx",
  "components/growth/engagement/growth-engagement-export-button.tsx",
] as const

export async function runGrowthEngagementReportProductionDiagnostics(
  admin: SupabaseClient,
  probeModules: (paths: readonly string[]) => Array<{ path: string; ok: boolean }>,
): Promise<GrowthEngagementReportProductionDiagnosticsResult> {
  const sourceAvailability = await probeGrowthEngagementDashboardSourceAvailability(admin)
  const routeModules = probeModules(REPORT_ROUTE_MODULES)
  const uiModules = probeModules(REPORT_UI_MODULES)

  const ok =
    routeModules.every((entry) => entry.ok) &&
    uiModules.every((entry) => entry.ok) &&
    GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS.no_file_writes === true

  return {
    qa_marker: GROWTH_ENGAGEMENT_REPORT_QA_MARKER,
    ok,
    read_only: true,
    no_db_mutations: true,
    no_file_writes: true,
    sourceAvailability,
    routeModules,
    uiModules,
    safetyFlags: GROWTH_ENGAGEMENT_REPORT_SAFETY_FLAGS,
  }
}

export {
  REPORT_ROUTE_MODULES as GROWTH_ENGAGEMENT_REPORT_ROUTE_MODULES,
  REPORT_UI_MODULES as GROWTH_ENGAGEMENT_REPORT_UI_MODULES,
}
