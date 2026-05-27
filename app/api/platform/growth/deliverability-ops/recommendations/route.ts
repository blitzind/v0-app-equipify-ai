import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listDeliverabilityRecommendations } from "@/lib/growth/deliverability-ops/deliverability-ops-repository"
import { isGrowthDeliverabilityOpsSchemaReady } from "@/lib/growth/deliverability-ops/schema-health"
import type { GrowthDeliverabilityOpsStatus } from "@/lib/growth/deliverability-ops/deliverability-ops-types"
import { GROWTH_DELIVERABILITY_OPS_PRIVACY_NOTE } from "@/lib/growth/deliverability-ops/deliverability-ops-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthDeliverabilityOpsSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const status = new URL(request.url).searchParams.get("status") as GrowthDeliverabilityOpsStatus | null
  try {
    const recommendations = await listDeliverabilityRecommendations(access.admin, {
      status: status ?? undefined,
      limit: 100,
    })
    return NextResponse.json({
      ok: true,
      recommendations,
      privacy_note: GROWTH_DELIVERABILITY_OPS_PRIVACY_NOTE,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
