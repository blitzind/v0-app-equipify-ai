import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchAiOsCommandCenterReadModel } from "@/lib/growth/aios/ai-os-command-center-service"
import { GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER } from "@/lib/growth/aios/approvals/growth-human-approval-center-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess(request)
  if (!access.ok) return access.response

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER,
        error: "growth_engine_ai_org_not_configured",
        message: "Growth Engine AI organization is not configured for this deployment.",
      },
      { status: 503 },
    )
  }

  const url = new URL(request.url)
  const channel = url.searchParams.get("channel")

  try {
    const commandCenter = await fetchAiOsCommandCenterReadModel(access.admin, { organizationId })
    const humanApprovalCenter = commandCenter.humanApprovalCenter
    const filteredItems =
      channel && channel !== "all"
        ? humanApprovalCenter.items.filter((item) => item.channel === channel)
        : humanApprovalCenter.items

    return NextResponse.json({
      ok: true,
      qaMarker: GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER,
      humanApprovalCenter: {
        ...humanApprovalCenter,
        items: filteredItems,
        topItems: filteredItems.slice(0, 10),
      },
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        ok: false,
        qaMarker: GROWTH_HUMAN_APPROVAL_CENTER_QA_MARKER,
        error: detail,
        message: "Could not load Human Approval Center.",
      },
      { status: 500 },
    )
  }
}
