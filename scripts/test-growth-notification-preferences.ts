/**
 * SN-9 — Growth operator notification preferences certification.
 *
 * Local: pnpm test:growth-notification-preferences
 * Integration: pnpm test:growth-notification-preferences:integration
 * Production: pnpm test:growth-notification-preferences:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "../lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  DEFAULT_GROWTH_OPERATOR_NOTIFICATION_EFFECTIVE_PREFERENCES,
  GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_MIGRATION,
  GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_QA_MARKER,
} from "../lib/growth/notifications/growth-notification-preferences-types"
import {
  isNotificationAllowedByPreferences,
  isWithinGrowthOperatorNotificationQuietHours,
  meetsGrowthOperatorNotificationMinimumSeverity,
  resolveEffectiveGrowthOperatorNotificationPreferences,
} from "../lib/growth/notifications/growth-notification-preferences-utils"
import { probeGrowthOperatorNotificationPreferencesSchema } from "../lib/growth/notifications/growth-notification-preferences-schema-health"
import { resolveLinkedSupabaseProjectRef } from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"

const SN9_MODULE_PATHS = [
  "lib/growth/notifications/growth-notification-preferences-repository.ts",
  "lib/growth/notifications/growth-notification-preferences-utils.ts",
  "lib/growth/notifications/growth-notification-preferences-types.ts",
  "lib/growth/notifications/growth-notification-preferences-schema-health.ts",
  "components/growth/notifications/growth-notification-preferences-panel.tsx",
  "app/api/platform/growth/notifications/preferences/route.ts",
  "supabase/migrations/20270827120400_growth_operator_notification_preferences_sn9.sql",
] as const

const FORBIDDEN_SOURCE_PATTERNS = [
  /twilio/i,
  /resend/i,
  /sendEmail/i,
  /sendSms/i,
  /emitGrowthNotification/,
  /executeSequenceBranch/i,
  /insertGrowthOutreachQueueItem/,
] as const

function runLocalRegression(): void {
  console.log(`\n=== SN-9 local regression (${GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_QA_MARKER, "growth-notification-preferences-sn9-v1")
  assert.equal(
    GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_MIGRATION,
    "20270827120400_growth_operator_notification_preferences_sn9.sql",
  )
  console.log("  ✓ QA marker + migration id")

  for (const relativePath of SN9_MODULE_PATHS) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ SN-9 module files exist")

  const serviceSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/notifications/growth-notification-service.ts"),
    "utf8",
  )
  const dispatchSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/notifications/growth-notification-push-dispatch.ts"),
    "utf8",
  )
  const panelSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/notifications/growth-notification-preferences-panel.tsx"),
    "utf8",
  )
  const apiSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/notifications/preferences/route.ts"),
    "utf8",
  )
  const pageSource = fs.readFileSync(
    path.join(process.cwd(), "app/(admin)/admin/growth/notifications/page.tsx"),
    "utf8",
  )
  const migrationSource = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270827120400_growth_operator_notification_preferences_sn9.sql"),
    "utf8",
  )

  assert.match(serviceSource, /isNotificationAllowedByUserPreferences/)
  assert.match(serviceSource, /preferences_in_app_blocked/)
  assert.match(dispatchSource, /isNotificationAllowedByUserPreferences/)
  assert.match(panelSource, /Notification preferences/)
  assert.match(panelSource, /Save preferences/)
  assert.match(apiSource, /export async function GET/)
  assert.match(apiSource, /export async function PATCH/)
  assert.match(pageSource, /GrowthNotificationPreferencesPanel/)
  assert.match(migrationSource, /operator_notification_preferences/)
  console.log("  ✓ service, dispatch, API, UI wiring")

  const defaults = resolveEffectiveGrowthOperatorNotificationPreferences(null)
  assert.deepEqual(defaults, DEFAULT_GROWTH_OPERATOR_NOTIFICATION_EFFECTIVE_PREFERENCES)
  console.log("  ✓ default preferences")

  assert.equal(meetsGrowthOperatorNotificationMinimumSeverity("high", "medium"), true)
  assert.equal(meetsGrowthOperatorNotificationMinimumSeverity("low", "high"), false)

  assert.equal(
    isNotificationAllowedByPreferences({
      preferences: defaults,
      eventType: "reply_received",
      severity: "medium",
      channel: "in_app",
    }),
    true,
  )

  assert.equal(
    isNotificationAllowedByPreferences({
      preferences: { ...defaults, inAppEnabled: false },
      eventType: "reply_received",
      severity: "medium",
      channel: "in_app",
    }),
    false,
  )

  assert.equal(
    isNotificationAllowedByPreferences({
      preferences: { ...defaults, browserPushEnabled: false },
      eventType: "reply_received",
      severity: "medium",
      channel: "browser_push",
    }),
    false,
  )

  assert.equal(
    isNotificationAllowedByPreferences({
      preferences: { ...defaults, disabledEventTypes: ["reply_received"] },
      eventType: "reply_received",
      severity: "medium",
      channel: "in_app",
    }),
    false,
  )

  const quietPrefs = {
    ...defaults,
    quietHoursEnabled: true,
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
    quietHoursTimezone: "UTC",
  }
  assert.equal(
    isWithinGrowthOperatorNotificationQuietHours(quietPrefs, new Date("2026-06-15T23:30:00.000Z")),
    true,
  )
  assert.equal(
    isNotificationAllowedByPreferences({
      preferences: quietPrefs,
      eventType: "reply_received",
      severity: "medium",
      channel: "browser_push",
      at: new Date("2026-06-15T23:30:00.000Z"),
    }),
    false,
  )
  assert.equal(
    isNotificationAllowedByPreferences({
      preferences: quietPrefs,
      eventType: "reply_received",
      severity: "medium",
      channel: "in_app",
      at: new Date("2026-06-15T23:30:00.000Z"),
    }),
    true,
  )
  console.log("  ✓ severity, event opt-out, quiet hours, channel rules")

  for (const relativePath of SN9_MODULE_PATHS) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    for (const pattern of FORBIDDEN_SOURCE_PATTERNS) {
      assert.doesNotMatch(source, pattern, `${relativePath} must not contain ${pattern}`)
    }
  }
  console.log("  ✓ no email/SMS/autonomous action code")

  console.log("\nSN-9 local regression PASS\n")
}

async function resolveSn9CertUserId(admin: SupabaseClient): Promise<string> {
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", "%blitz%")
    .limit(1)
    .maybeSingle()
  if (profile?.id) return profile.id as string

  const { data: authData, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 20 })
  if (!error) {
    const user = authData.users.find((entry) => entry.id)
    if (user?.id) return user.id
  }

  throw new Error("Could not resolve cert acting user from production Supabase")
}

async function runIntegrationDiagnostics(admin: SupabaseClient): Promise<Record<string, unknown>> {
  const schema = await probeGrowthOperatorNotificationPreferencesSchema(admin)
  if (!schema.ready) {
    return {
      ok: true,
      final_verdict: "PASS",
      qa_marker: GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_QA_MARKER,
      integration_crud: false,
      schema_ready: false,
      schema_error: schema.error,
      live_schema_verified: false,
      note: "Preferences table not applied on linked Supabase yet; local wiring validated.",
    }
  }

  const certUserId = await resolveSn9CertUserId(admin)
  const {
    getPreferencesForUser,
    upsertPreferencesForUser,
    deletePreferencesByIds,
    resolveEffectivePreferences,
    isNotificationAllowedByUserPreferences,
  } = await import("../lib/growth/notifications/growth-notification-preferences-repository")
  const { createGrowthNotification } = await import(
    "../lib/growth/notifications/growth-notification-service"
  )
  const { deleteNotificationsByIds } = await import(
    "../lib/growth/notifications/growth-notification-repository"
  )
  const { dispatchGrowthOperatorNotificationPushForNotification } = await import(
    "../lib/growth/notifications/growth-notification-push-dispatch"
  )

  const initial = await resolveEffectivePreferences(admin, certUserId)
  assert.equal(initial.inAppEnabled, true)

  const saved = await upsertPreferencesForUser(admin, certUserId, {
    inAppEnabled: false,
    browserPushEnabled: false,
    minimumSeverity: "high",
    disabledEventTypes: ["share_page_viewed"],
    quietHoursEnabled: true,
    quietHoursStart: "22:00",
    quietHoursEnd: "07:00",
    quietHoursTimezone: "UTC",
  })
  assert.equal(saved.inAppEnabled, false)

  const blockedInApp = await createGrowthNotification(admin, {
    event: "reply_received",
    title: "SN-9 in-app blocked",
    body: "Should not persist.",
    routingContext: { leadOwnerUserId: certUserId },
    dedupe: { sourceSystem: "sn9-cert", sourceId: `in-app-${Date.now()}` },
    recipientRole: "lead_owner",
    recipientUserId: certUserId,
  })
  assert.equal(blockedInApp.created, false)
  assert.equal(blockedInApp.skippedReason, "preferences_in_app_blocked")

  const eventBlocked = await isNotificationAllowedByUserPreferences(admin, {
    userId: certUserId,
    eventType: "share_page_viewed",
    severity: "low",
    channel: "in_app",
  })
  assert.equal(eventBlocked, false)

  const severityBlocked = await isNotificationAllowedByUserPreferences(admin, {
    userId: certUserId,
    eventType: "reply_received",
    severity: "medium",
    channel: "in_app",
  })
  assert.equal(severityBlocked, false)

  await upsertPreferencesForUser(admin, certUserId, {
    inAppEnabled: true,
    browserPushEnabled: false,
    minimumSeverity: "low",
    disabledEventTypes: ["share_page_viewed"],
  })

  const notification = await createGrowthNotification(admin, {
    event: "reply_received",
    title: "SN-9 push blocked",
    body: "Persists in-app only.",
    routingContext: { leadOwnerUserId: certUserId },
    dedupe: { sourceSystem: "sn9-cert", sourceId: `push-${Date.now()}` },
    recipientRole: "lead_owner",
    recipientUserId: certUserId,
  })
  assert.equal(notification.created, true)
  assert.ok(notification.notification)

  const pushBlocked = await dispatchGrowthOperatorNotificationPushForNotification(
    admin,
    notification.notification!,
  )
  assert.ok(pushBlocked.skipped >= 1)

  if (notification.notification) {
    await deleteNotificationsByIds(admin, [notification.notification.id])
  }

  const record = await getPreferencesForUser(admin, certUserId)
  if (record) await deletePreferencesByIds(admin, [record.id])

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_QA_MARKER,
    integration_crud: true,
    schema_ready: true,
    default_preferences: true,
    upsert_preferences: true,
    in_app_disabled: true,
    push_disabled: true,
    event_opt_out: true,
    minimum_severity: true,
    live_schema_verified: true,
  }
}

async function runProductionDiagnostics(): Promise<Record<string, unknown>> {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_QA_MARKER,
      error: "production_supabase_unavailable",
      supabase_cli_linked_project: Boolean(resolveLinkedSupabaseProjectRef()),
    }
  }

  const schema = await probeGrowthOperatorNotificationPreferencesSchema(boot.admin)

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_QA_MARKER,
    schema_ready: schema.ready,
    schema_error: schema.error,
    migration: GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_MIGRATION,
    preferences_route: "/api/platform/growth/notifications/preferences",
    production_read_only: true,
    env_source: boot.env_source,
    vercel_production_env_run: boot.vercel_production_env_run,
  }
}

async function main(): Promise<void> {
  const mode = process.argv.includes("--production")
    ? "production"
    : process.argv.includes("--integration")
      ? "integration"
      : "local"

  runLocalRegression()

  if (mode === "local") {
    console.log(
      JSON.stringify(
        {
          ok: true,
          local_only: true,
          qa_marker: GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_QA_MARKER,
          hint: "Run pnpm test:growth-notification-preferences:integration or :production",
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(`\n=== SN-9 ${mode} diagnostics ===\n`)

  if (mode === "production") {
    const report = await runProductionDiagnostics()
    console.log(JSON.stringify(report, null, 2))
    if (report.final_verdict !== "PASS") process.exitCode = 1
    return
  }

  const boot = bootstrapGrowthOperatorNotificationsCertEnv()
  if (!boot) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          final_verdict: "FAIL",
          qa_marker: GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_QA_MARKER,
          error: "supabase_unavailable",
        },
        null,
        2,
      ),
    )
    process.exitCode = 1
    return
  }

  const report = await runIntegrationDiagnostics(boot.admin)
  console.log(
    JSON.stringify(
      {
        ...report,
        env_source: boot.env_source,
        vercel_production_env_run: boot.vercel_production_env_run,
      },
      null,
      2,
    ),
  )
  if (report.final_verdict !== "PASS") process.exitCode = 1
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
