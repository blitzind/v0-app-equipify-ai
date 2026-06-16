import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { probeGrowthEngagementDashboardSourceAvailability } from "@/lib/growth/engagement/growth-engagement-dashboard-repository"
import {
  GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER,
  GROWTH_ENGAGEMENT_DASHBOARD_SAFETY_FLAGS,
} from "@/lib/growth/engagement/growth-engagement-dashboard-types"

export type GrowthEngagementDashboardProductionDiagnosticsResult = {
  qa_marker: typeof GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER
  ok: boolean
  read_only: true
  no_db_mutations: true
  sourceAvailability: Awaited<ReturnType<typeof probeGrowthEngagementDashboardSourceAvailability>>
  routeModules: Array<{ path: string; ok: boolean }>
  uiModules: Array<{ path: string; ok: boolean }>
  safetyFlags: typeof GROWTH_ENGAGEMENT_DASHBOARD_SAFETY_FLAGS
}

const ROUTE_MODULES = [
  "app/api/platform/growth/engagement-dashboard/route.ts",
  "app/api/platform/growth/engagement-dashboard/templates/route.ts",
  "app/api/platform/growth/engagement-dashboard/media/route.ts",
  "app/api/platform/growth/engagement-dashboard/high-intent/route.ts",
] as const

const UI_MODULES = [
  "app/(admin)/admin/growth/engagement/page.tsx",
  "components/growth/engagement/growth-engagement-dashboard.tsx",
  "components/growth/engagement/growth-engagement-summary-cards.tsx",
  "components/growth/engagement/growth-engagement-template-table.tsx",
  "components/growth/engagement/growth-engagement-media-table.tsx",
  "components/growth/engagement/growth-engagement-high-intent-panel.tsx",
] as const

export async function runGrowthEngagementDashboardProductionDiagnostics(
  admin: SupabaseClient,
  probeModules: (paths: readonly string[]) => Array<{ path: string; ok: boolean }>,
): Promise<GrowthEngagementDashboardProductionDiagnosticsResult> {
  const sourceAvailability = await probeGrowthEngagementDashboardSourceAvailability(admin)
  const routeModules = probeModules(ROUTE_MODULES)
  const uiModules = probeModules(UI_MODULES)

  const ok =
    routeModules.every((entry) => entry.ok) &&
    uiModules.every((entry) => entry.ok) &&
    GROWTH_ENGAGEMENT_DASHBOARD_SAFETY_FLAGS.no_db_mutations === true

  return {
    qa_marker: GROWTH_ENGAGEMENT_DASHBOARD_QA_MARKER,
    ok,
    read_only: true,
    no_db_mutations: true,
    sourceAvailability,
    routeModules,
    uiModules,
    safetyFlags: GROWTH_ENGAGEMENT_DASHBOARD_SAFETY_FLAGS,
  }
}

export { ROUTE_MODULES as GROWTH_ENGAGEMENT_DASHBOARD_ROUTE_MODULES, UI_MODULES as GROWTH_ENGAGEMENT_DASHBOARD_UI_MODULES }
