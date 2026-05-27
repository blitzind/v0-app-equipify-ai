import { NextResponse } from "next/server"
import { logGrowthEngine } from "@/lib/growth/access"
import {
  GROWTH_TRACKING_PIXEL_BYTES,
  trackingPixelResponseHeaders,
} from "@/lib/growth/tracking/tracking-pixel"
import { recordEmailOpen } from "@/lib/growth/tracking/tracking-repository"
import { verifyTrackingToken, hashTrackingIp, inferDeviceType } from "@/lib/growth/tracking/tracking-token"
import { createServiceRoleClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null
  return request.headers.get("x-real-ip")
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params
  const payload = verifyTrackingToken(decodeURIComponent(token))
  const headers = trackingPixelResponseHeaders()

  if (!payload || payload.t !== "open") {
    return new NextResponse(GROWTH_TRACKING_PIXEL_BYTES, { status: 200, headers })
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return new NextResponse(GROWTH_TRACKING_PIXEL_BYTES, { status: 200, headers })
  }

  try {
    const userAgent = request.headers.get("user-agent")
    await recordEmailOpen(admin, {
      deliveryAttemptId: payload.a,
      userAgent,
      ipHash: hashTrackingIp(clientIp(request)),
    })
    logGrowthEngine("tracking_open_recorded", {
      delivery_attempt_id: payload.a,
      device_type: inferDeviceType(userAgent),
    })
  } catch (error) {
    logGrowthEngine("tracking_open_failed", {
      delivery_attempt_id: payload.a,
      message: error instanceof Error ? error.message : String(error),
    })
  }

  return new NextResponse(GROWTH_TRACKING_PIXEL_BYTES, { status: 200, headers })
}
