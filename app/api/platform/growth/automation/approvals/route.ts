import { NextResponse } from "next/server"
import { listPendingAutomationApprovals } from "@/lib/growth/automation/growth-automation-approval-service"
import { GROWTH_AUTOMATION_APPROVAL_QA_MARKER } from "@/lib/growth/automation/growth-automation-approval-diagnostics"
import { requireAutomationPlatformAccess } from "@/lib/growth/automation/growth-automation-platform-access"
import {
  automationApiSafetyPayload,
  automationApprovalApiSafetyPayload,
  automationEnrollmentApiSafetyPayload,
  automationRuntimeExecutionApiSafetyPayload,
  mapAutomationError,
} from "@/lib/growth/automation/growth-automation-route-utils"
import { GROWTH_AUTOMATION_BUILDER_QA_MARKER } from "@/lib/growth/automation/growth-automation-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireAutomationPlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const flowId = url.searchParams.get("flowId")
  const enrollmentId = url.searchParams.get("enrollmentId")

  try {
    const approvals = await listPendingAutomationApprovals(access.admin, {
      organizationId: access.organizationId,
      flowId,
      enrollmentId,
      status: "pending_only",
    })

    return NextResponse.json({
      ok: true,
      approvals,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      approval_qa_marker: GROWTH_AUTOMATION_APPROVAL_QA_MARKER,
      ...automationApiSafetyPayload(),
      ...automationEnrollmentApiSafetyPayload(),
      ...automationRuntimeExecutionApiSafetyPayload(),
      ...automationApprovalApiSafetyPayload(),
    })
  } catch (error) {
    return mapAutomationError(error)
  }
}
