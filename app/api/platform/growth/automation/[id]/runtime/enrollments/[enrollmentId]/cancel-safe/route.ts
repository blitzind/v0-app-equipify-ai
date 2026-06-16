import { NextResponse } from "next/server"
import { safeCancelAutomationEnrollment } from "@/lib/growth/automation/growth-automation-observability-service"
import { GROWTH_AUTOMATION_OBSERVABILITY_QA_MARKER } from "@/lib/growth/automation/growth-automation-observability-diagnostics"
import { requireAutomationPlatformAccess } from "@/lib/growth/automation/growth-automation-platform-access"
import {
  automationApiSafetyPayload,
  automationObservabilityApiSafetyPayload,
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
    leadId?: string
    reason?: string | null
  }

  if (!body.leadId) {
    return NextResponse.json({ ok: false, error: "lead_id_required" }, { status: 400 })
  }

  try {
    const result = await safeCancelAutomationEnrollment(access.admin, {
      flowId: id,
      organizationId: access.organizationId,
      enrollmentId,
      leadId: body.leadId,
      reason: body.reason,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
    })

    return NextResponse.json({
      ok: result.ok,
      management: result,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      observability_qa_marker: GROWTH_AUTOMATION_OBSERVABILITY_QA_MARKER,
      runtime_execution_qa_marker: GROWTH_AUTOMATION_RUNTIME_EXECUTION_QA_MARKER,
      ...automationApiSafetyPayload(),
      ...automationRuntimeExecutionApiSafetyPayload(),
      ...automationObservabilityApiSafetyPayload(),
    })
  } catch (error) {
    return mapAutomationError(error)
  }
}
