import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildApolloEnrichmentRecoveryProductionReadiness } from "@/lib/growth/apollo/apollo-enrichment-recovery-production-route"

export const runtime = "nodejs"
export const maxDuration = 60

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  const payload = await buildApolloEnrichmentRecoveryProductionReadiness(access.admin)
  return NextResponse.json(payload)
}
