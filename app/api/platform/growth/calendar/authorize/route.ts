import { NextRequest, NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { signGrowthCalendarOAuthState } from "@/lib/growth/calendar/calendar-oauth-state"
import { buildGrowthGoogleCalendarAuthorizeUrl } from "@/lib/growth/calendar/google-calendar-oauth"
import { growthGoogleCalendarOAuthConfigured } from "@/lib/growth/calendar/google-calendar-env"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!growthGoogleCalendarOAuthConfigured()) {
    return NextResponse.json(
      { error: "not_configured", message: "Google Calendar OAuth is not configured on this deployment." },
      { status: 503 },
    )
  }

  const returnTo = request.nextUrl.searchParams.get("returnTo")?.trim() || "/admin/growth/settings"
  const safeReturnTo = returnTo.startsWith("/admin/growth") ? returnTo : "/admin/growth/settings"

  const state = signGrowthCalendarOAuthState({
    userId: access.userId,
    returnTo: safeReturnTo,
    ts: Date.now(),
  })

  if (!state) {
    return NextResponse.json(
      { error: "state_unavailable", message: "OAuth state secret is not configured." },
      { status: 503 },
    )
  }

  const authorizeUrl = buildGrowthGoogleCalendarAuthorizeUrl({ state })
  return NextResponse.redirect(authorizeUrl)
}
