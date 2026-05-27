import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listDeliverabilityRiskEvents } from "@/lib/growth/deliverability-ops/deliverability-ops-repository"
import { isGrowthDeliverabilityOpsSchemaReady } from "@/lib/growth/deliverability-ops/schema-health"
import { GROWTH_DELIVERABILITY_OPS_PRIVACY_NOTE } from "@/lib/growth/deliverability-ops/deliverability-ops-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthDeliverabilityOpsSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const resolvedParam = new URL(request.url).searchParams.get("resolved")
  const resolved = resolvedParam === "true" ? true : resolvedParam === "false" ? false : undefined

  try {
    const risks = await listDeliverabilityRiskEvents(access.admin, { resolved, limit: 100 })
    return NextResponse.json({
      ok: true,
      risks,
      privacy_note: GROWTH_DELIVERABILITY_OPS_PRIVACY_NOTE,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
