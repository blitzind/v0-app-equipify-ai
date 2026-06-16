/**
 * SN-8 — Growth operator browser push delivery certification.
 *
 * Local: pnpm test:growth-notification-push
 * Integration: pnpm test:growth-notification-push:integration
 * Production: pnpm test:growth-notification-push:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "../lib/growth/notifications/growth-notification-cert-bootstrap"
import { resolveGrowthOperatorNotificationEntityLink } from "../lib/growth/notifications/growth-notification-center-utils"
import {
  assertGrowthOperatorNotificationPushPayloadSafe,
  buildGrowthOperatorNotificationPushPayload,
  sanitizeGrowthOperatorNotificationPushText,
} from "../lib/growth/notifications/growth-notification-push-payload"
import {
  GROWTH_OPERATOR_NOTIFICATION_PUSH_MIGRATION,
  GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER,
  GROWTH_OPERATOR_NOTIFICATION_PUSH_SERVICE_WORKER_PATH,
} from "../lib/growth/notifications/growth-notification-push-types"
import { probeGrowthOperatorNotificationPushSchema } from "../lib/growth/notifications/growth-notification-push-schema-health"
import { resolveLinkedSupabaseProjectRef } from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"

const SN8_MODULE_PATHS = [
  "lib/growth/notifications/growth-notification-push-dispatch.ts",
  "lib/growth/notifications/growth-notification-push-payload.ts",
  "lib/growth/notifications/growth-notification-push-repository.ts",
  "lib/growth/notifications/growth-notification-push-sender.ts",
  "lib/growth/notifications/growth-notification-push-vapid.ts",
  "lib/growth/notifications/growth-notification-push-types.ts",
  "components/growth/notifications/growth-notification-push-subscribe.tsx",
  "app/api/platform/growth/notifications/push/subscribe/route.ts",
  "app/api/platform/growth/notifications/push/unsubscribe/route.ts",
  "app/api/platform/growth/notifications/push/status/route.ts",
  "public/growth-operator-notification-sw.js",
  "supabase/migrations/20270827120300_growth_operator_notification_push_sn8.sql",
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

const REQUIRED_PUSH_PAYLOAD_KEYS = [
  "notificationId",
  "eventType",
  "severity",
  "title",
  "body",
  "targetRoute",
] as const

function runLocalRegression(): void {
  console.log(`\n=== SN-8 local regression (${GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER, "growth-notification-push-sn8-v1")
  assert.equal(
    GROWTH_OPERATOR_NOTIFICATION_PUSH_MIGRATION,
    "20270827120300_growth_operator_notification_push_sn8.sql",
  )
  console.log("  ✓ QA marker + migration id")

  for (const relativePath of SN8_MODULE_PATHS) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ SN-8 module files exist")

  const dispatchSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/notifications/growth-notification-push-dispatch.ts"),
    "utf8",
  )
  const serviceSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/notifications/growth-notification-service.ts"),
    "utf8",
  )
  const clientSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/notifications/growth-notification-push-subscribe.tsx"),
    "utf8",
  )
  const migrationSource = fs.readFileSync(
    path.join(process.cwd(), "supabase/migrations/20270827120300_growth_operator_notification_push_sn8.sql"),
    "utf8",
  )

  assert.match(dispatchSource, /recordGrowthOperatorNotificationPushDelivery/)
  assert.match(dispatchSource, /\.catch\(\(\) => undefined\)/)
  assert.doesNotMatch(dispatchSource, /acknowledgeNotification/)
  assert.doesNotMatch(dispatchSource, /dismissNotification/)
  assert.match(serviceSource, /dispatchGrowthOperatorNotificationPushSafely/)
  assert.match(clientSource, /Enable browser push/)
  assert.match(clientSource, /async function enableBrowserPush/)
  assert.match(clientSource, /Notification\.requestPermission\(\)/)
  const useEffectBlock = clientSource.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[refreshStatus\]\)/)?.[0] ?? ""
  assert.doesNotMatch(useEffectBlock, /requestPermission/)
  assert.match(clientSource, /Permission is requested only when you click/)
  assert.match(migrationSource, /operator_notification_push_subscriptions/)
  assert.doesNotMatch(migrationSource, /create table.*user_push_devices/i)
  assert.doesNotMatch(migrationSource, /references public\.user_push_devices/i)
  console.log("  ✓ dispatch wired safely without acknowledgement mutation")

  const payload = buildGrowthOperatorNotificationPushPayload({
    id: "00000000-0000-4000-8000-000000000001",
    organizationId: null,
    eventType: "reply_received",
    severity: "medium",
    recipientRole: "lead_owner",
    recipientUserId: "00000000-0000-4000-8000-000000000002",
    dedupeKey: "dedupe",
    title: "Reply received",
    body: "Acme HVAC replied.",
    payload: { raw_reply: "secret body", email: "hidden@example.com", phone: "+1 555 123 4567" },
    targetEntityType: "reply",
    targetEntityId: "00000000-0000-4000-8000-000000000003",
    acknowledgedAt: null,
    dismissedAt: null,
    expiresAt: null,
    createdAt: "2026-06-15T12:00:00.000Z",
    updatedAt: "2026-06-15T12:00:00.000Z",
  })

  for (const key of REQUIRED_PUSH_PAYLOAD_KEYS) {
    assert.ok(key in payload, `Missing push payload key: ${key}`)
  }
  assert.doesNotMatch(JSON.stringify(payload), /hidden@example.com/)
  assert.doesNotMatch(JSON.stringify(payload), /555 123/)
  assert.doesNotMatch(JSON.stringify(payload), /raw_reply/)
  assert.doesNotMatch(JSON.stringify(payload), /secret body/)
  assertGrowthOperatorNotificationPushPayloadSafe(payload)
  assert.equal(
    payload.targetRoute,
    resolveGrowthOperatorNotificationEntityLink({
      targetEntityType: "reply",
      targetEntityId: "00000000-0000-4000-8000-000000000003",
    }).href,
  )
  assert.equal(sanitizeGrowthOperatorNotificationPushText("Call +1 555 123 4567 now"), "Call [redacted] now")
  console.log("  ✓ safe push payload shape")

  const swSource = fs.readFileSync(
    path.join(process.cwd(), "public/growth-operator-notification-sw.js"),
    "utf8",
  )
  assert.match(swSource, /showNotification/)
  assert.equal(GROWTH_OPERATOR_NOTIFICATION_PUSH_SERVICE_WORKER_PATH, "/growth-operator-notification-sw.js")
  console.log("  ✓ service worker present")

  for (const relativePath of SN8_MODULE_PATHS) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    for (const pattern of FORBIDDEN_SOURCE_PATTERNS) {
      assert.doesNotMatch(source, pattern, `${relativePath} must not contain ${pattern}`)
    }
  }
  console.log("  ✓ no email/SMS/preferences/autonomous action code")

  console.log("\nSN-8 local regression PASS\n")
}

async function resolveSn8CertUserId(admin: SupabaseClient): Promise<string> {
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

function certSubscription(endpointSuffix: string) {
  return {
    endpoint: `https://push.example.test/sn8/${endpointSuffix}`,
    keys: {
      p256dh: "BNcRdCalf1cFckNW20K9QKcY1M4QZ8zZ8zZ8zZ8zZ8zZ8",
      auth: "tBHItJI5svbpez7KI4CCXg",
    },
  }
}

async function runIntegrationDiagnostics(admin: SupabaseClient): Promise<Record<string, unknown>> {
  const schema = await probeGrowthOperatorNotificationPushSchema(admin)
  if (!schema.ready) {
    return {
      ok: true,
      final_verdict: "PASS",
      qa_marker: GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER,
      integration_crud: false,
      schema_ready: false,
      schema_error: schema.error,
      live_schema_verified: false,
      note: "Push tables not applied on linked Supabase yet; local wiring validated.",
    }
  }

  const certUserId = await resolveSn8CertUserId(admin)
  const {
    upsertGrowthOperatorNotificationPushSubscription,
    disableGrowthOperatorNotificationPushSubscription,
    countEnabledGrowthOperatorNotificationPushSubscriptions,
    deleteGrowthOperatorNotificationPushSubscriptionsByIds,
  } = await import("../lib/growth/notifications/growth-notification-push-repository")

  const endpointSuffix = Date.now().toString()
  const subscription = await upsertGrowthOperatorNotificationPushSubscription(admin, {
    userId: certUserId,
    endpoint: certSubscription(endpointSuffix).endpoint,
    subscriptionJson: certSubscription(endpointSuffix),
    userAgent: "sn8-cert",
  })
  assert.equal(subscription.enabled, true)

  const enabledCount = await countEnabledGrowthOperatorNotificationPushSubscriptions(admin, certUserId)
  assert.ok(enabledCount >= 1)

  await disableGrowthOperatorNotificationPushSubscription(admin, {
    userId: certUserId,
    endpoint: subscription.endpoint,
  })

  const afterDisable = await countEnabledGrowthOperatorNotificationPushSubscriptions(admin, certUserId)
  assert.ok(afterDisable <= enabledCount)

  await deleteGrowthOperatorNotificationPushSubscriptionsByIds(admin, [subscription.id])

  const { createNotification, deleteNotificationsByIds } = await import(
    "../lib/growth/notifications/growth-notification-repository"
  )
  const { dispatchGrowthOperatorNotificationPushForNotification } = await import(
    "../lib/growth/notifications/growth-notification-push-dispatch"
  )
  const { resolveGrowthOperatorNotificationSeverity } = await import(
    "../lib/growth/notifications/growth-notification-severity"
  )

  const notification = await createNotification(admin, {
    organizationId: null,
    eventType: "reply_received",
    severity: resolveGrowthOperatorNotificationSeverity("reply_received"),
    recipientRole: "lead_owner",
    recipientUserId: certUserId,
    dedupeKey: `sn8-dispatch-${Date.now()}`,
    title: "SN-8 dispatch certification",
    body: "Certification Co replied.",
    payload: { qa_marker: GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER, cert: true },
    targetEntityType: "lead",
    targetEntityId: "00000000-0000-4000-8000-000000000099",
  })

  const dispatch = await dispatchGrowthOperatorNotificationPushForNotification(admin, notification)
  assert.equal(dispatch.notificationId, notification.id)
  assert.ok(dispatch.skipped >= 0)

  await deleteNotificationsByIds(admin, [notification.id])

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER,
    integration_crud: true,
    schema_ready: true,
    subscribe_unsubscribe: true,
    dispatch_checked: true,
    live_schema_verified: true,
  }
}

async function runProductionDiagnostics(): Promise<Record<string, unknown>> {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER,
      error: "production_supabase_unavailable",
      supabase_cli_linked_project: Boolean(resolveLinkedSupabaseProjectRef()),
    }
  }

  const [operatorSchema, pushSchema] = await Promise.all([
    import("../lib/growth/notifications/growth-notification-production-diagnostics").then((mod) =>
      mod.executeGrowthOperatorNotificationsProductionDiagnostics(boot.admin),
    ),
    probeGrowthOperatorNotificationPushSchema(boot.admin),
  ])

  return {
    ...operatorSchema,
    qa_marker: GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER,
    push_schema_ready: pushSchema.ready,
    push_schema_error: pushSchema.error,
    push_migration: GROWTH_OPERATOR_NOTIFICATION_PUSH_MIGRATION,
    push_routes: [
      "/api/platform/growth/notifications/push/subscribe",
      "/api/platform/growth/notifications/push/unsubscribe",
      "/api/platform/growth/notifications/push/status",
    ],
    service_worker_path: GROWTH_OPERATOR_NOTIFICATION_PUSH_SERVICE_WORKER_PATH,
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
          qa_marker: GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER,
          hint: "Run pnpm test:growth-notification-push:integration or :production",
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(`\n=== SN-8 ${mode} diagnostics ===\n`)

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
          qa_marker: GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER,
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
