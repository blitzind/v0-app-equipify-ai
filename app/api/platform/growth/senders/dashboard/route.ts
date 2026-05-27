import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchSenderInfrastructureDashboard } from "@/lib/growth/sender/sender-health-dashboard"
import { listSenderHealthEvents, listSenderTimelineEvents } from "@/lib/growth/sender/sender-health-events"
import { isGrowthSenderInfrastructureSchemaReady } from "@/lib/growth/sender/sender-schema-health"
import { GROWTH_SENDER_INFRASTRUCTURE_PRIVACY_NOTE } from "@/lib/growth/sender/sender-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthSenderInfrastructureSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        error: "growth_schema_incomplete",
        message: "Apply migration 20270124120000_growth_sender_infrastructure.sql, then reload.",
      },
      { status: 503 },
    )
  }

  try {
    const [dashboard, healthEvents, timelineEvents] = await Promise.all([
      fetchSenderInfrastructureDashboard(access.admin),
      listSenderHealthEvents(access.admin, { limit: 30, unresolved_only: false }),
      listSenderTimelineEvents(access.admin, { limit: 20 }),
    ])

    return NextResponse.json({
      ok: true,
      dashboard,
      healthEvents,
      timelineEvents,
      privacy_note: GROWTH_SENDER_INFRASTRUCTURE_PRIVACY_NOTE,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "sender_dashboard_failed",
        message: error instanceof Error ? error.message : "Could not load sender dashboard.",
      },
      { status: 500 },
    )
  }
}
