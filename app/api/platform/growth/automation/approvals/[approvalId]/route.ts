import { NextResponse } from "next/server"
import { getAutomationApproval } from "@/lib/growth/automation/growth-automation-approval-service"
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ approvalId: string }> },
) {
  const access = await requireAutomationPlatformAccess()
  if (!access.ok) return access.response

  const { approvalId } = await context.params

  try {
    const approval = await getAutomationApproval(access.admin, {
      organizationId: access.organizationId,
      approvalId,
    })

    return NextResponse.json({
      ok: true,
      approval,
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
