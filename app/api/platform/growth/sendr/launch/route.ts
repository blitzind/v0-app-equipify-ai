import { NextResponse } from "next/server"
import { GROWTH_SENDR_LAUNCH_QA_MARKER } from "@/lib/growth/sendr/growth-sendr-config"
import { getSendrLaunchWorkspaceSummary } from "@/lib/growth/sendr/growth-sendr-launch-workspace-service"
import { requireSendrPlatformAccess } from "@/lib/growth/sendr/growth-sendr-platform-access"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireSendrPlatformAccess()
  if (!access.ok) return access.response

  try {
    const summary = await getSendrLaunchWorkspaceSummary(access.admin, {
      organizationId: access.organizationId,
    })
    return NextResponse.json({ ok: true, summary, qa_marker: GROWTH_SENDR_LAUNCH_QA_MARKER })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "launch_summary_failed" },
      { status: 500 },
    )
  }
}
