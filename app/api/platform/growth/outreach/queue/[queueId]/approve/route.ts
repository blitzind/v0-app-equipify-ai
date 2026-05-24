import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { approveGrowthOutreachQueueItem } from "@/lib/growth/outreach/run-outreach-queue"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z.object({
  approvalNote: z.string().max(2000).nullable().optional(),
  sendNow: z.boolean().optional(),
  scheduledFor: z.string().datetime().nullable().optional(),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ queueId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { queueId } = await context.params
  if (!UUID_RE.test(queueId)) {
    return NextResponse.json({ error: "invalid_queue", message: "Invalid queue id." }, { status: 400 })
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid approval payload." }, { status: 400 })
  }

  try {
    const item = await approveGrowthOutreachQueueItem(access.admin, {
      queueId,
      approvedBy: access.userId,
      actingUserEmail: access.userEmail,
      approvalNote: parsed.data.approvalNote,
      sendNow: parsed.data.sendNow,
      scheduledFor: parsed.data.scheduledFor,
    })
    return NextResponse.json({ ok: true, item })
  } catch (e) {
    const message = e instanceof Error ? e.message : "approve_failed"
    const status =
      message === "not_found" ? 404 : ["invalid_status", "generation_not_approved", "preflight_blocked"].includes(message) ? 409 : 400
    return NextResponse.json({ error: message, message: "Could not approve outreach queue item." }, { status })
  }
}
