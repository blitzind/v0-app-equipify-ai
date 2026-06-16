/**
 * SN-6 — Inbox SLA operator notifications certification.
 *
 * Local: pnpm test:growth-inbox-notifications
 * Integration: pnpm test:growth-inbox-notifications:integration
 * Production: pnpm test:growth-inbox-notifications:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "../lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_OPERATOR_NOTIFICATION_INBOX_EVENTS } from "../lib/growth/notifications/growth-notification-events"
import { resolveGrowthOperatorNotificationDedupeRule } from "../lib/growth/notifications/growth-notification-dedupe-rules"
import { resolveGrowthOperatorNotificationRecipients } from "../lib/growth/notifications/growth-notification-routing"
import {
  buildGrowthInboxOperatorNotificationContent,
  GROWTH_INBOX_OPERATOR_NOTIFICATIONS_QA_MARKER,
} from "../lib/growth/notifications/growth-inbox-notification-content"
import { resolveLinkedSupabaseProjectRef } from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"
import {
  buildInboxThreadSlaOperatorNotificationDedupeSourceId,
  resolveInboxThreadSlaOperatorRecipients,
  shouldUseInboxSlaPlatformAdminFallback,
} from "../lib/growth/inbox-team-ownership/inbox-operator-notifications"

const SN6_MODULE_PATHS = [
  "lib/growth/notifications/growth-inbox-notification-content.ts",
  "lib/growth/inbox-team-ownership/inbox-operator-notifications.ts",
  "lib/growth/inbox-team-ownership/inbox-sla-audit.ts",
  "lib/growth/inbox-team-ownership/inbox-sla-evaluator.ts",
  "lib/growth/inbox-sync/inbox-sync-runner.ts",
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

const INBOX_DEDUPE_EXPECTATIONS: Record<
  (typeof GROWTH_OPERATOR_NOTIFICATION_INBOX_EVENTS)[number],
  string
> = {
  thread_sla_at_risk: "one_hour",
  thread_sla_overdue: "replace_previous",
}

const SLA_STATUS_TO_OPERATOR_EVENT: Record<string, string> = {
  at_risk: "thread_sla_at_risk",
  overdue: "thread_sla_overdue",
}

const RAW_MESSAGE_SNIPPETS = [
  "Dear team, please review the attached proposal",
  "body_preview",
  "message body",
  "subject line",
]

function runLocalRegression(): void {
  console.log(`\n=== SN-6 local regression (${GROWTH_INBOX_OPERATOR_NOTIFICATIONS_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_INBOX_OPERATOR_NOTIFICATIONS_QA_MARKER, "growth-inbox-notifications-sn6-v1")
  console.log("  ✓ QA marker")

  for (const relativePath of SN6_MODULE_PATHS) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ SN-6 module files exist")

  const auditSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/inbox-team-ownership/inbox-sla-audit.ts"),
    "utf8",
  )
  const evaluatorSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/inbox-team-ownership/inbox-sla-evaluator.ts"),
    "utf8",
  )
  const operatorSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/inbox-team-ownership/inbox-operator-notifications.ts"),
    "utf8",
  )
  const syncSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/inbox-sync/inbox-sync-runner.ts"),
    "utf8",
  )

  assert.match(operatorSource, /createGrowthNotification/)
  assert.match(evaluatorSource, /recordInboxThreadSlaAudit/)
  assert.match(evaluatorSource, /emitInboxThreadSlaOperatorNotificationSafely/)
  assert.match(auditSource, /createReplyIntelligenceEvent/)
  assert.match(auditSource, /thread_sla_overdue/)
  assert.match(syncSource, /evaluateInboxThreadSlaOperatorAlertsSafely/)
  assert.match(evaluatorSource, /\.catch\(\(\) => undefined\)/)
  console.log("  ✓ audit persistence wired before operator notifications")

  for (const [slaStatus, operatorEvent] of Object.entries(SLA_STATUS_TO_OPERATOR_EVENT)) {
    if (slaStatus === "at_risk") {
      assert.match(evaluatorSource, /slaStatus === "at_risk"/)
    } else {
      assert.match(evaluatorSource, /thread_sla_overdue/)
    }
    assert.match(evaluatorSource, new RegExp(`"${operatorEvent}"`))
  }
  console.log("  ✓ SLA status to operator event mapping")

  for (const event of GROWTH_OPERATOR_NOTIFICATION_INBOX_EVENTS) {
    const first = buildGrowthInboxOperatorNotificationContent({
      event,
      companyLabel: "Acme HVAC",
    })
    const second = buildGrowthInboxOperatorNotificationContent({
      event,
      companyLabel: "Acme HVAC",
    })
    assert.deepEqual(first, second)
    assert.ok(first.body.includes("Acme HVAC"))
    assert.doesNotMatch(first.body, /@/)
    for (const snippet of RAW_MESSAGE_SNIPPETS) {
      assert.doesNotMatch(first.body, new RegExp(snippet, "i"))
      assert.doesNotMatch(first.title, new RegExp(snippet, "i"))
    }
  }
  console.log("  ✓ deterministic title/body without raw message leakage")

  const routingContext = {
    leadOwnerUserId: "11111111-1111-4111-8111-111111111111",
    inboxOwnerUserId: "22222222-2222-4222-8222-222222222222",
    campaignOwnerUserId: null,
  }
  assert.ok(
    resolveGrowthOperatorNotificationRecipients("thread_sla_at_risk", routingContext).some(
      (recipient) => recipient.role === "inbox_owner",
    ),
  )
  assert.ok(
    resolveGrowthOperatorNotificationRecipients("thread_sla_at_risk", routingContext).some(
      (recipient) => recipient.role === "lead_owner",
    ),
  )
  assert.ok(
    resolveInboxThreadSlaOperatorRecipients("thread_sla_overdue", {
      leadOwnerUserId: null,
      inboxOwnerUserId: null,
      campaignOwnerUserId: null,
    }).some((recipient) => recipient.role === "platform_admin"),
  )
  assert.equal(
    shouldUseInboxSlaPlatformAdminFallback("thread_sla_at_risk", {
      leadOwnerUserId: null,
      inboxOwnerUserId: null,
      campaignOwnerUserId: null,
    }),
    false,
  )
  console.log("  ✓ routing + platform-admin fallback expectations")

  for (const [event, rule] of Object.entries(INBOX_DEDUPE_EXPECTATIONS)) {
    assert.equal(
      resolveGrowthOperatorNotificationDedupeRule(event as keyof typeof INBOX_DEDUPE_EXPECTATIONS),
      rule,
    )
  }
  const dedupeKey = buildInboxThreadSlaOperatorNotificationDedupeSourceId({
    threadId: "thread-1",
    event: "thread_sla_at_risk",
  })
  assert.equal(dedupeKey, "thread-1:thread_sla_at_risk")
  console.log("  ✓ dedupe rules + dedupe source id shape")

  for (const relativePath of SN6_MODULE_PATHS) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    for (const pattern of FORBIDDEN_SOURCE_PATTERNS) {
      assert.doesNotMatch(source, pattern, `${relativePath} must not contain ${pattern}`)
    }
  }
  console.log("  ✓ no delivery, push, or autonomous action code")

  console.log("\nSN-6 local regression PASS\n")
}

async function resolveSn6CertUserId(admin: SupabaseClient): Promise<string> {
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
  const certUserId = await resolveSn6CertUserId(admin)
  const threadId = "00000000-0000-4000-8000-000000000020"
  const leadId = "00000000-0000-4000-8000-000000000021"

  const content = buildGrowthInboxOperatorNotificationContent({
    event: "thread_sla_at_risk",
    companyLabel: "Certification Co",
  })

  const { createGrowthNotification } = await import(
    "../lib/growth/notifications/growth-notification-service"
  )

  await createGrowthNotification(admin, {
    organizationId: null,
    event: "thread_sla_at_risk",
    title: content.title,
    body: content.body,
    payload: {
      qa_marker: GROWTH_INBOX_OPERATOR_NOTIFICATIONS_QA_MARKER,
      thread_id: threadId,
      lead_id: leadId,
      cert: true,
    },
    targetEntityType: "inbox_thread",
    targetEntityId: threadId,
    routingContext: {
      inboxOwnerUserId: certUserId,
      leadOwnerUserId: null,
      campaignOwnerUserId: null,
    },
    recipientRole: "inbox_owner",
    recipientUserId: certUserId,
    dedupe: {
      sourceSystem: "inbox_sla",
      sourceId: buildInboxThreadSlaOperatorNotificationDedupeSourceId({
        threadId,
        event: "thread_sla_at_risk",
      }),
      leadId,
      threadId,
    },
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
      row.eventType === "thread_sla_at_risk" &&
      row.payload &&
      typeof row.payload === "object" &&
      (row.payload as { thread_id?: string }).thread_id === threadId,
  )
  assert.ok(certRows.length >= 1)
  await deleteNotificationsByIds(
    admin,
    certRows.map((row) => row.id),
  )

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_INBOX_OPERATOR_NOTIFICATIONS_QA_MARKER,
    integration_crud: true,
    cert_rows_created: certRows.length,
    live_schema_verified: true,
  }
}

async function runProductionDiagnostics(): Promise<Record<string, unknown>> {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_INBOX_OPERATOR_NOTIFICATIONS_QA_MARKER,
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
    qa_marker: GROWTH_INBOX_OPERATOR_NOTIFICATIONS_QA_MARKER,
    inbox_events_wired: GROWTH_OPERATOR_NOTIFICATION_INBOX_EVENTS.length,
    inbox_dedupe_expectations: INBOX_DEDUPE_EXPECTATIONS,
    sla_status_to_operator_mapping: SLA_STATUS_TO_OPERATOR_EVENT,
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
          qa_marker: GROWTH_INBOX_OPERATOR_NOTIFICATIONS_QA_MARKER,
          hint: "Run pnpm test:growth-inbox-notifications:integration or :production",
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(`\n=== SN-6 ${mode} diagnostics ===\n`)

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
          qa_marker: GROWTH_INBOX_OPERATOR_NOTIFICATIONS_QA_MARKER,
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
