import { NextResponse } from "next/server"
import { captureIntentPixelEvent, normalizeCollectPayload } from "@/lib/growth/intent-pixel/capture-intent-event"
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
    const payload = normalizeCollectPayload(body)

    if (!payload) {
      return NextResponse.json(
        { ok: false, error: "validation_error", message: "site_key and event_type are required." },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    const admin = createServiceRoleClient()
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "unavailable", message: "Intent pixel collect is temporarily unavailable." },
        { status: 503, headers: CORS_HEADERS },
      )
    }

    const includeHistory = body.include_visit_history === true
    const result = await captureIntentPixelEvent(admin, payload, {
      include_visit_history: includeHistory,
    })

    return NextResponse.json(
      { ok: result.ok, capture: result },
      { status: result.ok ? 200 : 422, headers: CORS_HEADERS },
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { ok: false, error: "capture_failed", message },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
