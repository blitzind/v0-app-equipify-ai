import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_OPERATOR_NOTIFICATIONS_SN2_MIGRATION,
  GROWTH_OPERATOR_NOTIFICATIONS_SN2_QA_MARKER,
} from "@/lib/growth/notifications/growth-notification-persistence-types"

export const GROWTH_OPERATOR_NOTIFICATIONS_SCHEMA_SETUP_MESSAGE =
  `Operator notification tables are not ready. Apply migration ${GROWTH_OPERATOR_NOTIFICATIONS_SN2_MIGRATION}.`

export const GROWTH_OPERATOR_NOTIFICATIONS_SCHEMA_COLUMNS = [
  "id",
  "organization_id",
  "event_type",
  "severity",
  "recipient_role",
  "recipient_user_id",
  "dedupe_key",
  "title",
  "body",
  "payload",
  "target_entity_type",
  "target_entity_id",
  "acknowledged_at",
  "dismissed_at",
  "expires_at",
  "created_at",
  "updated_at",
] as const

export async function isGrowthOperatorNotificationsSchemaReady(
  admin: SupabaseClient,
): Promise<boolean> {
  const { error } = await admin
    .schema("growth")
    .from("operator_notifications")
    .select(GROWTH_OPERATOR_NOTIFICATIONS_SCHEMA_COLUMNS.join(", "))
    .limit(1)

  return !error
}

export async function probeGrowthOperatorNotificationsSchema(admin: SupabaseClient): Promise<{
  qa_marker: typeof GROWTH_OPERATOR_NOTIFICATIONS_SN2_QA_MARKER
  ready: boolean
  error: string | null
}> {
  const { error } = await admin
    .schema("growth")
    .from("operator_notifications")
    .select(GROWTH_OPERATOR_NOTIFICATIONS_SCHEMA_COLUMNS.join(", "))
    .limit(1)

  return {
    qa_marker: GROWTH_OPERATOR_NOTIFICATIONS_SN2_QA_MARKER,
    ready: !error,
    error: error?.message ?? null,
  }
}
