import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listGrowthProviderCapabilityHistory } from "@/lib/growth/outbound/capability-history-repository"
import { listGrowthPlatformTimelineEvents } from "@/lib/growth/outbound/platform-timeline-repository"

export const runtime = "nodejs"

export async function GET(
  request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { connectionId } = await context.params
  if (!z.string().uuid().safeParse(connectionId).success) {
    return NextResponse.json({ error: "invalid_connection_id", message: "Connection id must be a UUID." }, { status: 400 })
  }

  const url = new URL(request.url)
  const includeHistory = url.searchParams.get("includeHistory") === "true"

  try {
    const events = await listGrowthPlatformTimelineEvents(access.admin, { connectionId, limit: 50 })
    const capabilityHistory = includeHistory
      ? await listGrowthProviderCapabilityHistory(access.admin, connectionId, 20)
      : []
    return NextResponse.json({ ok: true, events, capabilityHistory })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "timeline_failed", message }, { status: 500 })
  }
}
