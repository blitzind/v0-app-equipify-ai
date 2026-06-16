import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_MIGRATION,
  GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_QA_MARKER,
} from "@/lib/growth/notifications/growth-notification-preferences-types"

export const GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_SCHEMA_SETUP_MESSAGE =
  `Operator notification preferences table is not ready. Apply migration ${GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_MIGRATION}.`

export async function isGrowthOperatorNotificationPreferencesSchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from("operator_notification_preferences")
    .select("id")
    .limit(1)

  return !error
}

export async function probeGrowthOperatorNotificationPreferencesSchema(admin: SupabaseClient): Promise<{
  qa_marker: typeof GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_QA_MARKER
  ready: boolean
  error: string | null
}> {
  const ready = await isGrowthOperatorNotificationPreferencesSchemaReady(admin)
  if (ready) {
    return { qa_marker: GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_QA_MARKER, ready: true, error: null }
  }

  const { error } = await admin
    .schema("growth")
    .from("operator_notification_preferences")
    .select("id")
    .limit(1)

  return {
    qa_marker: GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_QA_MARKER,
    ready: false,
    error: error?.message ?? GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_SCHEMA_SETUP_MESSAGE,
  }
}
