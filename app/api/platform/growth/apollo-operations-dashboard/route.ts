import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { loadApolloOperationsDashboard } from "@/lib/growth/apollo/apollo-operations-dashboard"
import { parsePilotSelectionMode } from "@/lib/growth/apollo/apollo-25-company-pilot-route"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const cohort_id = url.searchParams.get("cohort_id")?.trim() || null
  const pilot_selection_mode = parsePilotSelectionMode(
    url.searchParams.get("pilot_selection_mode") ??
      (url.searchParams.get("existing_pipeline_revalidation") === "true"
        ? "existing_pipeline_revalidation"
        : "greenfield"),
  )

  try {
    const dashboard = await loadApolloOperationsDashboard(access.admin, {
      cohort_id,
      pilot_selection_mode,
    })
    return NextResponse.json({ ok: true, dashboard })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, message }, { status: 500 })
  }
}
