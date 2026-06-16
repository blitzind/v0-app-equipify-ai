import { NextResponse } from "next/server"
import { cancelEnrollment } from "@/lib/growth/automation/growth-automation-enrollment-service"
import { requireAutomationPlatformAccess } from "@/lib/growth/automation/growth-automation-platform-access"
import {
  automationApiSafetyPayload,
  automationEnrollmentApiSafetyPayload,
  mapAutomationError,
} from "@/lib/growth/automation/growth-automation-route-utils"
import { GROWTH_AUTOMATION_ENROLLMENT_QA_MARKER } from "@/lib/growth/automation/growth-automation-enrollment-diagnostics"
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
    enrollmentId?: string
    leadId?: string
    reason?: string
  }

  if (!body.enrollmentId || !body.leadId) {
    return NextResponse.json({ ok: false, error: "enrollment_and_lead_required" }, { status: 400 })
  }

  try {
    const enrollment = await cancelEnrollment(access.admin, {
      flowId: id,
      organizationId: access.organizationId,
      enrollmentId: body.enrollmentId,
      leadId: body.leadId,
      reason: body.reason,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
    })

    return NextResponse.json({
      ok: enrollment.status === "cancelled",
      enrollment,
      qa_marker: GROWTH_AUTOMATION_BUILDER_QA_MARKER,
      enrollment_qa_marker: GROWTH_AUTOMATION_ENROLLMENT_QA_MARKER,
      ...automationApiSafetyPayload(),
      ...automationEnrollmentApiSafetyPayload(),
    })
  } catch (error) {
    return mapAutomationError(error)
  }
}
