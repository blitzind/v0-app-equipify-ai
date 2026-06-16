import { NextResponse } from "next/server"
import { getAutomationRuntimeExecutionStatus } from "@/lib/growth/automation/growth-automation-runtime-orchestrator"
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; enrollmentId: string }> },
) {
  const access = await requireAutomationPlatformAccess()
  if (!access.ok) return access.response

  const { id, enrollmentId } = await context.params

  try {
    const execution = await getAutomationRuntimeExecutionStatus(access.admin, {
      flowId: id,
      organizationId: access.organizationId,
      enrollmentId,
    })

    return NextResponse.json({
      ok: true,
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
