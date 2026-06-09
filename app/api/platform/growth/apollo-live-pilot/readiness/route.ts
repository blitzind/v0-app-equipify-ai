import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildApolloLivePilotProductionReadinessPayload } from "@/lib/growth/apollo/apollo-live-pilot-production-route-gates"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const payload = buildApolloLivePilotProductionReadinessPayload(process.env)

  return NextResponse.json({
    ok: true,
    auth_method: "platform_admin",
    ...payload,
  })
}
