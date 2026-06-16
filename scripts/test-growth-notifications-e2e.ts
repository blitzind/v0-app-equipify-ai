/**
 * SN-10 — Sendr operator notification system end-to-end certification.
 *
 * Local: pnpm test:growth-notifications-e2e
 * Integration: pnpm test:growth-notifications-e2e:integration
 * Production: pnpm test:growth-notifications-e2e:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "../lib/growth/notifications/growth-notification-cert-bootstrap"
import {
  GROWTH_OPERATOR_NOTIFICATION_ANALYTICS_QA_MARKER,
  GROWTH_NOTIFICATIONS_E2E_QA_MARKER,
} from "../lib/growth/notifications/growth-notification-analytics-types"
import {
  GROWTH_OPERATOR_NOTIFICATION_EVENTS,
  GROWTH_OPERATOR_NOTIFICATIONS_QA_MARKER,
} from "../lib/growth/notifications/growth-notification-events"
import { GROWTH_OPERATOR_NOTIFICATION_CENTER_QA_MARKER } from "../lib/growth/notifications/growth-notification-persistence-types"
import { GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_QA_MARKER } from "../lib/growth/notifications/growth-notification-preferences-types"
import { GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER } from "../lib/growth/notifications/growth-notification-push-types"
import { resolveLinkedSupabaseProjectRef } from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"

const SN10_MODULE_PATHS = [
  "lib/growth/notifications/growth-notification-analytics-types.ts",
  "lib/growth/notifications/growth-notification-analytics.ts",
  "lib/growth/notifications/growth-notification-digest.ts",
  "components/growth/notifications/growth-notification-analytics-section.tsx",
  "app/api/platform/growth/notifications/analytics/route.ts",
  "scripts/test-growth-notifications-e2e.ts",
] as const

const PHASE_CHECKS = [
  {
    phase: "SN-1",
    marker: GROWTH_OPERATOR_NOTIFICATIONS_QA_MARKER,
    paths: [
      "lib/growth/notifications/growth-notification-events.ts",
      "lib/growth/notifications/growth-notification-routing.ts",
      "lib/growth/notifications/growth-notification-severity.ts",
      "lib/growth/notifications/growth-notification-dedupe-rules.ts",
    ],
  },
  {
    phase: "SN-2",
    marker: "growth-operator-notifications-sn2-v1",
    paths: [
      "lib/growth/notifications/growth-notification-repository.ts",
      "lib/growth/notifications/growth-notification-service.ts",
      "supabase/migrations/20270827120200_growth_operator_notifications_sn2.sql",
    ],
  },
  {
    phase: "SN-3",
    marker: "growth-share-page-notifications-sn3-v1",
    paths: [
      "lib/growth/notifications/growth-share-page-notification-content.ts",
      "lib/growth/share-pages/share-page-operator-notifications.ts",
    ],
  },
  {
    phase: "SN-4",
    marker: "growth-reply-booking-notifications-sn4-v1",
    paths: [
      "lib/growth/notifications/growth-reply-notification-content.ts",
      "lib/growth/reply-intelligence/reply-operator-notifications.ts",
    ],
  },
  {
    phase: "SN-5",
    marker: "growth-sequence-notifications-sn5-v1",
    paths: [
      "lib/growth/notifications/growth-sequence-notification-content.ts",
      "lib/growth/sequences/conditions/sequence-operator-notifications.ts",
    ],
  },
  {
    phase: "SN-6",
    marker: "growth-inbox-notifications-sn6-v1",
    paths: [
      "lib/growth/notifications/growth-inbox-notification-content.ts",
      "lib/growth/inbox-team-ownership/inbox-operator-notifications.ts",
    ],
  },
  {
    phase: "SN-7",
    marker: GROWTH_OPERATOR_NOTIFICATION_CENTER_QA_MARKER,
    paths: [
      "components/growth/notifications/growth-notification-center.tsx",
      "app/api/platform/growth/notifications/route.ts",
      "app/(admin)/admin/growth/notifications/page.tsx",
    ],
  },
  {
    phase: "SN-8",
    marker: GROWTH_OPERATOR_NOTIFICATION_PUSH_QA_MARKER,
    paths: [
      "lib/growth/notifications/growth-notification-push-dispatch.ts",
      "app/api/platform/growth/notifications/push/subscribe/route.ts",
      "public/growth-operator-notification-sw.js",
    ],
  },
  {
    phase: "SN-9",
    marker: GROWTH_OPERATOR_NOTIFICATION_PREFERENCES_QA_MARKER,
    paths: [
      "lib/growth/notifications/growth-notification-preferences-repository.ts",
      "app/api/platform/growth/notifications/preferences/route.ts",
      "components/growth/notifications/growth-notification-preferences-panel.tsx",
    ],
  },
  {
    phase: "SN-10",
    marker: GROWTH_NOTIFICATIONS_E2E_QA_MARKER,
    paths: [...SN10_MODULE_PATHS],
  },
] as const

const FORBIDDEN_SOURCE_PATTERNS = [
  /twilio/i,
  /resend/i,
  /sendEmail/i,
  /sendSms/i,
  /emitGrowthNotification/,
  /executeSequenceBranch/i,
  /insertGrowthOutreachQueueItem/,
  /runGrowthAiCopilotGeneration/,
] as const

function runLocalRegression(): void {
  console.log(`\n=== SN-10 end-to-end local regression (${GROWTH_NOTIFICATIONS_E2E_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_NOTIFICATIONS_E2E_QA_MARKER, "growth-notifications-e2e-sn10-v1")
  assert.equal(GROWTH_OPERATOR_NOTIFICATION_ANALYTICS_QA_MARKER, "growth-notification-analytics-sn10-v1")
  assert.equal(GROWTH_OPERATOR_NOTIFICATION_EVENTS.length, 20)
  console.log("  ✓ QA markers + SN-1 taxonomy size")

  for (const relativePath of SN10_MODULE_PATHS) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ SN-10 module files exist")

  for (const phase of PHASE_CHECKS) {
    for (const relativePath of phase.paths) {
      assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `${phase.phase} missing: ${relativePath}`)
    }
  }
  console.log("  ✓ SN-1 through SN-10 module inventory")

  const analyticsSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/notifications/growth-notification-analytics.ts"),
    "utf8",
  )
  const digestSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/notifications/growth-notification-digest.ts"),
    "utf8",
  )
  const apiSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/notifications/analytics/route.ts"),
    "utf8",
  )
  const uiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/notifications/growth-notification-analytics-section.tsx"),
    "utf8",
  )
  const pageSource = fs.readFileSync(
    path.join(process.cwd(), "app/(admin)/admin/growth/notifications/page.tsx"),
    "utf8",
  )

  assert.match(analyticsSource, /volumeByEventType/)
  assert.match(analyticsSource, /volumeBySeverity/)
  assert.match(analyticsSource, /unreadOverTime/)
  assert.match(analyticsSource, /operator_notification_push_deliveries/)
  assert.match(digestSource, /buildDailyDigestPreview/)
  assert.match(digestSource, /buildCriticalDigestPreview/)
  assert.doesNotMatch(digestSource, /sendEmail/)
  assert.match(apiSource, /getGrowthOperatorNotificationAnalytics/)
  assert.match(uiSource, /Notification analytics/)
  assert.match(pageSource, /GrowthNotificationAnalyticsSection/)
  console.log("  ✓ analytics API, digest preview, UI wiring")

  const forbiddenScanPaths = SN10_MODULE_PATHS.filter((relativePath) => !relativePath.startsWith("scripts/"))
  for (const relativePath of forbiddenScanPaths) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    for (const pattern of FORBIDDEN_SOURCE_PATTERNS) {
      assert.doesNotMatch(source, pattern, `${relativePath} must not contain ${pattern}`)
    }
  }
  console.log("  ✓ no email/SMS/autonomous action code in SN-10 modules")

  console.log("\nSN-10 end-to-end local regression PASS\n")
}

async function resolveE2eCertUserId(admin: SupabaseClient): Promise<string> {
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
  const { getGrowthOperatorNotificationAnalytics } = await import(
    "../lib/growth/notifications/growth-notification-analytics"
  )
  const { buildCriticalDigestPreview, buildDailyDigestPreview } = await import(
    "../lib/growth/notifications/growth-notification-digest"
  )
  const { probeGrowthOperatorNotificationPushSchema } = await import(
    "../lib/growth/notifications/growth-notification-push-schema-health"
  )
  const { probeGrowthOperatorNotificationPreferencesSchema } = await import(
    "../lib/growth/notifications/growth-notification-preferences-schema-health"
  )
  const { probeGrowthOperatorNotificationsSchema } = await import(
    "../lib/growth/notifications/growth-notification-schema-health"
  )

  const certUserId = await resolveE2eCertUserId(admin)
  const [operatorSchema, pushSchema, preferencesSchema] = await Promise.all([
    probeGrowthOperatorNotificationsSchema(admin),
    probeGrowthOperatorNotificationPushSchema(admin),
    probeGrowthOperatorNotificationPreferencesSchema(admin),
  ])

  const analytics = await getGrowthOperatorNotificationAnalytics(admin, {
    recipientUserId: certUserId,
    includePlatformAdminPool: true,
    windowDays: 30,
  })
  assert.equal(analytics.qa_marker, GROWTH_OPERATOR_NOTIFICATION_ANALYTICS_QA_MARKER)
  assert.ok(Array.isArray(analytics.volumeByEventType))
  assert.ok(Array.isArray(analytics.unreadOverTime))

  const dailyDigest = await buildDailyDigestPreview(admin, {
    recipientUserId: certUserId,
    includePlatformAdminPool: true,
  })
  const criticalDigest = await buildCriticalDigestPreview(admin, {
    recipientUserId: certUserId,
    includePlatformAdminPool: true,
  })
  assert.equal(dailyDigest.qa_marker, GROWTH_NOTIFICATIONS_E2E_QA_MARKER)
  assert.equal(criticalDigest.qa_marker, GROWTH_NOTIFICATIONS_E2E_QA_MARKER)
  assert.equal(dailyDigest.kind, "daily")
  assert.equal(criticalDigest.kind, "critical")

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_NOTIFICATIONS_E2E_QA_MARKER,
    operator_schema_ready: operatorSchema.ready,
    push_schema_ready: pushSchema.ready,
    preferences_schema_ready: preferencesSchema.ready,
    analytics_checked: true,
    daily_digest_checked: true,
    critical_digest_checked: true,
    analytics_totals: analytics.totals,
    live_schema_verified: operatorSchema.ready,
  }
}

async function runProductionDiagnostics(): Promise<Record<string, unknown>> {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_NOTIFICATIONS_E2E_QA_MARKER,
      error: "production_supabase_unavailable",
      supabase_cli_linked_project: Boolean(resolveLinkedSupabaseProjectRef()),
    }
  }

  const certUserId = await resolveE2eCertUserId(boot.admin)
  const { getGrowthOperatorNotificationAnalytics } = await import(
    "../lib/growth/notifications/growth-notification-analytics"
  )
  const { buildDailyDigestPreview } = await import("../lib/growth/notifications/growth-notification-digest")

  const analytics = await getGrowthOperatorNotificationAnalytics(boot.admin, {
    recipientUserId: certUserId,
    includePlatformAdminPool: true,
    windowDays: 7,
  })
  const digest = await buildDailyDigestPreview(boot.admin, {
    recipientUserId: certUserId,
    includePlatformAdminPool: true,
    limit: 5,
  })

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_NOTIFICATIONS_E2E_QA_MARKER,
    analytics_qa_marker: analytics.qa_marker,
    digest_qa_marker: digest.qa_marker,
    analytics_route: "/api/platform/growth/notifications/analytics",
    production_read_only: true,
    operator_notifications_total: analytics.totals.total,
    digest_item_count: digest.itemCount,
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
          qa_marker: GROWTH_NOTIFICATIONS_E2E_QA_MARKER,
          phases: PHASE_CHECKS.map((entry) => entry.phase),
          hint: "Run pnpm test:growth-notifications-e2e:integration or :production",
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(`\n=== SN-10 ${mode} diagnostics ===\n`)

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
          qa_marker: GROWTH_NOTIFICATIONS_E2E_QA_MARKER,
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
