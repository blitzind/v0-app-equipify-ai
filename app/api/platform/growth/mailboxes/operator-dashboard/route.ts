import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildConnectedMailboxesDashboard } from "@/lib/growth/mailboxes/connected-mailboxes-dashboard"
import { isGrowthMailboxConnectionSchemaReady } from "@/lib/growth/mailboxes/mailbox-schema-health"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthMailboxConnectionSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        error: "growth_schema_incomplete",
        message: "Apply migration 20270125120000_growth_mailbox_connections.sql, then reload.",
      },
      { status: 503 },
    )
  }

  try {
    const dashboard = await buildConnectedMailboxesDashboard(access.admin)
    return NextResponse.json({ ok: true, dashboard })
  } catch (error) {
    return NextResponse.json(
      {
        error: "connected_mailboxes_dashboard_failed",
        message: error instanceof Error ? error.message : "Could not load connected mailboxes dashboard.",
      },
      { status: 500 },
    )
  }
}
