import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildApolloOperatorScaleReadinessPayload } from "@/lib/growth/apollo/apollo-operator-scale-route"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  return NextResponse.json({ ok: true, readiness: buildApolloOperatorScaleReadinessPayload() })
}
