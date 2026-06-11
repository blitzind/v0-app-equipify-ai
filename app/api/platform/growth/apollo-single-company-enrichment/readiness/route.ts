import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { buildApolloSingleCompanyEnrichmentDiagnosticReadiness } from "@/lib/growth/apollo/apollo-single-company-enrichment-diagnostic"

export const runtime = "nodejs"
export const maxDuration = 120

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const payload = await buildApolloSingleCompanyEnrichmentDiagnosticReadiness(access.admin, {
    env: process.env,
  })
  return NextResponse.json(payload)
}
