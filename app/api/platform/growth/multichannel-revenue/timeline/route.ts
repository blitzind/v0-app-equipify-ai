import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchMultiChannelActivityTimeline } from "@/lib/growth/revenue-intelligence/multi-channel-activity-timeline"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const leadId = z.string().uuid().parse(url.searchParams.get("leadId"))
  const limit = z.coerce.number().int().min(1).max(200).catch(100).parse(url.searchParams.get("limit") ?? "100")

  try {
    const timeline = await fetchMultiChannelActivityTimeline(access.admin, { leadId, limit })
    return NextResponse.json({ ok: true, timeline })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load multi-channel timeline." }, { status: 500 })
  }
}
