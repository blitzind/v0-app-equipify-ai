import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthOutreachQueueItem } from "@/lib/growth/outreach/outreach-queue-repository"
import { executeGrowthOutreachQueueItem } from "@/lib/growth/outreach/execute-outreach"

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
  if (!["approved", "scheduled"].includes(existing.status)) {
    return NextResponse.json({ error: "invalid_status", message: "Item is not approved for execution." }, { status: 409 })
  }

  try {
    const item = await executeGrowthOutreachQueueItem(access.admin, {
      queueItem: existing,
      actingUserId: access.userId,
      actingUserEmail: access.userEmail,
    })
    return NextResponse.json({ ok: true, item })
  } catch (e) {
    const message = e instanceof Error ? e.message : "execute_failed"
    const status = ["validation_failed", "execution_failed", "preflight_blocked"].includes(message) ? 409 : 400
    return NextResponse.json({ error: message, message: "Execution failed." }, { status })
  }
}
