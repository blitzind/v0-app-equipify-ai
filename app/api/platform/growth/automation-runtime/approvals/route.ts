import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  approveGeV15LeadPreparedAction,
  listGeV15LeadPendingApprovals,
  rejectGeV15LeadPreparedAction,
} from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-approval-service"
import { GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER } from "@/lib/growth/automation-runtime/ge-v1-5-automation-runtime-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const leadId = new URL(request.url).searchParams.get("leadId")
  if (!leadId) {
    return NextResponse.json({ ok: false, error: "leadId_required" }, { status: 400 })
  }

  const pending = await listGeV15LeadPendingApprovals(access.admin, leadId)
  return NextResponse.json({
    ok: true,
    pending,
    qa_marker: GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER,
  })
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json()) as {
    leadId?: string
    actionId?: string
    decision?: "approve" | "reject"
  }

  if (!body.leadId || !body.actionId || !body.decision) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
  }

  if (body.decision === "approve") {
    const result = await approveGeV15LeadPreparedAction(access.admin, {
      leadId: body.leadId,
      actionId: body.actionId,
      approvedBy: access.userId,
    })
    return NextResponse.json({ ...result, qa_marker: GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER })
  }

  const result = await rejectGeV15LeadPreparedAction(access.admin, {
    leadId: body.leadId,
    actionId: body.actionId,
  })
  return NextResponse.json({ ...result, qa_marker: GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER })
}
