import { NextResponse } from "next/server"
import { findMatchingAutomationRuntimes } from "@/lib/growth/automation/growth-automation-enrollment-service"
import { requireAutomationPlatformAccess } from "@/lib/growth/automation/growth-automation-platform-access"
import {
  automationApiSafetyPayload,
  automationEnrollmentApiSafetyPayload,
  mapAutomationError,
} from "@/lib/growth/automation/growth-automation-route-utils"
import { GROWTH_AUTOMATION_ENROLLMENT_QA_MARKER } from "@/lib/growth/automation/growth-automation-enrollment-diagnostics"
import { GROWTH_AUTOMATION_BUILDER_QA_MARKER } from "@/lib/growth/automation/growth-automation-types"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const access = await requireAutomationPlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as {
    triggerSource?: string
    triggerEvent?: string | null
    triggerPayload?: Record<string, unknown>
    leadId?: string | null
  }

  try {
    const match = await findMatchingAutomationRuntimes(access.admin, {
      organizationId: access.organizationId,
      triggerSource: body.triggerSource ?? "manual.enrollment",
      triggerEvent: body.triggerEvent,
      triggerPayload: body.triggerPayload,
      leadId: body.leadId,
    })

    return NextResponse.json({
      ok: match.ok,
      match,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      enrollment_qa_marker: GROWTH_AUTOMATION_ENROLLMENT_QA_MARKER,
      ...automationApiSafetyPayload(),
      ...automationEnrollmentApiSafetyPayload(),
    })
  } catch (error) {
    return mapAutomationError(error)
  }
}
