import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { listBookingRecommendations } from "@/lib/growth/booking-intelligence/booking-events"
import { isGrowthCalendarBookingIntelligenceSchemaReady } from "@/lib/growth/booking-intelligence/schema-health"
import type { GrowthBookingRecommendationStatus } from "@/lib/growth/booking-intelligence/booking-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthCalendarBookingIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const url = new URL(request.url)
  const leadId = url.searchParams.get("leadId") ?? undefined
  const status = url.searchParams.get("status") as GrowthBookingRecommendationStatus | null

  try {
    const recommendations = await listBookingRecommendations(access.admin, {
      leadId,
      status: status ?? undefined,
      limit: 100,
    })
    return NextResponse.json({ ok: true, recommendations })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load booking recommendations." }, { status: 500 })
  }
}
