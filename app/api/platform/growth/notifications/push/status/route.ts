import { NextResponse } from "next/server"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import { countEnabledGrowthOperatorNotificationPushSubscriptions } from "@/lib/growth/notifications/growth-notification-push-repository"
import {
  GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER,
  GROWTH_OPERATOR_NOTIFICATION_PUSH_SERVICE_WORKER_PATH,
} from "@/lib/growth/notifications/growth-notification-push-types"
import { resolveGrowthOperatorPushVapidConfig } from "@/lib/growth/notifications/growth-notification-push-vapid"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const vapid = resolveGrowthOperatorPushVapidConfig()
    const subscriptionCount = await countEnabledGrowthOperatorNotificationPushSubscriptions(
      access.admin,
      access.userId,
    )

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER,
      supported: Boolean(vapid),
      permission: "unsupported",
      enabled: subscriptionCount > 0,
      subscriptionCount,
      vapidPublicKey: vapid?.publicKey ?? null,
      serviceWorkerPath: GROWTH_OPERATOR_NOTIFICATION_PUSH_SERVICE_WORKER_PATH,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load push status."
    return NextResponse.json({ error: "status_failed", message }, { status: 500 })
  }
}
