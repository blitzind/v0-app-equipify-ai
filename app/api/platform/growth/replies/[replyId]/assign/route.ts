import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { reassignGrowthReplyOwner } from "@/lib/growth/outbound/reply-repository"
import { emitReplyAssignedTimeline } from "@/lib/growth/reply-intelligence/reply-intelligence-timeline-emitter"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z.object({
  ownerUserId: z.string().uuid().nullable(),
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

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid assignment payload." }, { status: 400 })
  }

  try {
    const reply = await reassignGrowthReplyOwner(access.admin, replyId, parsed.data.ownerUserId)
    if (!reply) {
      return NextResponse.json({ error: "not_found", message: "Reply not found." }, { status: 404 })
    }
    await emitReplyAssignedTimeline(access.admin, {
      leadId: reply.leadId,
      replyId: reply.id,
      ownerUserId: parsed.data.ownerUserId,
    })
    return NextResponse.json({ ok: true, reply })
  } catch {
    return NextResponse.json({ error: "update_failed", message: "Could not reassign reply owner." }, { status: 500 })
  }
}
