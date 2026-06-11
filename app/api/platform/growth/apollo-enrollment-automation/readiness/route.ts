import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildApolloEnrollmentAutomationReadiness } from "@/lib/growth/apollo/apollo-enrollment-automation-route"

export const runtime = "nodejs"
export const maxDuration = 120

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const companyCandidateId = url.searchParams.get("companyCandidateId")?.trim() || null

  const payload = await buildApolloEnrollmentAutomationReadiness(access.admin, {
    env: process.env,
    company_candidate_id: companyCandidateId,
  })
  return NextResponse.json(payload)
}
