import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  disableGrowthOperatorNotificationPushSubscription,
  upsertGrowthOperatorNotificationPushSubscription,
} from "@/lib/growth/notifications/growth-notification-push-repository"
import {
  GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER,
  GROWTH_OPERATOR_NOTIFICATION_PUSH_SERVICE_WORKER_PATH,
} from "@/lib/growth/notifications/growth-notification-push-types"
import { resolveGrowthOperatorPushVapidConfig } from "@/lib/growth/notifications/growth-notification-push-vapid"

export const runtime = "nodejs"

const SubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  expirationTime: z.number().nullable().optional(),
})

const BodySchema = z.object({
  subscription: SubscriptionSchema,
  userAgent: z.string().max(500).optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid push subscription." }, { status: 400 })
  }

  const vapid = resolveGrowthOperatorPushVapidConfig()
  if (!vapid) {
    return NextResponse.json(
      { error: "push_not_configured", message: "Browser push is not configured for this deployment." },
      { status: 503 },
    )
  }

  try {
    const subscription = await upsertGrowthOperatorNotificationPushSubscription(access.admin, {
      userId: access.userId,
      endpoint: parsed.data.subscription.endpoint,
      subscriptionJson: parsed.data.subscription,
      userAgent: parsed.data.userAgent ?? request.headers.get("user-agent"),
    })

    return NextResponse.json({
      ok: true,
      qa_marker: GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER,
      subscriptionId: subscription.id,
      enabled: subscription.enabled,
      serviceWorkerPath: GROWTH_OPERATOR_NOTIFICATION_PUSH_SERVICE_WORKER_PATH,
      vapidPublicKey: vapid.publicKey,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save push subscription."
    return NextResponse.json({ error: "subscribe_failed", message }, { status: 500 })
  }
}
