import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { GROWTH_LEAD_CALL_DISPOSITIONS } from "@/lib/growth/call-types"
import { approveGrowthCallCopilotDisposition } from "@/lib/growth/run-call-copilot-summary"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z.object({
  disposition: z.enum(GROWTH_LEAD_CALL_DISPOSITIONS).optional(),
  note: z.string().trim().max(4000).nullable().optional(),
  followUpAt: z.string().datetime().nullable().optional(),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ leadId: string; sessionId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId, sessionId } = await context.params
  if (!UUID_RE.test(leadId) || !UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: "invalid_id", message: "Invalid id." }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid disposition payload." }, { status: 400 })
  }

  try {
    const session = await approveGrowthCallCopilotDisposition(access.admin, {
      leadId,
      sessionId,
      disposition: parsed.data.disposition,
      note: parsed.data.note,
      followUpAt: parsed.data.followUpAt,
      approvedBy: access.userId,
      actorEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, session })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const status =
      message === "not_found"
        ? 404
        : message === "follow_up_at_required"
          ? 400
          : message === "invalid_status" ||
              message === "already_approved" ||
              message === "summary_not_approved" ||
              message === "disposition_required"
            ? 409
            : 500
    return NextResponse.json({ error: message, message }, { status })
  }
}
