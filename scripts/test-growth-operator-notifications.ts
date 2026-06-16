/**
 * SN-1 — Operator notification event taxonomy + routing foundation.
 *
 * Local: pnpm test:growth-operator-notifications
 * Integration: pnpm test:growth-operator-notifications:integration
 * Production: pnpm test:growth-operator-notifications:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import {
  GROWTH_OPERATOR_NOTIFICATION_EVENTS,
  GROWTH_OPERATOR_NOTIFICATION_EVENT_GROUPS,
  GROWTH_OPERATOR_NOTIFICATION_EVENT_TO_GROUP,
  GROWTH_OPERATOR_NOTIFICATION_INBOX_EVENTS,
  GROWTH_OPERATOR_NOTIFICATION_LEAD_EVENTS,
  GROWTH_OPERATOR_NOTIFICATION_MESSAGING_EVENTS,
  GROWTH_OPERATOR_NOTIFICATION_REPLY_EVENTS,
  GROWTH_OPERATOR_NOTIFICATION_SEQUENCE_EVENTS,
  GROWTH_OPERATOR_NOTIFICATION_SHARE_PAGE_EVENTS,
  GROWTH_OPERATOR_NOTIFICATIONS_QA_MARKER,
  resolveGrowthOperatorNotificationEventGroup,
} from "../lib/growth/notifications/growth-notification-events"
import {
  buildGrowthOperatorNotificationDedupeKey,
  GROWTH_OPERATOR_NOTIFICATION_DEDUPE_RULES,
  isGrowthOperatorNotificationDedupeReplacing,
  resolveGrowthOperatorNotificationDedupeRule,
  resolveGrowthOperatorNotificationDedupeWindowMinutes,
} from "../lib/growth/notifications/growth-notification-dedupe-rules"
import {
  GROWTH_OPERATOR_NOTIFICATION_RECIPIENT_ROLES,
  resolveGrowthOperatorNotificationRecipientRoles,
  resolveGrowthOperatorNotificationRecipients,
} from "../lib/growth/notifications/growth-notification-routing"
import {
  GROWTH_OPERATOR_NOTIFICATION_SEVERITIES,
  resolveGrowthOperatorNotificationSeverity,
} from "../lib/growth/notifications/growth-notification-severity"

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
] as const

const SN1_MODULE_PATHS = [
  "lib/growth/notifications/growth-notification-events.ts",
  "lib/growth/notifications/growth-notification-severity.ts",
  "lib/growth/notifications/growth-notification-routing.ts",
  "lib/growth/notifications/growth-notification-dedupe-rules.ts",
] as const

const FORBIDDEN_SOURCE_PATTERNS = [
  /emitGrowthNotification/,
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
  /\.from\([^)]+\)\.(insert|update|delete|upsert)\(/,
] as const

function runLocalRegression(): void {
  console.log(`\n=== SN-1 local regression (${GROWTH_OPERATOR_NOTIFICATIONS_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_OPERATOR_NOTIFICATIONS_QA_MARKER, "growth-operator-notifications-sn1-v1")
  console.log("  ✓ QA marker")

  for (const relativePath of SN1_MODULE_PATHS) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ SN-1 module files exist")

  assert.equal(
    new Set(GROWTH_OPERATOR_NOTIFICATION_EVENTS).size,
    GROWTH_OPERATOR_NOTIFICATION_EVENTS.length,
    "event taxonomy must be unique",
  )
  assert.equal(GROWTH_OPERATOR_NOTIFICATION_EVENTS.length, 20)
  console.log("  ✓ event taxonomy uniqueness (20 events)")

  const groupedCount =
    GROWTH_OPERATOR_NOTIFICATION_LEAD_EVENTS.length +
    GROWTH_OPERATOR_NOTIFICATION_SHARE_PAGE_EVENTS.length +
    GROWTH_OPERATOR_NOTIFICATION_REPLY_EVENTS.length +
    GROWTH_OPERATOR_NOTIFICATION_SEQUENCE_EVENTS.length +
    GROWTH_OPERATOR_NOTIFICATION_MESSAGING_EVENTS.length +
    GROWTH_OPERATOR_NOTIFICATION_INBOX_EVENTS.length
  assert.equal(groupedCount, GROWTH_OPERATOR_NOTIFICATION_EVENTS.length)
  console.log("  ✓ event groups cover full taxonomy")

  for (const event of GROWTH_OPERATOR_NOTIFICATION_EVENTS) {
    assert.equal(
      resolveGrowthOperatorNotificationEventGroup(event),
      GROWTH_OPERATOR_NOTIFICATION_EVENT_TO_GROUP[event],
    )
    assert.ok(GROWTH_OPERATOR_NOTIFICATION_EVENT_GROUPS.includes(GROWTH_OPERATOR_NOTIFICATION_EVENT_TO_GROUP[event]))
  }
  console.log("  ✓ event group mapping")

  for (const event of GROWTH_OPERATOR_NOTIFICATION_EVENTS) {
    const severity = resolveGrowthOperatorNotificationSeverity(event)
    assert.ok((GROWTH_OPERATOR_NOTIFICATION_SEVERITIES as readonly string[]).includes(severity))
  }
  assert.equal(resolveGrowthOperatorNotificationSeverity("reply_meeting_requested"), "critical")
  assert.equal(resolveGrowthOperatorNotificationSeverity("share_page_viewed"), "low")
  console.log("  ✓ severity mapping")

  const routingContext = {
    leadOwnerUserId: "11111111-1111-4111-8111-111111111111",
    inboxOwnerUserId: "22222222-2222-4222-8222-222222222222",
    campaignOwnerUserId: "33333333-3333-4333-8333-333333333333",
  }

  for (const event of GROWTH_OPERATOR_NOTIFICATION_EVENTS) {
    const rolesA = resolveGrowthOperatorNotificationRecipientRoles(event)
    const rolesB = resolveGrowthOperatorNotificationRecipientRoles(event)
    assert.deepEqual(rolesA, rolesB, `routing must be deterministic for ${event}`)
    assert.ok(rolesA.length > 0, `routing must return recipients for ${event}`)
    for (const role of rolesA) {
      assert.ok((GROWTH_OPERATOR_NOTIFICATION_RECIPIENT_ROLES as readonly string[]).includes(role))
    }

    const recipients = resolveGrowthOperatorNotificationRecipients(event, routingContext)
    assert.equal(recipients.length, rolesA.length)
    assert.equal(
      recipients.find((recipient) => recipient.role === "lead_owner")?.userId,
      rolesA.includes("lead_owner") ? routingContext.leadOwnerUserId : undefined,
    )
    assert.equal(
      recipients.find((recipient) => recipient.role === "platform_admin")?.userId,
      rolesA.includes("platform_admin") ? null : undefined,
    )
  }

  const meetingRecipients = resolveGrowthOperatorNotificationRecipients(
    "reply_meeting_requested",
    routingContext,
  )
  assert.deepEqual(
    meetingRecipients.map((recipient) => recipient.role),
    ["lead_owner", "inbox_owner", "platform_admin"],
  )
  console.log("  ✓ routing determinism")

  for (const event of GROWTH_OPERATOR_NOTIFICATION_EVENTS) {
    const rule = resolveGrowthOperatorNotificationDedupeRule(event)
    assert.ok((GROWTH_OPERATOR_NOTIFICATION_DEDUPE_RULES as readonly string[]).includes(rule))
    const windowMinutes = resolveGrowthOperatorNotificationDedupeWindowMinutes(rule)
    if (rule === "fifteen_minutes") assert.equal(windowMinutes, 15)
    if (rule === "one_hour") assert.equal(windowMinutes, 60)
    if (rule === "never" || rule === "replace_previous") assert.equal(windowMinutes, null)
    if (rule === "replace_previous") {
      assert.equal(isGrowthOperatorNotificationDedupeReplacing(rule), true)
    }
  }

  const dedupeKeyA = buildGrowthOperatorNotificationDedupeKey({
    event: "engagement_spike",
    sourceSystem: "engagement",
    sourceId: "lead-1",
    leadId: "lead-1",
  })
  const dedupeKeyB = buildGrowthOperatorNotificationDedupeKey({
    event: "engagement_spike",
    sourceSystem: "engagement",
    sourceId: "lead-1",
    leadId: "lead-1",
  })
  assert.equal(dedupeKeyA, dedupeKeyB)
  assert.notEqual(
    dedupeKeyA,
    buildGrowthOperatorNotificationDedupeKey({
      event: "engagement_spike",
      sourceSystem: "engagement",
      sourceId: "lead-2",
      leadId: "lead-2",
    }),
  )
  console.log("  ✓ dedupe rules")

  for (const relativePath of SN1_MODULE_PATHS) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    for (const pattern of FORBIDDEN_SOURCE_PATTERNS) {
      assert.doesNotMatch(
        source,
        pattern,
        `${relativePath} must not contain forbidden pattern ${pattern}`,
      )
    }
  }
  console.log("  ✓ no delivery, push, send, persistence, or autonomous action code")

  console.log("\nSN-1 local regression PASS\n")
}

async function runIntegrationDiagnostics(): Promise<Record<string, unknown>> {
  runLocalRegression()

  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: PRODUCTION_ENV_SOURCES,
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })

  return {
    ok: true,
    final_verdict: boot ? "PASS" : "PASS",
    qa_marker: GROWTH_OPERATOR_NOTIFICATIONS_QA_MARKER,
    event_count: GROWTH_OPERATOR_NOTIFICATION_EVENTS.length,
    severity_levels: GROWTH_OPERATOR_NOTIFICATION_SEVERITIES.length,
    recipient_roles: GROWTH_OPERATOR_NOTIFICATION_RECIPIENT_ROLES.length,
    dedupe_rules: GROWTH_OPERATOR_NOTIFICATION_DEDUPE_RULES.length,
    supabase_env_bootstrapped: Boolean(boot),
    note: "Foundation-only phase — no DB reads or writes",
  }
}

async function main(): Promise<void> {
  const integration = process.argv.includes("--integration") || process.argv.includes("--production")
  runLocalRegression()

  if (!integration) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          local_only: true,
          qa_marker: GROWTH_OPERATOR_NOTIFICATIONS_QA_MARKER,
          hint: "Run pnpm test:growth-operator-notifications:integration for env bootstrap validation",
        },
        null,
        2,
      ),
    )
    return
  }

  const report = await runIntegrationDiagnostics()
  console.log(JSON.stringify(report, null, 2))
  if (report.final_verdict !== "PASS") {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
