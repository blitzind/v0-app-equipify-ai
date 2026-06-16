import { NextResponse } from "next/server"
import { resumeAutomationAfterApproval } from "@/lib/growth/automation/growth-automation-approval-service"
import { GROWTH_AUTOMATION_APPROVAL_QA_MARKER } from "@/lib/growth/automation/growth-automation-approval-diagnostics"
import { requireAutomationPlatformAccess } from "@/lib/growth/automation/growth-automation-platform-access"
import {
  automationApiSafetyPayload,
  automationApprovalApiSafetyPayload,
  automationEnrollmentApiSafetyPayload,
  automationRuntimeExecutionApiSafetyPayload,
  mapAutomationError,
} from "@/lib/growth/automation/growth-automation-route-utils"
import { GROWTH_AUTOMATION_RUNTIME_EXECUTION_QA_MARKER } from "@/lib/growth/automation/growth-automation-runtime-execution-diagnostics"
import { GROWTH_AUTOMATION_BUILDER_QA_MARKER } from "@/lib/growth/automation/growth-automation-types"

export const runtime = "nodejs"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; enrollmentId: string }> },
) {
  const access = await requireAutomationPlatformAccess()
  if (!access.ok) return access.response

  const { id, enrollmentId } = await context.params
  const body = (await request.json().catch(() => ({}))) as {
    approvalId?: string | null
    leadId?: string | null
  }

  try {
    const result = await resumeAutomationAfterApproval(access.admin, {
      flowId: id,
      organizationId: access.organizationId,
      enrollmentId,
      approvalId: body.approvalId,
      leadId: body.leadId,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
    })

    return NextResponse.json({
      ...result,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      approval_qa_marker: GROWTH_AUTOMATION_APPROVAL_QA_MARKER,
      runtime_execution_qa_marker: GROWTH_AUTOMATION_RUNTIME_EXECUTION_QA_MARKER,
      ...automationApiSafetyPayload(),
      ...automationEnrollmentApiSafetyPayload(),
      ...automationRuntimeExecutionApiSafetyPayload(),
      ...automationApprovalApiSafetyPayload(),
    })
  } catch (error) {
    return mapAutomationError(error)
  }
}
