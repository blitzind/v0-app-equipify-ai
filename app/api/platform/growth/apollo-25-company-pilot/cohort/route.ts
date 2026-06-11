import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  loadApollo25CompanyPilotLaunchReport,
  parsePilotSelectionMode,
} from "@/lib/growth/apollo/apollo-25-company-pilot-route"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  try {
    const body = (await request.json().catch(() => ({}))) as {
      cohort_name?: string
      pilot_selection_mode?: string
      existing_pipeline_revalidation?: boolean
    }

    const pilot_selection_mode = parsePilotSelectionMode(
      body.pilot_selection_mode ??
        (body.existing_pipeline_revalidation ? "existing_pipeline_revalidation" : "greenfield"),
    )

    const report = await loadApollo25CompanyPilotLaunchReport(access.admin, {
      create_cohort: true,
      cohort_name: body.cohort_name,
      created_by: access.userId,
      created_by_email: access.userEmail,
      pilot_selection_mode,
    })

    return NextResponse.json({
      ok: true,
      report,
      cohort: report.cohort_creation,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
