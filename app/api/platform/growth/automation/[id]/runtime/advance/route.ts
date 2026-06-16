import { NextResponse } from "next/server"
import { advanceAutomationEnrollment } from "@/lib/growth/automation/growth-automation-runtime-orchestrator"
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
    leadId?: string | null
  }

  if (!body.enrollmentId) {
    return NextResponse.json({ ok: false, error: "enrollment_id_required" }, { status: 400 })
  }

  try {
    const execution = await advanceAutomationEnrollment(access.admin, {
      flowId: id,
      organizationId: access.organizationId,
      enrollmentId: body.enrollmentId,
      leadId: body.leadId,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
    })

    return NextResponse.json({
      ok: execution.status === "advanced" || execution.status === "completed",
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
