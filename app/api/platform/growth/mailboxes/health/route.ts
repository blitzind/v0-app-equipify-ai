import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listMailboxConnectionEvents } from "@/lib/growth/mailboxes/mailbox-events"
import { fetchMailboxHealthDashboard } from "@/lib/growth/mailboxes/mailbox-repository"
import { isGrowthMailboxConnectionSchemaReady } from "@/lib/growth/mailboxes/mailbox-schema-health"
import { GROWTH_MAILBOX_CONNECTION_PRIVACY_NOTE } from "@/lib/growth/mailboxes/mailbox-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
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
    const [dashboard, events] = await Promise.all([
      fetchMailboxHealthDashboard(access.admin),
      listMailboxConnectionEvents(access.admin, { limit: 30 }),
    ])
    return NextResponse.json({
      ok: true,
      dashboard,
      events,
      privacy_note: GROWTH_MAILBOX_CONNECTION_PRIVACY_NOTE,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "mailbox_health_failed",
        message: error instanceof Error ? error.message : "Could not load mailbox health.",
      },
      { status: 500 },
    )
  }
}
