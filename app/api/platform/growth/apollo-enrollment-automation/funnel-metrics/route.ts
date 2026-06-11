import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadApolloEnrollmentFunnelMetrics } from "@/lib/growth/apollo/apollo-enrollment-automation-route"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const viewParam = url.searchParams.get("view")?.trim()
  const view = viewParam === "current_run" ? "current_run" : "historical"
  const companyCandidateId = url.searchParams.get("companyCandidateId")?.trim() || null

  try {
    const metrics = await loadApolloEnrollmentFunnelMetrics(access.admin, {
      view,
      company_candidate_id: companyCandidateId,
    })
    return NextResponse.json({ ok: true, metrics })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
