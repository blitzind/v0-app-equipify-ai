import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthRealtimeEvents } from "@/lib/growth/realtime-events/realtime-events-service"
import { REALTIME_EVENT_FILTERS } from "@/lib/growth/realtime-events/realtime-events-types"

export const runtime = "nodejs"
export const maxDuration = 120

const QuerySchema = z.object({
  filter: z.enum(REALTIME_EVENT_FILTERS).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_query" }, { status: 400 })
  }

  try {
    const feed = await fetchGrowthRealtimeEvents(access.admin, parsed.data)
    return NextResponse.json({
      ok: true,
      ...feed,
      outreach_enabled: false,
      enrollment_enabled: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "realtime_events_failed", message }, { status: 500 })
  }
}
