import { NextResponse } from "next/server"
import { getAutomationApprovalAnalytics } from "@/lib/growth/automation/growth-automation-analytics-service"
import { GROWTH_AUTOMATION_ANALYTICS_QA_MARKER } from "@/lib/growth/automation/growth-automation-analytics-diagnostics"
import { requireAutomationPlatformAccess } from "@/lib/growth/automation/growth-automation-platform-access"
import {
  automationAnalyticsApiSafetyPayload,
  automationApiSafetyPayload,
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
    const approvals = await getAutomationApprovalAnalytics(access.admin, {
      flowId: id,
      organizationId: access.organizationId,
    })

    return NextResponse.json({
      ok: true,
      ...approvals,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      analytics_qa_marker: GROWTH_AUTOMATION_ANALYTICS_QA_MARKER,
      ...automationApiSafetyPayload(),
      ...automationAnalyticsApiSafetyPayload(),
    })
  } catch (error) {
    return mapAutomationError(error)
  }
}
