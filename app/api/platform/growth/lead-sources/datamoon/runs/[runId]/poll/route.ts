import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { pollDatamoonAudienceImportRun } from "@/lib/growth/lead-sources/datamoon/datamoon-audience-import-service"
import { diagnoseDatamoonProvider } from "@/lib/growth/providers/datamoon"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { runId } = await context.params
  const result = await pollDatamoonAudienceImportRun(access.admin, runId)

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, diagnostics: diagnoseDatamoonProvider() },
      { status: 400 },
    )
  }

  return NextResponse.json({
    ok: true,
    run: result.run,
    records: result.records,
    diagnostics: diagnoseDatamoonProvider(),
  })
}
