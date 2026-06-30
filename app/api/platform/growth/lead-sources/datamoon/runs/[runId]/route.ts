import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  fetchDatamoonAudienceImportRunById,
  listDatamoonAudienceImportRecords,
} from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-repository"
import { diagnoseDatamoonProvider } from "@/lib/growth/providers/datamoon"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { runId } = await context.params
  const run = await fetchDatamoonAudienceImportRunById(access.admin, runId)
  if (!run) {
    return NextResponse.json({ ok: false, error: "run_not_found" }, { status: 404 })
  }

  const records = await listDatamoonAudienceImportRecords(access.admin, runId, { limit: 500 })

  return NextResponse.json({
    ok: true,
    run,
    records,
    diagnostics: diagnoseDatamoonProvider(),
  })
}
