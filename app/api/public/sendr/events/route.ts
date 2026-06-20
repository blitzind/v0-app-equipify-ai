import { NextResponse } from "next/server"
import { z } from "zod"
import { GROWTH_SENDR_ENGAGEMENT_EVENT_TYPES, GROWTH_SENDR_PUBLIC_QA_MARKER } from "@/lib/growth/sendr/growth-sendr-config"
import { ingestSendrPublicEngagementEvents } from "@/lib/growth/sendr/growth-sendr-public-engagement-service"
import { createServiceRoleClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

const EventSchema = z.object({
  eventType: z.enum(GROWTH_SENDR_ENGAGEMENT_EVENT_TYPES),
  eventValue: z.record(z.unknown()).optional(),
})

const BodySchema = z.object({
  slug: z.string().min(3).max(80),
  sessionId: z.string().min(8).max(120),
  pageUrl: z.string().max(2000).optional(),
  events: z.array(EventSchema).min(1).max(500),
})

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "unavailable" },
      { status: 503, headers: CORS_HEADERS },
    )
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload" },
      { status: 400, headers: CORS_HEADERS },
    )
  }

  try {
    const result = await ingestSendrPublicEngagementEvents(admin, {
      slug: parsed.data.slug,
      sessionId: parsed.data.sessionId,
      pageUrl: parsed.data.pageUrl,
      events: parsed.data.events,
    })

    return NextResponse.json(
      {
        ok: result.ok,
        accepted: result.accepted,
        throttled: result.throttled,
        qa_marker: GROWTH_SENDR_PUBLIC_QA_MARKER,
      },
      { status: result.status, headers: CORS_HEADERS },
    )
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "event_ingest_failed" },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
