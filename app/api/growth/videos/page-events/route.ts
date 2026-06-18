import { NextResponse } from "next/server"
import { growthVideoPageEventSchema } from "@/lib/growth/videos/growth-video-api-schema"
import {
  createGrowthVideoPageEventService,
  growthVideoPageEventSafetyPayload,
} from "@/lib/growth/videos/growth-video-page-event-service"
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
  const parsed = growthVideoPageEventSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_body", message: "Invalid event payload." },
      { status: 400, headers: CORS_HEADERS },
    )
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "unavailable", message: "Video page tracking is temporarily unavailable." },
      { status: 503, headers: CORS_HEADERS },
    )
  }

  try {
    const service = createGrowthVideoPageEventService(admin)
    const result = await service.ingestPublicEvent({
      slug: parsed.data.slug,
      eventType: parsed.data.event_type,
      sessionId: parsed.data.session_id,
      visitorIdentifier: parsed.data.visitor_identifier,
      metadata: parsed.data.metadata ?? {},
    })

    if (!result.ok) {
      const status =
        result.error === "not_found" || result.error === "ambiguous_slug" ? 404 : result.error === "invalid_session" ? 400 : 503
      return NextResponse.json(
        { ok: false, error: result.error },
        { status, headers: CORS_HEADERS },
      )
    }

    return NextResponse.json(
      {
        ok: true,
        eventId: result.event.id,
        ...growthVideoPageEventSafetyPayload(),
      },
      { status: 200, headers: CORS_HEADERS },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : "capture_failed"
    return NextResponse.json({ ok: false, error: message }, { status: 500, headers: CORS_HEADERS })
  }
}
