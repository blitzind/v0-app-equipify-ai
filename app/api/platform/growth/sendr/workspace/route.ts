import { NextResponse } from "next/server"
import {
  GROWTH_SENDR_WORKSPACE_QA_MARKER,
} from "@/lib/growth/sendr/growth-sendr-config"
import { requireSendrPlatformAccess } from "@/lib/growth/sendr/growth-sendr-platform-access"
import { getGrowthSendrWorkspaceSummary } from "@/lib/growth/sendr/growth-sendr-workspace-service"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireSendrPlatformAccess()
  if (!access.ok) return access.response

  try {
    const summary = await getGrowthSendrWorkspaceSummary(access.admin, access.organizationId)
    return NextResponse.json({
      ok: true,
      summary,
      qa_marker: GROWTH_SENDR_WORKSPACE_QA_MARKER,
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "workspace_load_failed" },
      { status: 500 },
    )
  }
}
