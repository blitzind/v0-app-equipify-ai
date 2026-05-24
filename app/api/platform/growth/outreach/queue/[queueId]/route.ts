import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  fetchGrowthOutreachQueueItem,
  listGrowthOutreachQueueEvents,
} from "@/lib/growth/outreach/outreach-queue-repository"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  context: { params: Promise<{ queueId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { queueId } = await context.params
  if (!UUID_RE.test(queueId)) {
    return NextResponse.json({ error: "invalid_queue", message: "Invalid queue id." }, { status: 400 })
  }

  const item = await fetchGrowthOutreachQueueItem(access.admin, queueId)
  if (!item) return NextResponse.json({ error: "not_found", message: "Queue item not found." }, { status: 404 })

  const events = await listGrowthOutreachQueueEvents(access.admin, queueId)
  return NextResponse.json({ ok: true, item, events })
}
