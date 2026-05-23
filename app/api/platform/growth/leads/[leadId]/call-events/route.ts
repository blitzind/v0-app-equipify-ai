import { NextResponse } from "next/server"
import { z } from "zod"
import { logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { recordGrowthLeadCallEvent } from "@/lib/growth/call-events-repository"
import { GROWTH_LEAD_CALL_DISPOSITIONS } from "@/lib/growth/call-types"

export const runtime = "nodejs"

const CreateCallEventSchema = z
  .object({
    disposition: z.enum(GROWTH_LEAD_CALL_DISPOSITIONS),
    note: z.string().trim().max(4000).optional().nullable(),
    followUpAt: z.string().datetime({ offset: true }).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.disposition === "follow_up_later" && !value.followUpAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "follow_up_at_required",
        path: ["followUpAt"],
      })
    }
  })

export async function POST(
  request: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { leadId } = await context.params
  if (!z.string().uuid().safeParse(leadId).success) {
    return NextResponse.json({ error: "invalid_lead_id", message: "Lead id must be a UUID." }, { status: 400 })
  }

  const rawBody = await request.json().catch(() => null)
  const parsed = CreateCallEventSchema.safeParse(rawBody)
  if (!parsed.success) {
    const followUpRequired = parsed.error.issues.some((issue) => issue.message === "follow_up_at_required")
    return NextResponse.json(
      {
        error: followUpRequired ? "follow_up_at_required" : "invalid_body",
        message: followUpRequired ? "Follow-up date is required for follow up later." : "Invalid call event payload.",
      },
      { status: 400 },
    )
  }

  try {
    const result = await recordGrowthLeadCallEvent(access.admin, {
      leadId,
      disposition: parsed.data.disposition,
      note: parsed.data.note,
      followUpAt: parsed.data.followUpAt,
      createdBy: access.userId,
    })

    logGrowthEngine("call_event_api_success", {
      leadId,
      eventId: result.event.id,
      disposition: parsed.data.disposition,
      actorEmail: access.userEmail,
    })

    return NextResponse.json({ ok: true, event: result.event, lead: result.lead }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (message === "not_found") {
      return NextResponse.json({ error: "not_found", message: "Lead not found." }, { status: 404 })
    }
    if (message === "follow_up_at_required") {
      return NextResponse.json(
        { error: "follow_up_at_required", message: "Follow-up date is required for follow up later." },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: "create_failed", message }, { status: 500 })
  }
}
