import { NextResponse } from "next/server"
import { getLeadAutomationEnrollments } from "@/lib/growth/automation/growth-automation-enrollment-service"
import { requireAutomationPlatformAccess } from "@/lib/growth/automation/growth-automation-platform-access"
import {
  automationApiSafetyPayload,
  automationEnrollmentApiSafetyPayload,
  mapAutomationError,
} from "@/lib/growth/automation/growth-automation-route-utils"
import { GROWTH_AUTOMATION_ENROLLMENT_QA_MARKER } from "@/lib/growth/automation/growth-automation-enrollment-diagnostics"
import { GROWTH_AUTOMATION_BUILDER_QA_MARKER } from "@/lib/growth/automation/growth-automation-types"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  const access = await requireAutomationPlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params

  try {
    const enrollments = await getLeadAutomationEnrollments(access.admin, {
      leadId,
      organizationId: access.organizationId,
    })

    return NextResponse.json({
      ok: true,
      enrollments,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      enrollment_qa_marker: GROWTH_AUTOMATION_ENROLLMENT_QA_MARKER,
      ...automationApiSafetyPayload(),
      ...automationEnrollmentApiSafetyPayload(),
    })
  } catch (error) {
    return mapAutomationError(error)
  }
}
