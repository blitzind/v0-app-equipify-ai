import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listGeV15OrganizationApprovalInbox } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-approval-inbox"
import { GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "organization_not_configured" }, { status: 400 })
  }

  const limit = Number(new URL(request.url).searchParams.get("limit") ?? "50")
  const items = await listGeV15OrganizationApprovalInbox(access.admin, {
    organizationId,
    limit: Number.isFinite(limit) ? limit : 50,
  })

  return NextResponse.json({
    ok: true,
    items,
    qa_marker: GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER,
  })
}
