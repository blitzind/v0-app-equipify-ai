import { NextResponse } from "next/server"
import { createDraftFromPublishedVersion } from "@/lib/growth/automation/growth-automation-publish-service"
import { requireAutomationPlatformAccess } from "@/lib/growth/automation/growth-automation-platform-access"
import {
  automationApiSafetyPayload,
  automationPublishApiSafetyPayload,
  mapAutomationError,
} from "@/lib/growth/automation/growth-automation-route-utils"
import { GROWTH_AUTOMATION_PUBLISH_QA_MARKER } from "@/lib/growth/automation/growth-automation-publish-types"
import { GROWTH_AUTOMATION_BUILDER_QA_MARKER } from "@/lib/growth/automation/growth-automation-types"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireAutomationPlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params

  try {
    const result = await createDraftFromPublishedVersion(access.admin, {
      flowId: id,
      organizationId: access.organizationId,
    })

    return NextResponse.json({
      ok: true,
      flow: result.flow,
      version: result.version,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      publish_qa_marker: GROWTH_AUTOMATION_PUBLISH_QA_MARKER,
      ...automationApiSafetyPayload(),
      ...automationPublishApiSafetyPayload(),
    })
  } catch (error) {
    return mapAutomationError(error)
  }
}
