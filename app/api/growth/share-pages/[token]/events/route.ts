import { NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { ingestSharePageAnalyticsEvent } from "@/lib/growth/share-pages/share-page-analytics-service"
import { GROWTH_SHARE_PAGE_EVENT_TYPES } from "@/lib/growth/share-pages/share-page-types"
import { createServiceRoleClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null
  return request.headers.get("x-real-ip")
}

function hashClientKey(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16)
}

function normalizeBody(body: Record<string, unknown>) {
  const eventType = typeof body.eventType === "string" ? body.eventType.trim() : ""
  const sessionKey = typeof body.sessionKey === "string" ? body.sessionKey.trim() : ""
  const sharePageViewId = typeof body.sharePageViewId === "string" ? body.sharePageViewId.trim() : null
  const eventLabel = typeof body.eventLabel === "string" ? body.eventLabel : undefined
  const pageUrl = typeof body.pageUrl === "string" ? body.pageUrl : undefined
  const referrer = typeof body.referrer === "string" ? body.referrer : null
  const durationMs = typeof body.durationMs === "number" && Number.isFinite(body.durationMs) ? body.durationMs : undefined
  const scrollDepthPct =
    typeof body.scrollDepthPct === "number" && Number.isFinite(body.scrollDepthPct) ? body.scrollDepthPct : undefined
  const metadata = body.metadata && typeof body.metadata === "object" ? (body.metadata as Record<string, unknown>) : undefined
  const utm = body.utm && typeof body.utm === "object" ? (body.utm as Record<string, string>) : undefined
  const deviceMetadata =
    body.deviceMetadata && typeof body.deviceMetadata === "object"
      ? (body.deviceMetadata as Record<string, unknown>)
      : undefined
  const occurredAt = typeof body.occurredAt === "string" ? body.occurredAt : undefined

  if (!eventType || !(GROWTH_SHARE_PAGE_EVENT_TYPES as readonly string[]).includes(eventType)) {
    return null
  }
  if (!sessionKey) return null

  return {
    eventType: eventType as (typeof GROWTH_SHARE_PAGE_EVENT_TYPES)[number],
    sessionKey,
    sharePageViewId,
    eventLabel,
    pageUrl,
    referrer,
    durationMs,
    scrollDepthPct,
    metadata,
    utm,
    deviceMetadata,
    occurredAt,
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const payload = normalizeBody(body)

    if (!payload) {
      return NextResponse.json(
        { ok: false, error: "validation_error", message: "eventType and sessionKey are required." },
        { status: 400, headers: CORS_HEADERS },
      )
    }

    const admin = createServiceRoleClient()
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "unavailable", message: "Share page analytics is temporarily unavailable." },
        { status: 503, headers: CORS_HEADERS },
      )
    }

    const ip = clientIp(request) ?? "unknown"
    const userAgent = request.headers.get("user-agent") ?? "unknown"
    const rateLimitKey = `${hashClientKey(token)}:${payload.sessionKey}:${hashClientKey(`${ip}:${userAgent}`)}`

    const result = await ingestSharePageAnalyticsEvent(admin, {
      rawToken: decodeURIComponent(token),
      ...payload,
      deviceMetadata: {
        ...(payload.deviceMetadata ?? {}),
        user_agent: userAgent,
      },
      rateLimitKey,
    })

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error ?? "rejected" },
        { status: result.status, headers: CORS_HEADERS },
      )
    }

    return NextResponse.json(
      {
        ok: true,
        sharePageViewId: result.sharePageViewId,
        deduplicated: result.deduplicated ?? false,
        engaged: result.engaged ?? false,
        engagementThresholdCrossed: result.engagementThresholdCrossed ?? false,
      },
      { status: 200, headers: CORS_HEADERS },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ ok: false, error: "capture_failed", message }, { status: 500, headers: CORS_HEADERS })
  }
}
