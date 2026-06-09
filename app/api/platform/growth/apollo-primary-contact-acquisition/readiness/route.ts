import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildApolloPrimaryContactAcquisitionProductionReadiness } from "@/lib/growth/apollo/apollo-primary-contact-acquisition-production-route"
import { resolveApolloPrimaryContactAcquisitionCompanyCandidateId } from "@/lib/growth/apollo/apollo-primary-contact-acquisition-gates"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const companyCandidateId = url.searchParams.get("companyCandidateId")

  const payload = await buildApolloPrimaryContactAcquisitionProductionReadiness(access.admin, {
    company_candidate_id: resolveApolloPrimaryContactAcquisitionCompanyCandidateId({
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
