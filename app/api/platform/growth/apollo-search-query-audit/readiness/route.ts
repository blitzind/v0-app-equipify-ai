import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildApolloSearchQueryAuditProductionReadiness } from "@/lib/growth/apollo/apollo-search-query-audit-route"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const payload = await buildApolloSearchQueryAuditProductionReadiness(access.admin, {
    env: process.env,
  })
  return NextResponse.json(payload)
}
