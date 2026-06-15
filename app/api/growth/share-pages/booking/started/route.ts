import { NextResponse } from "next/server"
import { bridgeSharePageBookingStarted } from "@/lib/growth/share-pages/share-page-booking-bridge"
import { parseSharePageBookingAttributionFromRecord } from "@/lib/growth/share-pages/share-page-booking-attribution"
import { createServiceRoleClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const attribution = parseSharePageBookingAttributionFromRecord(body.attribution ?? body)
    if (!attribution) {
      return NextResponse.json(
        { ok: false, error: "validation_error", message: "Valid share page booking attribution is required." },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    const admin = createServiceRoleClient()
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "unavailable", message: "Booking attribution is temporarily unavailable." },
        { status: 503, headers: CORS_HEADERS },
      )
    }

    const result = await bridgeSharePageBookingStarted(admin, { attribution })
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.reason ?? "rejected" },
        { status: result.reason === "share_page_not_eligible" ? 403 : 422, headers: CORS_HEADERS },
      )
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: "capture_failed", message }, { status: 500, headers: CORS_HEADERS })
  }
}
