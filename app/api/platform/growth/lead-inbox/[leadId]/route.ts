import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  GROWTH_REVENUE_QUEUE_DETAIL_BRIDGE_QA_MARKER,
  loadRevenueQueueOperatorWorkspace,
} from "@/lib/growth/revenue-queue/revenue-queue-detail-bridge"
import { GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ leadId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  const detail = await loadRevenueQueueOperatorWorkspace(access.admin, leadId)
  if (!detail) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: "Lead inbox candidate not found." },
      { status: 404 },
    )
  }

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER,
    detail_bridge_marker: GROWTH_REVENUE_QUEUE_DETAIL_BRIDGE_QA_MARKER,
    queue_resolution: detail.resolution,
    workspace: detail.workspace,
  })
}
