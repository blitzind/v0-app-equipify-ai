import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { disableGrowthOperatorNotificationPushSubscription } from "@/lib/growth/notifications/growth-notification-push-repository"
import { GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER } from "@/lib/growth/notifications/growth-notification-push-types"

export const runtime = "nodejs"

const BodySchema = z.object({
  endpoint: z.string().url(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid unsubscribe payload." }, { status: 400 })
  }

  try {
    await disableGrowthOperatorNotificationPushSubscription(access.admin, {
      userId: access.userId,
      endpoint: parsed.data.endpoint,
    })

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER,
      enabled: false,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not unsubscribe push device."
    return NextResponse.json({ error: "unsubscribe_failed", message }, { status: 500 })
  }
}
