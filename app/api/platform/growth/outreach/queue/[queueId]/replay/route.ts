import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { replayGrowthOutreachQueueItem } from "@/lib/growth/outreach/outreach-queue-recovery"
import { fetchGrowthOutreachQueueItem } from "@/lib/growth/outreach/outreach-queue-repository"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(
  _request: Request,
  context: { params: Promise<{ queueId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { queueId } = await context.params
  if (!UUID_RE.test(queueId)) {
    return NextResponse.json({ error: "invalid_queue", message: "Invalid queue id." }, { status: 400 })
  }

  const existing = await fetchGrowthOutreachQueueItem(access.admin, queueId)
  if (!existing) return NextResponse.json({ error: "not_found", message: "Queue item not found." }, { status: 404 })

  try {
    const item = await replayGrowthOutreachQueueItem(access.admin, {
      queueId,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, item })
  } catch (e) {
    const message = e instanceof Error ? e.message : "replay_failed"
    const status =
      message === "not_retry_eligible" || message === "retry_limit_exceeded" || message === "approval_required"
        ? 409
        : 400
    return NextResponse.json({ error: message, message: "Replay failed." }, { status })
  }
}
