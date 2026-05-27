import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildReputationProtectionDashboard } from "@/lib/growth/deliverability/reputation-protection-dashboard"
import {
  GROWTH_DELIVERABILITY_REPUTATION_PROTECTION_MIGRATION,
  isGrowthDeliverabilityReputationProtectionSchemaReady,
} from "@/lib/growth/deliverability/reputation-protection-schema-health"
import { GROWTH_REPUTATION_PROTECTION_PRIVACY_NOTE } from "@/lib/growth/deliverability/reputation-protection-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const schemaReady = await isGrowthDeliverabilityReputationProtectionSchemaReady(access.admin)
  if (!schemaReady) {
    return NextResponse.json(
      {
        error: "growth_schema_incomplete",
        migration: GROWTH_DELIVERABILITY_REPUTATION_PROTECTION_MIGRATION,
      },
      { status: 503 },
    )
  }

  try {
    const dashboard = await buildReputationProtectionDashboard(access.admin)
    return NextResponse.json({
      ok: true,
      dashboard,
      privacy_note: GROWTH_REPUTATION_PROTECTION_PRIVACY_NOTE,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
