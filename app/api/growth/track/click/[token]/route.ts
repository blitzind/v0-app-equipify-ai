import { NextResponse } from "next/server"
import { logGrowthEngine } from "@/lib/growth/access"
import { isSafeRedirectUrl, resolveClickDestinationFromToken } from "@/lib/growth/tracking/tracking-links"
import { recordEmailClick } from "@/lib/growth/tracking/tracking-repository"
import { verifyTrackingToken, hashTrackingIp, inferDeviceType } from "@/lib/growth/tracking/tracking-token"
import { createServiceRoleClient } from "@/lib/supabase/admin"

export const runtime = "nodejs"

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null
  return request.headers.get("x-real-ip")
}

function safeFallbackRedirect(): NextResponse {
  return NextResponse.redirect("https://equipify.ai", { status: 302 })
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params
  const payload = verifyTrackingToken(decodeURIComponent(token))

  if (!payload || payload.t !== "click") {
    return safeFallbackRedirect()
  }

  const destination = resolveClickDestinationFromToken({ destinationUrl: payload.u })
  if (!destination || !isSafeRedirectUrl(destination)) {
    return safeFallbackRedirect()
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.redirect(destination, { status: 302 })
  }

  try {
    const userAgent = request.headers.get("user-agent")
    const result = await recordEmailClick(admin, {
      deliveryAttemptId: payload.a,
      destinationUrl: destination,
      trackingToken: token,
      userAgent,
      ipHash: hashTrackingIp(clientIp(request)),
    })
    logGrowthEngine("tracking_click_recorded", {
      delivery_attempt_id: payload.a,
      recorded: result.recorded,
      device_type: inferDeviceType(userAgent),
    })
    return NextResponse.redirect(result.redirectUrl ?? destination, { status: 302 })
  } catch (error) {
    logGrowthEngine("tracking_click_failed", {
      delivery_attempt_id: payload.a,
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.redirect(destination, { status: 302 })
  }
}
