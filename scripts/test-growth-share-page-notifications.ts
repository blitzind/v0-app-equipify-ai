/**
 * SN-3 — Share page operator notifications certification.
 *
 * Local: pnpm test:growth-share-page-notifications
 * Integration: pnpm test:growth-share-page-notifications:integration
 * Production: pnpm test:growth-share-page-notifications:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "../lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_OPERATOR_NOTIFICATION_SHARE_PAGE_EVENTS } from "../lib/growth/notifications/growth-notification-events"
import { resolveGrowthOperatorNotificationDedupeRule } from "../lib/growth/notifications/growth-notification-dedupe-rules"
import {
  buildGrowthSharePageOperatorNotificationContent,
  GROWTH_SHARE_PAGE_OPERATOR_NOTIFICATIONS_QA_MARKER,
} from "../lib/growth/notifications/growth-share-page-notification-content"
import { resolveLinkedSupabaseProjectRef } from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"
import {
  buildSharePageOperatorNotificationRoutingContext,
  emitSharePageOperatorNotification,
  resolveSharePageOperatorNotificationRecipients,
} from "../lib/growth/share-pages/share-page-operator-notifications"
import type { GrowthSharePage } from "../lib/growth/share-pages/share-page-types"

const SN3_MODULE_PATHS = [
  "lib/growth/notifications/growth-share-page-notification-content.ts",
  "lib/growth/share-pages/share-page-operator-notifications.ts",
  "lib/growth/share-pages/share-page-analytics-service.ts",
] as const

const FORBIDDEN_SOURCE_PATTERNS = [
  /sendPushNotification/,
  /web-push/,
  /PushSubscription/,
  /serviceWorker\.register/,
  /Notification\.requestPermission/,
  /executeSequenceBranch/i,
  /runBranchExecution/i,
  /queueSequenceStepTransportJob/,
  /insertGrowthOutreachQueueItem/,
  /runGrowthAiCopilotGeneration/,
  /emitGrowthNotification/,
] as const

const SHARE_PAGE_DEDUPE_EXPECTATIONS: Record<
  (typeof GROWTH_OPERATOR_NOTIFICATION_SHARE_PAGE_EVENTS)[number],
  string
> = {
  share_page_viewed: "fifteen_minutes",
  share_page_engaged: "fifteen_minutes",
  share_page_cta_clicked: "one_hour",
  share_page_booking_started: "one_hour",
  share_page_booking_completed: "never",
}

function runLocalRegression(): void {
  console.log(`\n=== SN-3 local regression (${GROWTH_SHARE_PAGE_OPERATOR_NOTIFICATIONS_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_SHARE_PAGE_OPERATOR_NOTIFICATIONS_QA_MARKER, "growth-share-page-notifications-sn3-v1")
  console.log("  ✓ QA marker")

  for (const relativePath of SN3_MODULE_PATHS) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ SN-3 module files exist")

  const analyticsSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/share-pages/share-page-analytics-service.ts"),
    "utf8",
  )
  assert.match(analyticsSource, /emitSharePageOperatorNotificationSafely/)
  assert.match(analyticsSource, /emitSharePageOperatorNotification\(admin, input\)\.catch\(\(\) => undefined\)/)
  for (const event of GROWTH_OPERATOR_NOTIFICATION_SHARE_PAGE_EVENTS) {
    assert.match(analyticsSource, new RegExp(`event: "${event}"`))
  }
  console.log("  ✓ analytics service wired with safe catch")

  for (const event of GROWTH_OPERATOR_NOTIFICATION_SHARE_PAGE_EVENTS) {
    const first = buildGrowthSharePageOperatorNotificationContent({
      event,
      companyLabel: "Acme HVAC",
      ctaLabel: event === "share_page_cta_clicked" ? "Book a demo" : null,
    })
    const second = buildGrowthSharePageOperatorNotificationContent({
      event,
      companyLabel: "Acme HVAC",
      ctaLabel: event === "share_page_cta_clicked" ? "Book a demo" : null,
    })
    assert.deepEqual(first, second)
    assert.ok(first.title.length > 0)
    assert.ok(first.body.includes("Acme HVAC"))
    assert.doesNotMatch(first.body, /@/)
    assert.doesNotMatch(first.body, /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/)
  }

  const fallbackBody = buildGrowthSharePageOperatorNotificationContent({
    event: "share_page_viewed",
    companyLabel: "   ",
  })
  assert.ok(fallbackBody.body.includes("Lead viewed"))
  console.log("  ✓ deterministic title/body without unsafe PII")

  const withOwner = resolveSharePageOperatorNotificationRecipients(
    buildSharePageOperatorNotificationRoutingContext({
      leadOwnerUserId: "11111111-1111-4111-8111-111111111111",
    }),
  )
  assert.deepEqual(withOwner, [
    { role: "lead_owner", userId: "11111111-1111-4111-8111-111111111111" },
  ])

  const withoutOwner = resolveSharePageOperatorNotificationRecipients(
    buildSharePageOperatorNotificationRoutingContext({ leadOwnerUserId: null }),
  )
  assert.deepEqual(withoutOwner, [{ role: "platform_admin", userId: null }])
  console.log("  ✓ routing: lead owner or platform admin fallback")

  for (const [event, rule] of Object.entries(SHARE_PAGE_DEDUPE_EXPECTATIONS)) {
    assert.equal(resolveGrowthOperatorNotificationDedupeRule(event as keyof typeof SHARE_PAGE_DEDUPE_EXPECTATIONS), rule)
  }
  console.log("  ✓ share page dedupe rules")

  for (const relativePath of SN3_MODULE_PATHS) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    for (const pattern of FORBIDDEN_SOURCE_PATTERNS) {
      assert.doesNotMatch(source, pattern, `${relativePath} must not contain ${pattern}`)
    }
  }
  console.log("  ✓ no delivery, push, or autonomous action code")

  console.log("\nSN-3 local regression PASS\n")
}

async function resolveSn3CertUserId(admin: SupabaseClient): Promise<string> {
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

function buildCertSharePage(input: { leadId: string }): GrowthSharePage {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    leadId: input.leadId,
    organizationId: "00000000-0000-4000-8000-000000000099",
    enrollmentId: null,
    sequenceEnrollmentStepId: null,
    sequenceStepId: null,
    sequenceExecutionJobId: null,
    campaignId: null,
    companyId: null,
    sourceChannel: "manual",
    status: "published",
    tokenPrefix: "cert",
    publishedAt: null,
    expiresAt: null,
    revokedAt: null,
    archivedAt: null,
    firstViewedAt: null,
    lastViewedAt: null,
    maxViews: null,
    engagementSummary: {
      viewCount: 0,
      uniqueSessionCount: 0,
      ctaClickCount: 0,
      bookingStartedCount: 0,
      bookingCompletedCount: 0,
      resourceOpenCount: 0,
      maxScrollDepthPct: 0,
      avgDurationMs: 0,
      lastActivityAt: null,
    },
    personalizationSnapshot: {},
    personalizationContextVersion: 1,
    sourcesUsed: [],
    evidenceCoverageScore: null,
    theme: {
      brandColor: "#059669",
      accentColor: "#047857",
      logoUrl: null,
      heroImageUrl: null,
      publicThemeMode: "system",
      footerNote: null,
    },
    headline: "Cert",
    subheadline: null,
    heroMessage: "Cert",
    whyReachingOut: null,
    companyObservations: [],
    ctaConfig: [],
    resources: [],
    bookingPageId: null,
    heroMediaType: "none",
    heroMediaUrl: null,
    heroMediaThumbnailUrl: null,
    voiceAssetId: null,
    videoAssetId: null,
    createdBy: null,
    approvedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

async function runIntegrationDiagnostics(admin: SupabaseClient): Promise<Record<string, unknown>> {
  const certUserId = await resolveSn3CertUserId(admin)
  const sharePageViewId = `00000000-0000-4000-8000-${Date.now().toString().slice(-12)}`
  const page = buildCertSharePage({
    leadId: "00000000-0000-4000-8000-000000000002",
  })

  const created = await emitSharePageOperatorNotification(admin, {
    event: "share_page_viewed",
    page,
    sharePageViewId,
    companyLabel: "Certification Co",
    leadOwnerUserId: certUserId,
    occurredAt: new Date().toISOString(),
  })
  assert.ok(created.created >= 1)

  const duplicate = await emitSharePageOperatorNotification(admin, {
    event: "share_page_viewed",
    page,
    sharePageViewId,
    companyLabel: "Certification Co",
    leadOwnerUserId: certUserId,
    occurredAt: new Date().toISOString(),
  })
  assert.equal(duplicate.created, 0)

  const { deleteNotificationsByIds, listNotifications } = await import(
    "../lib/growth/notifications/growth-notification-repository"
  )
  const listed = await listNotifications(admin, {
    recipientUserId: certUserId,
    limit: 20,
  })
  const certRows = listed.items.filter(
    (row) =>
      row.eventType === "share_page_viewed" &&
      row.payload &&
      typeof row.payload === "object" &&
      (row.payload as { share_page_view_id?: string }).share_page_view_id === sharePageViewId,
  )
  assert.ok(certRows.length >= 1)
  await deleteNotificationsByIds(
    admin,
    certRows.map((row) => row.id),
  )

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_SHARE_PAGE_OPERATOR_NOTIFICATIONS_QA_MARKER,
    integration_crud: true,
    cert_rows_created: certRows.length,
    dedupe_skipped_on_duplicate: duplicate.skipped >= 1,
    live_schema_verified: true,
  }
}

async function runProductionDiagnostics(): Promise<Record<string, unknown>> {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_SHARE_PAGE_OPERATOR_NOTIFICATIONS_QA_MARKER,
      error: "production_supabase_unavailable",
      supabase_cli_linked_project: Boolean(resolveLinkedSupabaseProjectRef()),
    }
  }

  const { executeGrowthOperatorNotificationsProductionDiagnostics } = await import(
    "../lib/growth/notifications/growth-notification-production-diagnostics"
  )
  const schema = await executeGrowthOperatorNotificationsProductionDiagnostics(boot.admin)

  return {
    ...schema,
    qa_marker: GROWTH_SHARE_PAGE_OPERATOR_NOTIFICATIONS_QA_MARKER,
    share_page_events_wired: GROWTH_OPERATOR_NOTIFICATION_SHARE_PAGE_EVENTS.length,
    share_page_dedupe_expectations: SHARE_PAGE_DEDUPE_EXPECTATIONS,
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
          qa_marker: GROWTH_SHARE_PAGE_OPERATOR_NOTIFICATIONS_QA_MARKER,
          hint: "Run pnpm test:growth-share-page-notifications:integration or :production",
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(`\n=== SN-3 ${mode} diagnostics ===\n`)

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
          qa_marker: GROWTH_SHARE_PAGE_OPERATOR_NOTIFICATIONS_QA_MARKER,
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
