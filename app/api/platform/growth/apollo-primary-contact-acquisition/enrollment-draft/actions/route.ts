import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess, logGrowthEngine } from "@/lib/growth/access"
import { createApolloPrimaryContactEnrollmentDraft } from "@/lib/growth/apollo/apollo-primary-contact-enrollment-draft-bridge"

export const runtime = "nodejs"

type EnrollmentDraftActionBody = {
  action?: string
  queueItemId?: string | null
  patternId?: string | null
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const body = (await request.json().catch(() => ({}))) as EnrollmentDraftActionBody
  const action = body.action?.trim()
  const startedMs = Date.now()

  if (action === "create_enrollment_draft") {
    const queueItemId = body.queueItemId?.trim()
    if (!queueItemId) {
      return NextResponse.json(
        { ok: false, error: "queue_item_id_required", message: "queueItemId is required." },
        { status: 400 },
      )
    }

    const result = await createApolloPrimaryContactEnrollmentDraft(access.admin, {
      queue_item_id: queueItemId,
      acting_user_id: access.userId ?? null,
      acting_user_email: access.userEmail ?? null,
      pattern_id: body.patternId ?? null,
    })

    logGrowthEngine("apollo_primary_contact_enrollment_draft_action", {
      queue_item_id: queueItemId.slice(0, 8),
      lead_id: result.growth_lead_id?.slice(0, 8) ?? null,
      enrollment_id: result.enrollment_draft_id?.slice(0, 8) ?? null,
      ok: result.ok,
      duration_ms: Date.now() - startedMs,
      auto_enrollment: false,
      outreach_sent: false,
      enrolled_count: 0,
      outreach_count: 0,
    })

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 })
    }
    return NextResponse.json(result)
  }

  return NextResponse.json(
    {
      ok: false,
      error: "invalid_action",
      message: 'action must be "create_enrollment_draft".',
    },
    { status: 400 },
  )
}
