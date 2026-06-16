import { NextResponse } from "next/server"
import { resumeAutomationRuntime } from "@/lib/growth/automation/growth-automation-observability-service"
import { GROWTH_AUTOMATION_OBSERVABILITY_QA_MARKER } from "@/lib/growth/automation/growth-automation-observability-diagnostics"
import { requireAutomationPlatformAccess } from "@/lib/growth/automation/growth-automation-platform-access"
import {
  automationApiSafetyPayload,
  automationObservabilityApiSafetyPayload,
  automationRuntimePublisherApiSafetyPayload,
  mapAutomationError,
} from "@/lib/growth/automation/growth-automation-route-utils"
import { GROWTH_AUTOMATION_RUNTIME_PUBLISHER_QA_MARKER } from "@/lib/growth/automation/growth-automation-runtime-publisher-diagnostics"
import { GROWTH_AUTOMATION_BUILDER_QA_MARKER } from "@/lib/growth/automation/growth-automation-types"

export const runtime = "nodejs"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireAutomationPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const body = (await request.json().catch(() => ({}))) as { clearKillSwitch?: boolean }

  try {
    const result = await resumeAutomationRuntime(access.admin, {
      flowId: id,
      organizationId: access.organizationId,
      clearKillSwitch: body.clearKillSwitch ?? true,
      actingUserEmail: access.userEmail,
    })

    return NextResponse.json({
      ok: result.ok,
      management: result,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      observability_qa_marker: GROWTH_AUTOMATION_OBSERVABILITY_QA_MARKER,
      runtime_publisher_qa_marker: GROWTH_AUTOMATION_RUNTIME_PUBLISHER_QA_MARKER,
      ...automationApiSafetyPayload(),
      ...automationRuntimePublisherApiSafetyPayload(),
      ...automationObservabilityApiSafetyPayload(),
    })
  } catch (error) {
    return mapAutomationError(error)
  }
}
