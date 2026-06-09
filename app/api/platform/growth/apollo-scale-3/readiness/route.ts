import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildApolloScale3ProductionReadiness } from "@/lib/growth/apollo/apollo-scale-3-production-route"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response
  const payload = await buildApolloScale3ProductionReadiness(access.admin, { env: process.env })
  return NextResponse.json({ ok: true, auth_method: "platform_admin", ...payload })
}
