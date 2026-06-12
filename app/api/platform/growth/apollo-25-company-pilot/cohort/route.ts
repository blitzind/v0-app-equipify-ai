import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  createApollo25CompanyPilotDraftCohort,
  loadApollo25CompanyPilotCohortReview,
  parsePilotSelectionMode,
} from "@/lib/growth/apollo/apollo-25-company-pilot-route"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  try {
    const url = new URL(request.url)
    const cohort_id = url.searchParams.get("cohort_id")?.trim() || undefined
    const preview = url.searchParams.get("preview") === "true"

    const review = await loadApollo25CompanyPilotCohortReview(access.admin, {
      cohort_id,
      preview,
    })

    return NextResponse.json({
      ok: true,
      cohort_size: review.cohort_size,
      target_size: review.target_size,
      companies: review.companies,
      review,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const status = message === "cohort_not_found" ? 404 : 500
    return NextResponse.json({ ok: false, message }, { status })
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  try {
    const body = (await request.json().catch(() => ({}))) as {
      cohort_name?: string
      pilot_selection_mode?: string
      existing_pipeline_revalidation?: boolean
    }

    if (
      parsePilotSelectionMode(
        body.pilot_selection_mode ??
          (body.existing_pipeline_revalidation ? "existing_pipeline_revalidation" : "greenfield"),
      ) !== "greenfield"
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "Phase 14.2F draft cohort creation requires greenfield pilot_selection_mode.",
        },
        { status: 400 },
      )
    }

    const { report, review } = await createApollo25CompanyPilotDraftCohort(access.admin, {
      cohort_name: body.cohort_name,
      created_by: access.userId,
      created_by_email: access.userEmail,
    })

    return NextResponse.json({
      ok: true,
      report,
      cohort: report.cohort_creation,
      cohort_size: review.cohort_size,
      target_size: review.target_size,
      companies: review.companies,
      review,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
