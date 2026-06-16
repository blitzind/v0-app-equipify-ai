import { NextResponse } from "next/server"
import { getAutomationRuntimeStatus } from "@/lib/growth/automation/growth-automation-runtime-publisher-service"
import { requireAutomationPlatformAccess } from "@/lib/growth/automation/growth-automation-platform-access"
import {
  automationApiSafetyPayload,
  automationRuntimePublisherApiSafetyPayload,
  mapAutomationError,
} from "@/lib/growth/automation/growth-automation-route-utils"
import { GROWTH_AUTOMATION_RUNTIME_PUBLISHER_QA_MARKER } from "@/lib/growth/automation/growth-automation-runtime-publisher-diagnostics"
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
    const status = await getAutomationRuntimeStatus(access.admin, {
      flowId: id,
      organizationId: access.organizationId,
    })

    return NextResponse.json({
      ok: true,
      status,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      runtime_publisher_qa_marker: GROWTH_AUTOMATION_RUNTIME_PUBLISHER_QA_MARKER,
      ...automationApiSafetyPayload(),
      ...automationRuntimePublisherApiSafetyPayload(),
    })
  } catch (error) {
    return mapAutomationError(error)
  }
}
