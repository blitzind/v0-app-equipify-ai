import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { probeGrowthEngagementDashboardSourceAvailability } from "@/lib/growth/engagement/growth-engagement-dashboard-repository"
import { probeGrowthEngagementTimelineSourceAvailability } from "@/lib/growth/engagement/growth-engagement-timeline-repository"
import {
  GROWTH_ENGAGEMENT_COMMAND_CENTER_QA_MARKER,
  GROWTH_ENGAGEMENT_COMMAND_CENTER_SAFETY_FLAGS,
} from "@/lib/growth/engagement/growth-engagement-command-center-types"
import { mergeCommandCenterSourceAvailability } from "@/lib/growth/engagement/growth-engagement-command-center-utils"

export type GrowthEngagementCommandCenterProductionDiagnosticsResult = {
  qa_marker: typeof GROWTH_ENGAGEMENT_COMMAND_CENTER_QA_MARKER
  ok: boolean
  read_only: true
  no_db_mutations: true
  no_background_jobs: true
  sourceAvailability: ReturnType<typeof mergeCommandCenterSourceAvailability>
  routeModules: Array<{ path: string; ok: boolean }>
  uiModules: Array<{ path: string; ok: boolean }>
  safetyFlags: typeof GROWTH_ENGAGEMENT_COMMAND_CENTER_SAFETY_FLAGS
}

const COMMAND_CENTER_ROUTE_MODULES = [
  "app/api/platform/growth/engagement-dashboard/command-center/route.ts",
  "app/api/platform/growth/engagement-dashboard/command-center/overview/route.ts",
  "app/api/platform/growth/engagement-dashboard/command-center/timeline/route.ts",
  "app/api/platform/growth/engagement-dashboard/command-center/high-intent/route.ts",
] as const

const COMMAND_CENTER_UI_MODULES = [
  "components/growth/engagement/growth-engagement-command-center.tsx",
  "components/growth/engagement/growth-engagement-command-center-header.tsx",
  "components/growth/engagement/growth-engagement-command-center-sidebar.tsx",
  "components/growth/engagement/growth-engagement-command-center-feed.tsx",
  "components/growth/engagement/growth-engagement-command-center-high-intent-panel.tsx",
  "components/growth/engagement/growth-engagement-command-center-summary.tsx",
] as const

export async function runGrowthEngagementCommandCenterProductionDiagnostics(
  admin: SupabaseClient,
  probeModules: (paths: readonly string[]) => Array<{ path: string; ok: boolean }>,
): Promise<GrowthEngagementCommandCenterProductionDiagnosticsResult> {
  const [dashboardProbe, timelineProbe] = await Promise.all([
    probeGrowthEngagementDashboardSourceAvailability(admin),
    probeGrowthEngagementTimelineSourceAvailability(admin),
  ])

  const timelineAvailable = Object.values(timelineProbe).some((entry) => entry.source_available)
  const sourceAvailability = mergeCommandCenterSourceAvailability({
    dashboard: dashboardProbe,
    timelineAvailable,
  })

  const routeModules = probeModules(COMMAND_CENTER_ROUTE_MODULES)
  const uiModules = probeModules(COMMAND_CENTER_UI_MODULES)

  const ok =
    routeModules.every((entry) => entry.ok) &&
    uiModules.every((entry) => entry.ok) &&
    GROWTH_ENGAGEMENT_COMMAND_CENTER_SAFETY_FLAGS.no_background_jobs === true

  return {
    qa_marker: GROWTH_ENGAGEMENT_COMMAND_CENTER_QA_MARKER,
    ok,
    read_only: true,
    no_db_mutations: true,
    no_background_jobs: true,
    sourceAvailability,
    routeModules,
    uiModules,
    safetyFlags: GROWTH_ENGAGEMENT_COMMAND_CENTER_SAFETY_FLAGS,
  }
}

export {
  COMMAND_CENTER_ROUTE_MODULES as GROWTH_ENGAGEMENT_COMMAND_CENTER_ROUTE_MODULES,
  COMMAND_CENTER_UI_MODULES as GROWTH_ENGAGEMENT_COMMAND_CENTER_UI_MODULES,
}
