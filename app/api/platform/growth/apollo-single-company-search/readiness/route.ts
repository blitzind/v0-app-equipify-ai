import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildApolloSingleCompanySearchDiagnosticReadiness } from "@/lib/growth/apollo/apollo-single-company-search-diagnostic"

export const runtime = "nodejs"
export const maxDuration = 120

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const payload = await buildApolloSingleCompanySearchDiagnosticReadiness(access.admin, {
    env: process.env,
  })
  return NextResponse.json(payload)
}
