import { NextResponse } from "next/server"
import { captureIntentPixelEvent, normalizeCollectPayload } from "@/lib/growth/intent-pixel/capture-intent-event"
import {
  GROWTH_INTENT_PIXEL_422_DEBUG_QA_MARKER,
  logIntentPixelCollectRejection,
} from "@/lib/growth/intent-pixel/intent-pixel-collect-debug"
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
        {
          ok: false,
          error: "validation_error",
          rejection_code: "validation_error",
          reason: "site_key and event_type are required.",
          message: "site_key and event_type are required.",
          qa_marker: GROWTH_INTENT_PIXEL_422_DEBUG_QA_MARKER,
        },
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

    if (!result.ok && result.rejection) {
      logIntentPixelCollectRejection(result.rejection)
      return NextResponse.json(
        {
          ok: false,
          error: "rejected",
          rejection_code: result.rejection.rejection_code,
          reason: result.reason,
          message: result.reason,
          qa_marker: GROWTH_INTENT_PIXEL_422_DEBUG_QA_MARKER,
          capture: {
            accepted: false,
            consent_status: result.consent_status,
            tracking_mode: result.tracking_mode,
            rejection_code: result.rejection_code,
          },
          diagnostics: result.rejection,
        },
        { status: 422, headers: CORS_HEADERS },
      )
    }

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
