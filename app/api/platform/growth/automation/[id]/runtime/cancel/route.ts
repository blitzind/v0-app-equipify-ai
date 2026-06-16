import { NextResponse } from "next/server"
import { cancelAutomationRuntimeExecution } from "@/lib/growth/automation/growth-automation-runtime-orchestrator"
import { requireAutomationPlatformAccess } from "@/lib/growth/automation/growth-automation-platform-access"
import {
  automationApiSafetyPayload,
  automationEnrollmentApiSafetyPayload,
  automationRuntimeExecutionApiSafetyPayload,
  mapAutomationError,
} from "@/lib/growth/automation/growth-automation-route-utils"
import { GROWTH_AUTOMATION_RUNTIME_EXECUTION_QA_MARKER } from "@/lib/growth/automation/growth-automation-runtime-execution-diagnostics"
import { GROWTH_AUTOMATION_BUILDER_QA_MARKER } from "@/lib/growth/automation/growth-automation-types"

export const runtime = "nodejs"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireAutomationPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const body = (await request.json().catch(() => ({}))) as {
    enrollmentId?: string
    leadId?: string
    reason?: string
  }

  if (!body.enrollmentId || !body.leadId) {
    return NextResponse.json({ ok: false, error: "enrollment_id_and_lead_id_required" }, { status: 400 })
  }

  try {
    const execution = await cancelAutomationRuntimeExecution(access.admin, {
      flowId: id,
      organizationId: access.organizationId,
      enrollmentId: body.enrollmentId,
      leadId: body.leadId,
      reason: body.reason,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
    })

    return NextResponse.json({
      ok: execution.status === "cancelled",
      execution,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      runtime_execution_qa_marker: GROWTH_AUTOMATION_RUNTIME_EXECUTION_QA_MARKER,
      ...automationApiSafetyPayload(),
      ...automationEnrollmentApiSafetyPayload(),
      ...automationRuntimeExecutionApiSafetyPayload(),
    })
  } catch (error) {
    return mapAutomationError(error)
  }
}
