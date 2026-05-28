import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { runOutreachPreflightForQueueItem } from "@/lib/growth/outreach/outreach-queue-recovery"

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

  try {
    const result = await runOutreachPreflightForQueueItem(access.admin, queueId)
    return NextResponse.json({ ok: true, preflight: result })
  } catch (e) {
    const message = e instanceof Error ? e.message : "preflight_failed"
    const status = message === "not_found" ? 404 : 400
    return NextResponse.json({ error: message, message: "Preflight failed." }, { status })
  }
}
