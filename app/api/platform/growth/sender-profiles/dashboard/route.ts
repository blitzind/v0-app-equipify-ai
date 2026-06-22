import { NextResponse } from "next/server"
import { requireGrowthCommunicationsSettingsAccess } from "@/lib/growth/settings/growth-workspace-settings-api-access"
import { buildSenderProfilesDashboard } from "@/lib/growth/signatures/sender-profiles-dashboard"
import { isGrowthSenderProfilesSchemaReady } from "@/lib/growth/signatures/sender-profile-schema-health"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthCommunicationsSettingsAccess(request)
  if (!access.ok) return access.response

  if (!(await isGrowthSenderProfilesSchemaReady(access.admin))) {
    return NextResponse.json(
      {
        error: "growth_schema_incomplete",
        message: "Apply migration 20270922120000_growth_sender_profiles_foundation.sql, then reload.",
      },
      { status: 503 },
    )
  }

  try {
    const dashboard = await buildSenderProfilesDashboard(access.admin)
    return NextResponse.json({ ok: true, dashboard })
  } catch (error) {
    return NextResponse.json(
      {
        error: "sender_profiles_dashboard_failed",
        message: error instanceof Error ? error.message : "Could not load sender profiles dashboard.",
      },
      { status: 500 },
    )
  }
}
