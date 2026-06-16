import { NextResponse } from "next/server"
import { enrollLeadIntoAutomationRuntime } from "@/lib/growth/automation/growth-automation-enrollment-service"
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
    leadId?: string
    triggerSource?: string
    triggerEvent?: string | null
    triggerPayload?: Record<string, unknown>
    entryReason?: string
    allowReEnrollmentOverride?: boolean
  }

  if (!body.leadId) {
    return NextResponse.json({ ok: false, error: "lead_id_required" }, { status: 400 })
  }

  try {
    const enrollment = await enrollLeadIntoAutomationRuntime(access.admin, {
      flowId: id,
      organizationId: access.organizationId,
      leadId: body.leadId,
      triggerSource: body.triggerSource,
      triggerEvent: body.triggerEvent,
      triggerPayload: body.triggerPayload,
      entryReason: body.entryReason,
      allowReEnrollmentOverride: body.allowReEnrollmentOverride,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
    })

    return NextResponse.json({
      ok: enrollment.status === "enrolled",
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
