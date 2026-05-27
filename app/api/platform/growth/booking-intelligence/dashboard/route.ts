import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { fetchGrowthBookingIntelligenceDashboard } from "@/lib/growth/booking-intelligence/dashboard"
import { isGrowthCalendarBookingIntelligenceSchemaReady } from "@/lib/growth/booking-intelligence/schema-health"
import { GROWTH_CALENDAR_BOOKING_INTELLIGENCE_PRIVACY_NOTE } from "@/lib/growth/booking-intelligence/booking-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthCalendarBookingIntelligenceSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete" }, { status: 503 })
  }

  const leadId = new URL(request.url).searchParams.get("leadId") ?? undefined
  try {
    const dashboard = await fetchGrowthBookingIntelligenceDashboard(access.admin, { leadId: leadId ?? undefined })
    return NextResponse.json({
      ok: true,
      dashboard,
      privacy_note: GROWTH_CALENDAR_BOOKING_INTELLIGENCE_PRIVACY_NOTE,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
