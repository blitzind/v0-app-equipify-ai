import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { cancelGrowthOutreachQueueItem } from "@/lib/growth/outreach/run-outreach-queue"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z.object({ reason: z.string().max(500).nullable().optional() })

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

  try {
    const item = await cancelGrowthOutreachQueueItem(access.admin, {
      queueId,
      cancelledBy: access.userId,
      actingUserEmail: access.userEmail,
      reason: parsed.success ? parsed.data.reason : null,
    })
    return NextResponse.json({ ok: true, item })
  } catch (e) {
    const message = e instanceof Error ? e.message : "cancel_failed"
    const status = message === "not_found" ? 404 : message === "invalid_status" ? 409 : 400
    return NextResponse.json({ error: message, message: "Could not cancel queue item." }, { status })
  }
}
