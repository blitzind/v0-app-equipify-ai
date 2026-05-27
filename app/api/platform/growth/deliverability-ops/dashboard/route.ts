import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthDeliverabilityOpsDashboard } from "@/lib/growth/deliverability-ops/dashboard"
import { isGrowthDeliverabilityOpsSchemaReady } from "@/lib/growth/deliverability-ops/schema-health"
import { GROWTH_DELIVERABILITY_OPS_PRIVACY_NOTE } from "@/lib/growth/deliverability-ops/deliverability-ops-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthDeliverabilityOpsSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  try {
    const dashboard = await fetchGrowthDeliverabilityOpsDashboard(access.admin)
    return NextResponse.json({
      ok: true,
      dashboard,
      privacy_note: GROWTH_DELIVERABILITY_OPS_PRIVACY_NOTE,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
