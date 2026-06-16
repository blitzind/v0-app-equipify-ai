import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { getGrowthOperatorNotificationAnalytics } from "@/lib/growth/notifications/growth-notification-analytics"
import { GROWTH_OPERATOR_NOTIFICATION_ANALYTICS_QA_MARKER } from "@/lib/growth/notifications/growth-notification-analytics-types"

export const runtime = "nodejs"

export async function GET(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const url = new URL(request.url)
  const windowDaysParam = url.searchParams.get("windowDays")
  const windowDays = windowDaysParam
    ? z.coerce.number().int().min(1).max(90).parse(windowDaysParam)
    : 30

  try {
    const analytics = await getGrowthOperatorNotificationAnalytics(access.admin, {
      recipientUserId: access.userId,
      includePlatformAdminPool: true,
      windowDays,
    })

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_OPERATOR_NOTIFICATION_ANALYTICS_QA_MARKER,
      analytics,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load notification analytics."
    return NextResponse.json({ error: "analytics_failed", message }, { status: 500 })
  }
}
