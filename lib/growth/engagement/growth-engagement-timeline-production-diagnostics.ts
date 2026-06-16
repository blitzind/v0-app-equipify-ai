import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { probeGrowthEngagementTimelineSourceAvailability } from "@/lib/growth/engagement/growth-engagement-timeline-repository"
import { GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER } from "@/lib/growth/engagement/growth-engagement-timeline-types"
import { GROWTH_ENGAGEMENT_TIMELINE_SAFETY_FLAGS } from "@/lib/growth/engagement/growth-engagement-timeline-utils"

export type GrowthEngagementTimelineProductionDiagnosticsResult = {
  qa_marker: typeof GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER
  ok: boolean
  read_only: true
  no_db_mutations: true
  sourceAvailability: Awaited<ReturnType<typeof probeGrowthEngagementTimelineSourceAvailability>>
  routeModules: Array<{ path: string; ok: boolean }>
  uiModules: Array<{ path: string; ok: boolean }>
  safetyFlags: typeof GROWTH_ENGAGEMENT_TIMELINE_SAFETY_FLAGS
}

const TIMELINE_ROUTE_MODULES = [
  "app/api/platform/growth/engagement-dashboard/timeline/route.ts",
  "app/api/platform/growth/engagement-dashboard/lead/[leadId]/route.ts",
  "app/api/platform/growth/engagement-dashboard/templates/[templateId]/route.ts",
  "app/api/platform/growth/engagement-dashboard/media/[mediaAssetId]/route.ts",
  "app/api/platform/growth/engagement-dashboard/share-pages/[sharePageId]/route.ts",
] as const

const TIMELINE_UI_MODULES = [
  "components/growth/engagement/growth-engagement-timeline-panel.tsx",
  "components/growth/engagement/growth-engagement-timeline-item.tsx",
  "components/growth/engagement/growth-engagement-drilldown-drawer.tsx",
  "components/growth/engagement/growth-engagement-lead-drilldown.tsx",
  "components/growth/engagement/growth-engagement-template-drilldown.tsx",
  "components/growth/engagement/growth-engagement-media-drilldown.tsx",
  "components/growth/engagement/growth-engagement-share-page-drilldown.tsx",
] as const

export async function runGrowthEngagementTimelineProductionDiagnostics(
  admin: SupabaseClient,
  probeModules: (paths: readonly string[]) => Array<{ path: string; ok: boolean }>,
): Promise<GrowthEngagementTimelineProductionDiagnosticsResult> {
  const sourceAvailability = await probeGrowthEngagementTimelineSourceAvailability(admin)
  const routeModules = probeModules(TIMELINE_ROUTE_MODULES)
  const uiModules = probeModules(TIMELINE_UI_MODULES)

  const ok =
    routeModules.every((entry) => entry.ok) &&
    uiModules.every((entry) => entry.ok) &&
    GROWTH_ENGAGEMENT_TIMELINE_SAFETY_FLAGS.no_db_mutations === true

  return {
    qa_marker: GROWTH_ENGAGEMENT_TIMELINE_QA_MARKER,
    ok,
    read_only: true,
    no_db_mutations: true,
    sourceAvailability,
    routeModules,
    uiModules,
    safetyFlags: GROWTH_ENGAGEMENT_TIMELINE_SAFETY_FLAGS,
  }
}

export {
  TIMELINE_ROUTE_MODULES as GROWTH_ENGAGEMENT_TIMELINE_ROUTE_MODULES,
  TIMELINE_UI_MODULES as GROWTH_ENGAGEMENT_TIMELINE_UI_MODULES,
}
