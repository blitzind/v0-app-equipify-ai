import { NextResponse } from "next/server"
import { z } from "zod"
import {
  GROWTH_SENDR_ENGAGEMENT_EVENT_TYPES,
  GROWTH_SENDR_QA_MARKER,
} from "@/lib/growth/sendr/growth-sendr-config"
import { appendGrowthSendrEngagementEvents } from "@/lib/growth/sendr/growth-sendr-engagement-event-service"
import { requireSendrPlatformAccess } from "@/lib/growth/sendr/growth-sendr-platform-access"

export const runtime = "nodejs"

const EventSchema = z.object({
  sessionId: z.string().min(1).max(120),
  eventType: z.enum(GROWTH_SENDR_ENGAGEMENT_EVENT_TYPES),
  landingPageId: z.string().uuid().optional(),
  videoAssetId: z.string().uuid().optional(),
  bookingAssetId: z.string().uuid().optional(),
  conversationAgentId: z.string().uuid().optional(),
  eventValue: z.record(z.unknown()).optional(),
})

const BodySchema = z.object({
  events: z.array(EventSchema).min(1).max(500),
})

export async function POST(request: Request) {
  const access = await requireSendrPlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 })
  }

  try {
    const result = await appendGrowthSendrEngagementEvents(access.admin, {
      organizationId: access.organizationId,
      events: parsed.data.events,
    })
    return NextResponse.json({ ok: true, result, qa_marker: GROWTH_SENDR_QA_MARKER })
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "engagement_events_failed" },
      { status: 500 },
    )
  }
}
