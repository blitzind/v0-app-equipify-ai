import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_OPERATOR_NOTIFICATIONS_SN2_MIGRATION,
  GROWTH_OPERATOR_NOTIFICATIONS_SN2_QA_MARKER,
} from "@/lib/growth/notifications/growth-notification-persistence-types"
import { probeGrowthOperatorNotificationsSchema } from "@/lib/growth/notifications/growth-notification-schema-health"

export async function executeGrowthOperatorNotificationsProductionDiagnostics(
  admin: SupabaseClient,
): Promise<Record<string, unknown>> {
  const schema = await probeGrowthOperatorNotificationsSchema(admin)
  if (!schema.ready) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_OPERATOR_NOTIFICATIONS_SN2_QA_MARKER,
      schema_ready: false,
      schema_error: schema.error,
      migration: GROWTH_OPERATOR_NOTIFICATIONS_SN2_MIGRATION,
      live_schema_verified: false,
      production_read_only: true,
    }
  }

  const checks: Array<{ name: string; ok: boolean; error: string | null }> = []

  const headCount = await admin
    .schema("growth")
    .from("operator_notifications")
    .select("id", { count: "exact", head: true })
  checks.push({
    name: "operator_notifications_select",
    ok: !headCount.error,
    error: headCount.error?.message ?? null,
  })

  for (const column of [
    "event_type",
    "severity",
    "recipient_role",
    "recipient_user_id",
    "dedupe_key",
    "acknowledged_at",
    "dismissed_at",
  ] as const) {
    const probe = await admin
      .schema("growth")
      .from("operator_notifications")
      .select(column)
      .limit(1)
    checks.push({
      name: `column_${column}`,
      ok: !probe.error,
      error: probe.error?.message ?? null,
    })
  }

  const failedChecks = checks.filter((check) => !check.ok)
  if (failedChecks.length > 0) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_OPERATOR_NOTIFICATIONS_SN2_QA_MARKER,
      schema_ready: true,
      live_schema_verified: false,
      production_read_only: true,
      migration: GROWTH_OPERATOR_NOTIFICATIONS_SN2_MIGRATION,
      checks,
      failed_checks: failedChecks.map((check) => check.name),
    }
  }

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_OPERATOR_NOTIFICATIONS_SN2_QA_MARKER,
    schema_ready: true,
    live_schema_verified: true,
    production_read_only: true,
    migration: GROWTH_OPERATOR_NOTIFICATIONS_SN2_MIGRATION,
    operator_notifications_row_count: headCount.count ?? 0,
    checks,
  }
}
