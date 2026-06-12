import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { materializeApollo25CompanyPilotCohortAssetReadiness } from "@/lib/growth/apollo/apollo-25-company-pilot-route"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  try {
    const body = (await request.json().catch(() => ({}))) as { cohort_id?: string }
    const cohort_id = body.cohort_id?.trim()
    if (!cohort_id) {
      return NextResponse.json({ ok: false, message: "cohort_id is required." }, { status: 400 })
    }

    const report = await materializeApollo25CompanyPilotCohortAssetReadiness(access.admin, {
      cohort_id,
      acting_user_id: access.userId,
      acting_user_email: access.userEmail,
    })

    return NextResponse.json({
      ok: true,
      report,
      launch_recommendation: report.review.launch_recommendation,
      personalization: report.review.personalization,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const status = message === "cohort_not_found" || message === "cohort_snapshot_missing" ? 404 : 500
    return NextResponse.json({ ok: false, message }, { status })
  }
}
