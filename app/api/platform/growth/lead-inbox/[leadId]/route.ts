import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchLeadInboxById } from "@/lib/growth/lead-inbox/lead-inbox-repository"
import { buildLeadOperatorWorkspacePayload } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-builder"
import { GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER } from "@/lib/growth/lead-operator-workspace/lead-operator-workspace-types"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ leadId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  const row = await fetchLeadInboxById(access.admin, leadId)
  if (!row) {
    return NextResponse.json(
      { ok: false, error: "not_found", message: "Lead inbox candidate not found." },
      { status: 404 },
    )
  }

  const workspace = await buildLeadOperatorWorkspacePayload(access.admin, row)

  return NextResponse.json({
    ok: true,
    qa_marker: GROWTH_LEAD_OPERATOR_WORKSPACE_QA_MARKER,
    workspace,
  })
}
