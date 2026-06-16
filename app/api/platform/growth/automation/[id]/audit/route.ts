import { NextResponse } from "next/server"
import { getAutomationAuditTimeline } from "@/lib/growth/automation/growth-automation-audit-service"
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
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireAutomationPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  const url = new URL(request.url)
  const limitParam = url.searchParams.get("limit")
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 100

  try {
    const audit = await getAutomationAuditTimeline(access.admin, {
      flowId: id,
      organizationId: access.organizationId,
      limit: Number.isFinite(limit) ? limit : 100,
    })

    return NextResponse.json({
      ok: true,
      audit,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      analytics_qa_marker: GROWTH_AUTOMATION_ANALYTICS_QA_MARKER,
      ...automationApiSafetyPayload(),
      ...automationAnalyticsApiSafetyPayload(),
    })
  } catch (error) {
    return mapAutomationError(error)
  }
}
