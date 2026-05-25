import { NextResponse } from "next/server"
import { publicBookingErrorMessage } from "@/lib/growth/booking/booking-public-errors"
import {
  GROWTH_BOOKING_SUBMIT_API_QA_MARKER,
  PUBLIC_BOOKING_SUBMIT_ROUTE_META,
  parsePublicBookingSubmitPayload,
} from "@/lib/growth/booking/booking-submit-payload"
import { submitPublicBooking } from "@/lib/growth/booking/booking-service"
import { createServiceRoleClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function jsonResponse(body: Record<string, unknown>, status: number) {
  return NextResponse.json(
    {
      qaMarker: GROWTH_BOOKING_SUBMIT_API_QA_MARKER,
      meta: { route: PUBLIC_BOOKING_SUBMIT_ROUTE_META },
      ...body,
    },
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  )
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params
    const normalized = String(slug ?? "").trim().toLowerCase()
    if (!normalized) {
      return jsonResponse(
        { ok: false, error: "not_found", message: publicBookingErrorMessage("page_disabled") },
        404,
      )
    }

    const rawBody = await request.json().catch(() => null)
    const parsed = parsePublicBookingSubmitPayload(rawBody)
    if (!parsed.ok) {
      return jsonResponse(
        { ok: false, error: parsed.code, message: publicBookingErrorMessage("invalid_form") },
        400,
      )
    }

    const admin = createServiceRoleClient()
    if (!admin) {
      return jsonResponse(
        { ok: false, error: "unavailable", message: publicBookingErrorMessage("calendar_unavailable") },
        503,
      )
    }

    const origin = new URL(request.url).origin
    const result = await submitPublicBooking(admin, {
      slug: normalized,
      ...parsed.data,
      appOrigin: origin,
    })

    if (!result.ok) {
      const status =
        result.code === "page_disabled"
          ? 404
          : result.code === "slot_unavailable"
            ? 409
            : result.code === "invalid_form"
              ? 400
              : 503
      return jsonResponse({ ok: false, error: result.code, message: result.message }, status)
    }

    return jsonResponse({ ok: true, ...result }, 201)
  } catch {
    return jsonResponse(
      { ok: false, error: "booking_failed", message: publicBookingErrorMessage("booking_failed") },
      500,
    )
  }
}
