import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_OPERATOR_NOTIFICATION_PUSH_MIGRATION,
  GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER,
} from "@/lib/growth/notifications/growth-notification-push-types"

export const GROWTH_OPERATOR_NOTIFICATION_PUSH_SCHEMA_SETUP_MESSAGE =
  `Operator notification push tables are not ready. Apply migration ${GROWTH_OPERATOR_NOTIFICATION_PUSH_MIGRATION}.`

export async function isGrowthOperatorNotificationPushSchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  const { error: subscriptionError } = await admin
    .schema("growth")
    .from("operator_notification_push_subscriptions")
    .select("id")
    .limit(1)

  if (subscriptionError) return false

  const { error: deliveryError } = await admin
    .schema("growth")
    .from("operator_notification_push_deliveries")
    .select("id")
    .limit(1)

  return !deliveryError
}

export async function probeGrowthOperatorNotificationPushSchema(admin: SupabaseClient): Promise<{
  qa_marker: typeof GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER
  ready: boolean
  error: string | null
}> {
  const ready = await isGrowthOperatorNotificationPushSchemaReady(admin)
  if (ready) {
    return { qa_marker: GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER, ready: true, error: null }
  }

  const { error } = await admin
    .schema("growth")
    .from("operator_notification_push_subscriptions")
    .select("id")
    .limit(1)

  return {
    qa_marker: GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER,
    ready: false,
    error: error?.message ?? GROWTH_OPERATOR_NOTIFICATION_PUSH_SCHEMA_SETUP_MESSAGE,
  }
}
