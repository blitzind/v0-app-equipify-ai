import { NextResponse } from "next/server"
import { z } from "zod"
import { logGrowthEngine, requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { recordGrowthLeadHumanTouch } from "@/lib/growth/first-human-touch"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import { emitGrowthLeadManualTouchTimeline } from "@/lib/growth/timeline-emitter"

export const runtime = "nodejs"

const ManualTouchSchema = z.object({
  note: z.string().trim().max(2000).optional().nullable(),
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

  const rawBody = await request.json().catch(() => ({}))
  const parsed = ManualTouchSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid manual touch payload." }, { status: 400 })
  }

  try {
    const lead = await fetchGrowthLeadById(access.admin, leadId)
    if (!lead) {
      return NextResponse.json({ error: "not_found", message: "Lead not found." }, { status: 404 })
    }

    await recordGrowthLeadHumanTouch(access.admin, leadId)
    await emitGrowthLeadManualTouchTimeline(access.admin, {
      leadId,
      note: parsed.data.note,
      actor: { userId: access.userId, email: access.userEmail },
    })

    const updatedLead = await recomputeGrowthLeadWorkflowSignals(access.admin, leadId)
    if (!updatedLead) {
      return NextResponse.json(
        { error: "update_failed", message: "Could not refresh lead after manual touch." },
        { status: 500 },
      )
    }

    logGrowthEngine("manual_touch_recorded", {
      leadId,
      actorEmail: access.userEmail,
    })

    return NextResponse.json({ ok: true, lead: updatedLead })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "create_failed", message }, { status: 500 })
  }
}
