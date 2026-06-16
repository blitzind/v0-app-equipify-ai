import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { GROWTH_OPERATOR_NOTIFICATION_CENTER_QA_MARKER } from "@/lib/growth/notifications/growth-notification-persistence-types"
import { mapGrowthOperatorNotificationCenterItem } from "@/lib/growth/notifications/growth-notification-center-utils"
import { acknowledgeNotification } from "@/lib/growth/notifications/growth-notification-repository"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { id } = await context.params
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "invalid_id", message: "Notification id must be a UUID." }, { status: 400 })
  }

  try {
    const updated = await acknowledgeNotification(access.admin, id)
    if (!updated) {
      return NextResponse.json(
        { error: "not_found", message: "Notification not found or already dismissed." },
        { status: 404 },
      )
    }

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_OPERATOR_NOTIFICATION_CENTER_QA_MARKER,
      notification: mapGrowthOperatorNotificationCenterItem(updated),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not acknowledge notification."
    return NextResponse.json({ error: "acknowledge_failed", message }, { status: 500 })
  }
}
