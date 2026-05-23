import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { overrideGrowthOutboundReplyClassification } from "@/lib/growth/outbound/reply-repository"
import { recomputeGrowthLeadWorkflowSignals } from "@/lib/growth/recompute-lead-next-best-action"
import { GROWTH_OUTBOUND_REPLY_CLASSIFICATIONS, GROWTH_OUTBOUND_REPLY_SENTIMENTS } from "@/lib/growth/outbound/types"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z.object({
  classification: z.enum(GROWTH_OUTBOUND_REPLY_CLASSIFICATIONS),
  sentiment: z.enum(GROWTH_OUTBOUND_REPLY_SENTIMENTS).optional(),
})

export async function PATCH(
  request: Request,
  context: { params: Promise<{ replyId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { replyId } = await context.params
  if (!UUID_RE.test(replyId)) {
    return NextResponse.json({ error: "invalid_reply", message: "Invalid reply id." }, { status: 400 })
  }

  const raw = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid classification payload." }, { status: 400 })
  }

  try {
    const reply = await overrideGrowthOutboundReplyClassification(access.admin, replyId, {
      classification: parsed.data.classification,
      sentiment: parsed.data.sentiment ?? "unknown",
      lockedBy: access.userId,
    })
    if (!reply) {
      return NextResponse.json({ error: "not_found", message: "Reply not found." }, { status: 404 })
    }

    await recomputeGrowthLeadWorkflowSignals(access.admin, reply.leadId)
    return NextResponse.json({ ok: true, reply })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "update_failed", message }, { status: 500 })
  }
}
