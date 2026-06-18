import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { publishGrowthRealtimeEvent } from "@/lib/growth/realtime-events/realtime-events-service"
import { REALTIME_EVENT_SOURCES } from "@/lib/growth/realtime-events/realtime-events-types"
import { guardGrowthFeatureApiRoute } from "@/lib/growth/runtime/growth-feature-api-guards"

export const runtime = "nodejs"
export const maxDuration = 120

const BodySchema = z.object({
  event_type: z.string().min(1).max(120),
  source: z.enum(REALTIME_EVENT_SOURCES).optional(),
  payload: z.record(z.unknown()).optional(),
  lead_id: z.string().max(120).optional().nullable(),
})

export async function POST(request: Request) {
  const coldGuard = await guardGrowthFeatureApiRoute("realtimeEventBus", request)
  if (coldGuard) return coldGuard
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 })
  }

  try {
    const result = await publishGrowthRealtimeEvent(access.admin, {
      ...parsed.data,
      operator_id: access.userId,
    })
    return NextResponse.json({
      ok: result.ok,
      event: result.event ?? null,
      error: result.error ?? null,
      outreach_execution: false,
      enrollment_execution: false,
      autonomous_execution_enabled: false,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: "realtime_event_publish_failed", message }, { status: 500 })
  }
}
