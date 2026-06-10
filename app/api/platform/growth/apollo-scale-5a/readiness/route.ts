import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildApolloScale5AProductionReadiness } from "@/lib/growth/apollo/apollo-scale-5a-production-route"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const payload = await buildApolloScale5AProductionReadiness({ env: process.env })
  return NextResponse.json({ ok: true, auth_method: "platform_admin", ...payload })
}
