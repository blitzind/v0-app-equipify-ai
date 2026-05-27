import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchInboxTeamDashboard } from "@/lib/growth/inbox-team-ownership/inbox-team-dashboard"
import { isGrowthInboxTeamOwnershipSchemaReady } from "@/lib/growth/inbox-team-ownership/inbox-team-ownership-schema-health"
import { GROWTH_INBOX_TEAM_OWNERSHIP_PRIVACY_NOTE } from "@/lib/growth/inbox-team-ownership/inbox-team-ownership-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthInboxTeamOwnershipSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete", message: "Apply inbox team ownership migration." }, { status: 503 })
  }

  try {
    const dashboard = await fetchInboxTeamDashboard(access.admin, { userId: access.userId })
    return NextResponse.json({ ok: true, dashboard, privacy_note: GROWTH_INBOX_TEAM_OWNERSHIP_PRIVACY_NOTE })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load inbox team dashboard." }, { status: 500 })
  }
}
