import { NextResponse } from "next/server"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { fetchWarmupDashboard, listWarmupEvents, listWarmupProfiles } from "@/lib/growth/warmup/warmup-repository"
import { listWarmupTimelineEvents } from "@/lib/growth/warmup/warmup-events"
import { buildWarmupExecutorDashboardStats, buildRecipientPoolSummary } from "@/lib/growth/warmup/warmup-send-executor"
import { listWarmupRecipients } from "@/lib/growth/warmup/warmup-recipient-repository"
import { isGrowthWarmupFoundationSchemaReady } from "@/lib/growth/warmup/warmup-schema-health"
import { GROWTH_WARMUP_PRIVACY_NOTE } from "@/lib/growth/warmup/warmup-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthWarmupFoundationSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        error: "growth_schema_incomplete",
        message: "Apply migration 20270127120000_growth_warmup_foundation.sql, then reload.",
      },
      { status: 503 },
    )
  }

  try {
    const [dashboard, events, timeline, profiles, approvedRecipients] = await Promise.all([
      fetchWarmupDashboard(access.admin),
      listWarmupEvents(access.admin, { limit: 30, unresolved_only: true }),
      listWarmupTimelineEvents(access.admin, { limit: 20 }),
      listWarmupProfiles(access.admin),
      listWarmupRecipients(access.admin, { activeOnly: true, approvedOnly: true }),
    ])

    const warmingSenderCount = profiles.filter((profile) => profile.status === "warming").length
    const recipientPoolSummary = await buildRecipientPoolSummary(access.admin, approvedRecipients, {
      warmingSenderCount,
    })
    const executor_stats = await buildWarmupExecutorDashboardStats(access.admin, profiles).catch(() => [])

    return NextResponse.json({
      ok: true,
      dashboard,
      events,
      timeline,
      executor_stats,
      recipient_pool_summary: recipientPoolSummary,
      privacy_note: GROWTH_WARMUP_PRIVACY_NOTE,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "warmup_dashboard_failed",
        message: error instanceof Error ? error.message : "Could not load warmup dashboard.",
      },
      { status: 500 },
    )
  }
}
