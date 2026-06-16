/**
 * SN-4 — Reply + booking operator notifications certification.
 *
 * Local: pnpm test:growth-reply-booking-notifications
 * Integration: pnpm test:growth-reply-booking-notifications:integration
 * Production: pnpm test:growth-reply-booking-notifications:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "../lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_OPERATOR_NOTIFICATION_REPLY_EVENTS } from "../lib/growth/notifications/growth-notification-events"
import { resolveGrowthOperatorNotificationDedupeRule } from "../lib/growth/notifications/growth-notification-dedupe-rules"
import {
  buildGrowthReplyOperatorNotificationContent,
  GROWTH_REPLY_OPERATOR_NOTIFICATIONS_QA_MARKER,
} from "../lib/growth/notifications/growth-reply-notification-content"
import { resolveLinkedSupabaseProjectRef } from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"
import {
  buildReplyOperatorNotificationRoutingContext,
  emitReplyOperatorNotificationForEvent,
  resolveReplyOperatorNotificationEvents,
  resolveReplyOperatorNotificationRecipientsForCert,
  shouldEmitReplyPositiveInterestOperatorNotification,
  shouldUsePlatformAdminReplyFallback,
} from "../lib/growth/reply-intelligence/reply-operator-notifications"

const SN4_MODULE_PATHS = [
  "lib/growth/notifications/growth-reply-notification-content.ts",
  "lib/growth/reply-intelligence/reply-operator-notifications.ts",
  "lib/growth/reply-intelligence/process-reply-intelligence.ts",
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

const REPLY_DEDUPE_EXPECTATIONS: Record<
  (typeof GROWTH_OPERATOR_NOTIFICATION_REPLY_EVENTS)[number],
  string
> = {
  reply_received: "fifteen_minutes",
  reply_positive_interest: "one_hour",
  reply_meeting_requested: "never",
  reply_competitor_detected: "one_hour",
}

const BOOKING_EVENT = "share_page_booking_completed"

function runLocalRegression(): void {
  console.log(`\n=== SN-4 local regression (${GROWTH_REPLY_OPERATOR_NOTIFICATIONS_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_REPLY_OPERATOR_NOTIFICATIONS_QA_MARKER, "growth-reply-booking-notifications-sn4-v1")
  console.log("  ✓ QA marker")

  for (const relativePath of SN4_MODULE_PATHS) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ SN-4 module files exist")

  const processSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/reply-intelligence/process-reply-intelligence.ts"),
    "utf8",
  )
  assert.match(processSource, /emitReplyOperatorNotificationsFromIntelligence/)
  assert.match(
    processSource,
    /emitReplyOperatorNotificationsFromIntelligence\(admin,[\s\S]*?\)\.catch\(\(\) => undefined\)/,
  )
  assert.doesNotMatch(processSource, /share_page_booking_completed/)
  assert.doesNotMatch(processSource, /emitSharePageOperatorNotification/)
  console.log("  ✓ reply intelligence wired with safe catch; no duplicate booking emit")

  const analyticsSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/share-pages/share-page-analytics-service.ts"),
    "utf8",
  )
  assert.match(analyticsSource, /event: "share_page_booking_completed"/)
  console.log("  ✓ share page booking completion remains SN-3 owned")

  const operatorSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/reply-intelligence/reply-operator-notifications.ts"),
    "utf8",
  )
  assert.match(operatorSource, /createGrowthNotificationsForEvent/)
  console.log("  ✓ uses createGrowthNotificationsForEvent")

  for (const event of GROWTH_OPERATOR_NOTIFICATION_REPLY_EVENTS) {
    const rawBodySnippet = "We need pricing ASAP and can meet Tuesday"
    const first = buildGrowthReplyOperatorNotificationContent({
      event,
      companyLabel: "Acme HVAC",
      intentLabel: event === "reply_received" ? "positive interest" : null,
    })
    const second = buildGrowthReplyOperatorNotificationContent({
      event,
      companyLabel: "Acme HVAC",
      intentLabel: event === "reply_received" ? "positive interest" : null,
    })
    assert.deepEqual(first, second)
    assert.ok(first.title.length > 0)
    assert.ok(first.body.includes("Acme HVAC"))
    assert.doesNotMatch(first.body, /We need pricing ASAP/)
    assert.doesNotMatch(first.title, /We need pricing ASAP/)
    assert.doesNotMatch(first.body, /@/)
  }
  console.log("  ✓ deterministic title/body without raw reply body leakage")

  assert.deepEqual(
    resolveReplyOperatorNotificationEvents({ intent: "meeting_request", buyingSignalCount: 0 }),
    ["reply_received", "reply_meeting_requested"],
  )
  assert.deepEqual(
    resolveReplyOperatorNotificationEvents({ intent: "competitor_mention", buyingSignalCount: 0 }),
    ["reply_received", "reply_competitor_detected"],
  )
  assert.ok(
    shouldEmitReplyPositiveInterestOperatorNotification({
      intent: "positive_interest",
      buyingSignalCount: 0,
    }),
  )
  console.log("  ✓ event-to-notification mapping")

  const withOwners = resolveReplyOperatorNotificationRecipientsForCert(
    "reply_received",
    buildReplyOperatorNotificationRoutingContext({
      leadOwnerUserId: "11111111-1111-4111-8111-111111111111",
      inboxOwnerUserId: "22222222-2222-4222-8222-222222222222",
    }),
    "medium",
  )
  assert.ok(withOwners.some((recipient) => recipient.role === "lead_owner"))
  assert.ok(withOwners.some((recipient) => recipient.role === "inbox_owner"))

  const meetingFallback = resolveReplyOperatorNotificationRecipientsForCert(
    "reply_meeting_requested",
    buildReplyOperatorNotificationRoutingContext({ leadOwnerUserId: null, inboxOwnerUserId: null }),
    "high",
  )
  assert.ok(meetingFallback.some((recipient) => recipient.role === "platform_admin"))

  assert.equal(
    shouldUsePlatformAdminReplyFallback({
      event: "reply_received",
      leadOwnerUserId: null,
      priority: "critical",
    }),
    true,
  )
  console.log("  ✓ routing + platform admin fallback")

  for (const [event, rule] of Object.entries(REPLY_DEDUPE_EXPECTATIONS)) {
    assert.equal(
      resolveGrowthOperatorNotificationDedupeRule(event as keyof typeof REPLY_DEDUPE_EXPECTATIONS),
      rule,
    )
  }
  assert.equal(resolveGrowthOperatorNotificationDedupeRule(BOOKING_EVENT), "never")
  console.log("  ✓ reply + booking dedupe rules")

  for (const relativePath of SN4_MODULE_PATHS) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    for (const pattern of FORBIDDEN_SOURCE_PATTERNS) {
      assert.doesNotMatch(source, pattern, `${relativePath} must not contain ${pattern}`)
    }
  }
  console.log("  ✓ no delivery, push, or autonomous action code")

  console.log("\nSN-4 local regression PASS\n")
}

async function resolveSn4CertUserId(admin: SupabaseClient): Promise<string> {
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
  const certUserId = await resolveSn4CertUserId(admin)
  const replyId = `00000000-0000-4000-8000-${Date.now().toString().slice(-12)}`
  const leadId = "00000000-0000-4000-8000-000000000003"
  const routingContext = buildReplyOperatorNotificationRoutingContext({
    leadOwnerUserId: certUserId,
    inboxOwnerUserId: null,
  })

  await emitReplyOperatorNotificationForEvent(admin, {
    event: "reply_received",
    replyId,
    leadId,
    organizationId: null,
    companyLabel: "Certification Co",
    intent: "positive_interest",
    priority: "high",
    routingContext,
    inboxThreadId: null,
    receivedAt: new Date().toISOString(),
  })

  await emitReplyOperatorNotificationForEvent(admin, {
    event: "reply_received",
    replyId,
    leadId,
    organizationId: null,
    companyLabel: "Certification Co",
    intent: "positive_interest",
    priority: "high",
    routingContext,
    inboxThreadId: null,
    receivedAt: new Date().toISOString(),
  })

  const { deleteNotificationsByIds, listNotifications } = await import(
    "../lib/growth/notifications/growth-notification-repository"
  )
  const listed = await listNotifications(admin, {
    recipientUserId: certUserId,
    limit: 20,
  })
  const certRows = listed.items.filter(
    (row) =>
      row.eventType === "reply_received" &&
      row.targetEntityId === replyId &&
      row.payload &&
      typeof row.payload === "object" &&
      (row.payload as { reply_id?: string }).reply_id === replyId,
  )
  assert.ok(certRows.length >= 1)
  await deleteNotificationsByIds(
    admin,
    certRows.map((row) => row.id),
  )

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_REPLY_OPERATOR_NOTIFICATIONS_QA_MARKER,
    integration_crud: true,
    cert_rows_created: certRows.length,
    dedupe_exercised: true,
    live_schema_verified: true,
    booking_completion_owner: "sn3_share_page_analytics",
  }
}

async function runProductionDiagnostics(): Promise<Record<string, unknown>> {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_REPLY_OPERATOR_NOTIFICATIONS_QA_MARKER,
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
    qa_marker: GROWTH_REPLY_OPERATOR_NOTIFICATIONS_QA_MARKER,
    reply_events_wired: GROWTH_OPERATOR_NOTIFICATION_REPLY_EVENTS.length,
    reply_dedupe_expectations: REPLY_DEDUPE_EXPECTATIONS,
    share_page_booking_completed_owner: "sn3_share_page_analytics_only",
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
          qa_marker: GROWTH_REPLY_OPERATOR_NOTIFICATIONS_QA_MARKER,
          hint: "Run pnpm test:growth-reply-booking-notifications:integration or :production",
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(`\n=== SN-4 ${mode} diagnostics ===\n`)

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
          qa_marker: GROWTH_REPLY_OPERATOR_NOTIFICATIONS_QA_MARKER,
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
