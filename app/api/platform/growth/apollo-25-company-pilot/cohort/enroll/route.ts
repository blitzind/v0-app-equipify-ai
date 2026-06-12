import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { enrollApollo25CompanyPilotCohortEnrollmentBridge } from "@/lib/growth/apollo/apollo-25-company-pilot-route"

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

    const report = await enrollApollo25CompanyPilotCohortEnrollmentBridge(access.admin, {
      cohort_id,
      acting_user_id: access.userId,
      acting_user_email: access.userEmail,
    })

    return NextResponse.json({
      ok: report.ok,
      report,
      companies_processed: report.companies_processed,
      enrollment_candidates_created: report.enrollment_candidates_created,
      enrollment_candidates_reused: report.enrollment_candidates_reused,
      enrollment_candidates_approved: report.enrollment_candidates_approved,
      failures: report.failures,
      enrollment_readiness: report.review.enrollment_readiness,
      ready_for_launch: report.review.launch_recommendation.ready_for_launch,
      certified: report.review.launch_certification.certified,
    }, { status: report.ok ? 200 : 422 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const status = message === "cohort_not_found" || message === "cohort_snapshot_missing" ? 404 : 500
    return NextResponse.json({ ok: false, message }, { status })
  }
}
