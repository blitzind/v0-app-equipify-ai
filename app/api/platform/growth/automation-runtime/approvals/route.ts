import { NextResponse } from "next/server"
import { getGrowthEngineAiOrgId, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  approveGeV15LeadPreparedAction,
  editGeV15LeadPreparedAction,
  executeGeV15ApprovedPreparedAction,
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

export async function PATCH(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json()) as {
    leadId?: string
    actionId?: string
    editedDraftContent?: string | null
    editedSubject?: string | null
  }

  if (!body.leadId || !body.actionId) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
  }

  const result = await editGeV15LeadPreparedAction(access.admin, {
    leadId: body.leadId,
    actionId: body.actionId,
    editedDraftContent: body.editedDraftContent,
    editedSubject: body.editedSubject,
    editedBy: access.userId,
  })

  return NextResponse.json({ ...result, qa_marker: GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER })
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json()) as {
    leadId?: string
    actionId?: string
    decision?: "approve" | "reject" | "execute"
    reason?: string | null
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

  if (body.decision === "reject") {
    const result = await rejectGeV15LeadPreparedAction(access.admin, {
      leadId: body.leadId,
      actionId: body.actionId,
      rejectedBy: access.userId,
      reason: body.reason ?? null,
    })
    return NextResponse.json({ ...result, qa_marker: GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER })
  }

  const organizationId = getGrowthEngineAiOrgId()
  if (!organizationId) {
    return NextResponse.json({ ok: false, error: "organization_not_configured" }, { status: 400 })
  }

  const result = await executeGeV15ApprovedPreparedAction(access.admin, {
    leadId: body.leadId,
    actionId: body.actionId,
    organizationId,
    actorUserId: access.userId,
    actorEmail: access.userEmail,
  })

  return NextResponse.json({ ...result, qa_marker: GE_V1_5_AUTOMATION_RUNTIME_QA_MARKER })
}
