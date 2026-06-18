import { NextResponse } from "next/server"
import { buildHumanInterventionReadinessPayload } from "@/lib/growth/human-interventions/human-intervention-route-gates"
import { guardGrowthFeatureApiRoute } from "@/lib/growth/runtime/growth-feature-api-guards"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const coldGuard = await guardGrowthFeatureApiRoute("humanInterventionDashboard", request)
  if (coldGuard) return coldGuard
  return NextResponse.json({
    ok: true,
    ...buildHumanInterventionReadinessPayload(),
  })
}
