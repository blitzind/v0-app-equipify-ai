import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { probeGrowthEngagementDashboardSourceAvailability } from "@/lib/growth/engagement/growth-engagement-dashboard-repository"
import {
  GROWTH_ENGAGEMENT_WATCHLIST_QA_MARKER,
  GROWTH_ENGAGEMENT_WATCHLIST_SAFETY_FLAGS,
} from "@/lib/growth/engagement/growth-engagement-watchlist-types"

export type GrowthEngagementWatchlistProductionDiagnosticsResult = {
  qa_marker: typeof GROWTH_ENGAGEMENT_WATCHLIST_QA_MARKER
  ok: boolean
  read_only: true
  no_db_mutations: true
  no_background_jobs: true
  sourceAvailability: Awaited<ReturnType<typeof probeGrowthEngagementDashboardSourceAvailability>>
  routeModules: Array<{ path: string; ok: boolean }>
  uiModules: Array<{ path: string; ok: boolean }>
  safetyFlags: typeof GROWTH_ENGAGEMENT_WATCHLIST_SAFETY_FLAGS
}

const WATCHLIST_ROUTE_MODULES = [
  "app/api/platform/growth/engagement-dashboard/watchlists/route.ts",
  "app/api/platform/growth/engagement-dashboard/watchlists/[watchlistId]/route.ts",
  "app/api/platform/growth/engagement-dashboard/alerts/route.ts",
  "app/api/platform/growth/engagement-dashboard/alerts/[alertId]/route.ts",
] as const

const WATCHLIST_UI_MODULES = [
  "components/growth/engagement/growth-engagement-watchlists-panel.tsx",
  "components/growth/engagement/growth-engagement-watchlist-card.tsx",
  "components/growth/engagement/growth-engagement-alerts-panel.tsx",
  "components/growth/engagement/growth-engagement-alert-card.tsx",
] as const

export async function runGrowthEngagementWatchlistProductionDiagnostics(
  admin: SupabaseClient,
  probeModules: (paths: readonly string[]) => Array<{ path: string; ok: boolean }>,
): Promise<GrowthEngagementWatchlistProductionDiagnosticsResult> {
  const sourceAvailability = await probeGrowthEngagementDashboardSourceAvailability(admin)
  const routeModules = probeModules(WATCHLIST_ROUTE_MODULES)
  const uiModules = probeModules(WATCHLIST_UI_MODULES)

  const ok =
    routeModules.every((entry) => entry.ok) &&
    uiModules.every((entry) => entry.ok) &&
    GROWTH_ENGAGEMENT_WATCHLIST_SAFETY_FLAGS.no_background_jobs === true

  return {
    qa_marker: GROWTH_ENGAGEMENT_WATCHLIST_QA_MARKER,
    ok,
    read_only: true,
    no_db_mutations: true,
    no_background_jobs: true,
    sourceAvailability,
    routeModules,
    uiModules,
    safetyFlags: GROWTH_ENGAGEMENT_WATCHLIST_SAFETY_FLAGS,
  }
}

export {
  WATCHLIST_ROUTE_MODULES as GROWTH_ENGAGEMENT_WATCHLIST_ROUTE_MODULES,
  WATCHLIST_UI_MODULES as GROWTH_ENGAGEMENT_WATCHLIST_UI_MODULES,
}
