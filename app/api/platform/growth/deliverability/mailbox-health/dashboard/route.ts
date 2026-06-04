import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildMailboxHealthIntelligenceDashboard } from "@/lib/growth/deliverability/mailbox-health-intelligence"
import {
  GROWTH_MAILBOX_HEALTH_INTELLIGENCE_MIGRATION,
  isGrowthMailboxHealthIntelligenceSchemaReady,
} from "@/lib/growth/deliverability/reputation-protection-schema-health"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const schemaReady = await isGrowthMailboxHealthIntelligenceSchemaReady(access.admin)
  if (!schemaReady) {
    return NextResponse.json(
      { error: "growth_schema_incomplete", migration: GROWTH_MAILBOX_HEALTH_INTELLIGENCE_MIGRATION },
      { status: 503 },
    )
  }

  try {
    const dashboard = await buildMailboxHealthIntelligenceDashboard(access.admin)
    return NextResponse.json({ ok: true, dashboard })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
