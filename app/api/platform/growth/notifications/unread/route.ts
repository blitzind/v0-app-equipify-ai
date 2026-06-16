import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { GROWTH_OPERATOR_NOTIFICATION_CENTER_QA_MARKER } from "@/lib/growth/notifications/growth-notification-persistence-types"
import { getUnreadCounts } from "@/lib/growth/notifications/growth-notification-repository"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const counts = await getUnreadCounts(access.admin, {
      recipientUserId: access.userId,
      includePlatformAdminPool: true,
    })

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_OPERATOR_NOTIFICATION_CENTER_QA_MARKER,
      counts,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load unread counts."
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}
