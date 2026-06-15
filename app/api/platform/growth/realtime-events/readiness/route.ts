import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { buildRealtimeEventsReadinessPayload } from "@/lib/growth/realtime-events/realtime-events-route-gates"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  return NextResponse.json({
    ok: true,
    ...buildRealtimeEventsReadinessPayload(),
  })
}
