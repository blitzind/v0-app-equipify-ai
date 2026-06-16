import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthEngagementCommandCenter } from "@/lib/growth/engagement/growth-engagement-command-center-service"
import {
  GROWTH_ENGAGEMENT_COMMAND_CENTER_QA_MARKER,
  GROWTH_ENGAGEMENT_COMMAND_CENTER_SAFETY_FLAGS,
} from "@/lib/growth/engagement/growth-engagement-command-center-types"
import {
  clampEngagementCommandCenterLimit,
  GROWTH_ENGAGEMENT_COMMAND_CENTER_HIGH_INTENT_ALERT_TYPES,
} from "@/lib/growth/engagement/growth-engagement-command-center-utils"

export type GrowthEngagementCommandCenterDiagnosticsResult = {
  qa_marker: typeof GROWTH_ENGAGEMENT_COMMAND_CENTER_QA_MARKER
  ok: boolean
  checks: Array<{ name: string; ok: boolean; detail?: string }>
}

export async function runGrowthEngagementCommandCenterDiagnostics(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthEngagementCommandCenterDiagnosticsResult> {
  const checks: GrowthEngagementCommandCenterDiagnosticsResult["checks"] = []

  checks.push({ name: "high_intent_alert_types", ok: GROWTH_ENGAGEMENT_COMMAND_CENTER_HIGH_INTENT_ALERT_TYPES.length === 8 })
  checks.push({ name: "limit_clamp", ok: clampEngagementCommandCenterLimit(999) === 500 && clampEngagementCommandCenterLimit(0) === 1 })
  checks.push({
    name: "safety_flags",
    ok:
      GROWTH_ENGAGEMENT_COMMAND_CENTER_SAFETY_FLAGS.read_only === true &&
      GROWTH_ENGAGEMENT_COMMAND_CENTER_SAFETY_FLAGS.no_db_mutations === true &&
      GROWTH_ENGAGEMENT_COMMAND_CENTER_SAFETY_FLAGS.no_background_jobs === true,
  })

  const workspace = await getGrowthEngagementCommandCenter(admin, {
    organizationId,
    dateRange: "last_30_days",
    limit: 25,
  })

  checks.push({ name: "workspace_composition", ok: workspace.workspace.workspaceId.startsWith("command-center:") })
  checks.push({ name: "overview_section", ok: workspace.workspace.overview.overview.totalSharePageViews >= 0 })
  checks.push({ name: "timeline_section", ok: Array.isArray(workspace.workspace.timeline.timeline.items) })
  checks.push({ name: "reports_section", ok: workspace.workspace.reports.catalog.length === 7 })
  checks.push({ name: "alerts_section", ok: Array.isArray(workspace.workspace.alerts.alerts) })
  checks.push({ name: "watchlists_section", ok: workspace.workspace.watchlists.watchlists.length === 4 })
  checks.push({ name: "high_intent_cards", ok: Array.isArray(workspace.workspace.highIntent.cards) })
  checks.push({ name: "feed_section", ok: workspace.workspace.feed.total >= workspace.workspace.feed.items.length })
  checks.push({ name: "sidebar_counts", ok: typeof workspace.workspace.sidebar.alertsBySeverity.critical === "number" })
  checks.push({ name: "source_availability", ok: typeof workspace.workspace.sourceAvailability.timeline.source_available === "boolean" })

  return {
    qa_marker: GROWTH_ENGAGEMENT_COMMAND_CENTER_QA_MARKER,
    ok: checks.every((check) => check.ok),
    checks,
  }
}
