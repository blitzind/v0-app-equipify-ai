import { NextResponse } from "next/server"
import { GROWTH_BOOKING_SLOTS_API_QA_MARKER } from "@/lib/growth/booking/booking-page-defaults"
import { fetchPublicBookingSlots } from "@/lib/growth/booking/public-booking-slots"
import { createServiceRoleClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PUBLIC_BOOKING_SLOTS_ROUTE_META = "public-booking-slots-v1" as const

function jsonResponse(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params
  const normalized = String(slug ?? "").trim().toLowerCase()
  if (!normalized) {
    return jsonResponse(
      {
        ok: false,
        qaMarker: GROWTH_BOOKING_SLOTS_API_QA_MARKER,
        meta: { route: PUBLIC_BOOKING_SLOTS_ROUTE_META },
        error: "not_found",
        message: "Booking page not found.",
      },
      404,
    )
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return jsonResponse(
      {
        ok: false,
        qaMarker: GROWTH_BOOKING_SLOTS_API_QA_MARKER,
        meta: { route: PUBLIC_BOOKING_SLOTS_ROUTE_META },
        error: "unavailable",
        message: "Booking is temporarily unavailable.",
      },
      503,
    )
  }

  const url = new URL(request.url)
  const month = url.searchParams.get("month")

  try {
    const result = await fetchPublicBookingSlots(admin, normalized, { month })
    if (!result.ok) {
      const status =
        result.code === "page_disabled" || result.code === "not_found"
          ? 404
          : result.code === "invalid_month"
            ? 400
            : 503
      return jsonResponse(
        {
          ok: false,
          qaMarker: GROWTH_BOOKING_SLOTS_API_QA_MARKER,
          meta: { route: PUBLIC_BOOKING_SLOTS_ROUTE_META },
          error: result.code,
          message: result.message,
        },
        status,
      )
    }

    const body: Record<string, unknown> = {
      ok: true,
      qaMarker: GROWTH_BOOKING_SLOTS_API_QA_MARKER,
      meta: { route: PUBLIC_BOOKING_SLOTS_ROUTE_META },
      slots: result.slots,
      availableDateKeys: result.availableDateKeys,
      timezone: result.timezone,
      timezoneMode: result.timezoneMode,
      schedulingHorizonDays: result.schedulingHorizonDays,
      horizonEndAt: result.horizonEndAt,
      monthKey: result.monthKey,
    }
    if (result.warning) body.warning = result.warning
    if (result.diagnostics) body.diagnostics = result.diagnostics

    return jsonResponse(body, 200)
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not load booking availability."
    return jsonResponse(
      {
        ok: false,
        qaMarker: GROWTH_BOOKING_SLOTS_API_QA_MARKER,
        meta: { route: PUBLIC_BOOKING_SLOTS_ROUTE_META },
        error: "slots_fetch_failed",
        message,
      },
      503,
    )
  }
}
