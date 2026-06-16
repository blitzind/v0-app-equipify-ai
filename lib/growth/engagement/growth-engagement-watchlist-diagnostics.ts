import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listGrowthEngagementAlerts } from "@/lib/growth/engagement/growth-engagement-alert-service"
import {
  GROWTH_ENGAGEMENT_ALERT_QA_MARKER,
  GROWTH_ENGAGEMENT_ALERT_TYPES,
} from "@/lib/growth/engagement/growth-engagement-alert-types"
import { listGrowthEngagementWatchlists } from "@/lib/growth/engagement/growth-engagement-watchlist-service"
import {
  GROWTH_ENGAGEMENT_PREDEFINED_WATCHLISTS,
  GROWTH_ENGAGEMENT_WATCHLIST_QA_MARKER,
  GROWTH_ENGAGEMENT_WATCHLIST_SAFETY_FLAGS,
  alertMatchesWatchlist,
  clampEngagementAlertLimit,
  parseEngagementAlertType,
  resolveEngagementAlertSeverity,
} from "@/lib/growth/engagement/growth-engagement-watchlist-utils"

export type GrowthEngagementWatchlistDiagnosticsResult = {
  qa_marker: typeof GROWTH_ENGAGEMENT_WATCHLIST_QA_MARKER
  ok: boolean
  checks: Array<{ name: string; ok: boolean; detail?: string }>
}

export async function runGrowthEngagementWatchlistDiagnostics(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthEngagementWatchlistDiagnosticsResult> {
  const checks: GrowthEngagementWatchlistDiagnosticsResult["checks"] = []

  checks.push({ name: "watchlist_count", ok: GROWTH_ENGAGEMENT_PREDEFINED_WATCHLISTS.length === 4 })
  checks.push({ name: "alert_type_count", ok: GROWTH_ENGAGEMENT_ALERT_TYPES.length === 10 })
  checks.push({ name: "limit_clamp", ok: clampEngagementAlertLimit(999) === 500 && clampEngagementAlertLimit(0) === 1 })
  checks.push({
    name: "severity_assignment",
    ok: resolveEngagementAlertSeverity("booking_completed") === "critical" && resolveEngagementAlertSeverity("repeat_viewer") === "low",
  })
  checks.push({
    name: "watchlist_rule_match",
    ok: alertMatchesWatchlist(
      {
        alertId: "test",
        watchlistId: null,
        alertType: "high_intent_detected",
        title: "Test",
        description: "Test",
        severity: "high",
        entityType: "lead",
        entityId: "lead-1",
        occurredAt: "2026-06-01T00:00:00.000Z",
        metadata: {},
        source: "timeline_event",
        acknowledged: false,
      },
      GROWTH_ENGAGEMENT_PREDEFINED_WATCHLISTS[0]!,
    ),
  })
  checks.push({
    name: "safety_flags",
    ok:
      GROWTH_ENGAGEMENT_WATCHLIST_SAFETY_FLAGS.read_only === true &&
      GROWTH_ENGAGEMENT_WATCHLIST_SAFETY_FLAGS.no_db_mutations === true &&
      GROWTH_ENGAGEMENT_WATCHLIST_SAFETY_FLAGS.no_background_jobs === true &&
      GROWTH_ENGAGEMENT_WATCHLIST_SAFETY_FLAGS.no_notifications === true,
  })
  checks.push({ name: "invalid_alert_type", ok: parseEngagementAlertType("invalid") === null })

  const catalog = listGrowthEngagementWatchlists()
  checks.push({ name: "watchlist_catalog", ok: catalog.watchlists.length === 4 })

  const alerts = await listGrowthEngagementAlerts(admin, {
    organizationId,
    dateRange: "last_30_days",
    limit: 25,
  })
  checks.push({ name: "alert_service", ok: alerts.qa_marker === GROWTH_ENGAGEMENT_ALERT_QA_MARKER })
  checks.push({ name: "alert_safety", ok: alerts.safety.no_background_jobs === true })

  return {
    qa_marker: GROWTH_ENGAGEMENT_WATCHLIST_QA_MARKER,
    ok: checks.every((check) => check.ok),
    checks,
  }
}
