import { NextResponse } from "next/server"
import { getAutomationRuntimeHealth } from "@/lib/growth/automation/growth-automation-observability-service"
import { GROWTH_AUTOMATION_OBSERVABILITY_QA_MARKER } from "@/lib/growth/automation/growth-automation-observability-diagnostics"
import { requireAutomationPlatformAccess } from "@/lib/growth/automation/growth-automation-platform-access"
import {
  automationApiSafetyPayload,
  automationObservabilityApiSafetyPayload,
  mapAutomationError,
} from "@/lib/growth/automation/growth-automation-route-utils"
import { GROWTH_AUTOMATION_BUILDER_QA_MARKER } from "@/lib/growth/automation/growth-automation-types"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireAutomationPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params

  try {
    const health = await getAutomationRuntimeHealth(access.admin, {
      flowId: id,
      organizationId: access.organizationId,
    })

    return NextResponse.json({
      ok: true,
      health,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      observability_qa_marker: GROWTH_AUTOMATION_OBSERVABILITY_QA_MARKER,
      ...automationApiSafetyPayload(),
      ...automationObservabilityApiSafetyPayload(),
    })
  } catch (error) {
    return mapAutomationError(error)
  }
}
