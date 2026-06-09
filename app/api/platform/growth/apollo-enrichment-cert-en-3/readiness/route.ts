import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildApolloEnrichmentCertEn3ProductionReadiness } from "@/lib/growth/apollo/apollo-enrichment-cert-en-3-production-route"
import { resolveApolloEnrichmentCertEn3CompanyCandidateId } from "@/lib/growth/apollo/apollo-enrichment-cert-en-3-production-route-gates"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const companyCandidateId = url.searchParams.get("companyCandidateId")

  const payload = await buildApolloEnrichmentCertEn3ProductionReadiness(access.admin, {
    company_candidate_id: resolveApolloEnrichmentCertEn3CompanyCandidateId({
      company_candidate_id: companyCandidateId,
    }),
    env: process.env,
  })

  return NextResponse.json({
    ok: true,
    auth_method: "platform_admin",
    ...payload,
  })
}
