import { NextResponse } from "next/server"
import { setAutomationRuntimeKillSwitch } from "@/lib/growth/automation/growth-automation-observability-service"
import { GROWTH_AUTOMATION_OBSERVABILITY_QA_MARKER } from "@/lib/growth/automation/growth-automation-observability-diagnostics"
import { requireAutomationPlatformAccess } from "@/lib/growth/automation/growth-automation-platform-access"
import {
  automationApiSafetyPayload,
  automationObservabilityApiSafetyPayload,
  mapAutomationError,
} from "@/lib/growth/automation/growth-automation-route-utils"
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
    enabled?: boolean
    reason?: string | null
  }

  try {
    const result = await setAutomationRuntimeKillSwitch(access.admin, {
      flowId: id,
      organizationId: access.organizationId,
      enabled: body.enabled ?? true,
      reason: body.reason,
      actingUserEmail: access.userEmail,
    })

    return NextResponse.json({
      ok: result.ok,
      management: result,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      observability_qa_marker: GROWTH_AUTOMATION_OBSERVABILITY_QA_MARKER,
      ...automationApiSafetyPayload(),
      ...automationObservabilityApiSafetyPayload(),
    })
  } catch (error) {
    return mapAutomationError(error)
  }
}
