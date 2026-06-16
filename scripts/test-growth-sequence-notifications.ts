/**
 * SN-5 — Sequence branch + wait operator notifications certification.
 *
 * Local: pnpm test:growth-sequence-notifications
 * Integration: pnpm test:growth-sequence-notifications:integration
 * Production: pnpm test:growth-sequence-notifications:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "../lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_OPERATOR_NOTIFICATION_SEQUENCE_EVENTS } from "../lib/growth/notifications/growth-notification-events"
import { resolveGrowthOperatorNotificationDedupeRule } from "../lib/growth/notifications/growth-notification-dedupe-rules"
import { resolveGrowthOperatorNotificationRecipients } from "../lib/growth/notifications/growth-notification-routing"
import {
  buildGrowthSequenceOperatorNotificationContent,
  formatSequenceWaitedForEventLabel,
  GROWTH_SEQUENCE_OPERATOR_NOTIFICATIONS_QA_MARKER,
} from "../lib/growth/notifications/growth-sequence-notification-content"
import { resolveLinkedSupabaseProjectRef } from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"
import {
  buildSequenceOperatorNotificationDedupeSourceId,
  shouldUseSequenceAdvancementBlockedPlatformAdminFallback,
} from "../lib/growth/sequences/conditions/sequence-operator-notifications"

const SN5_MODULE_PATHS = [
  "lib/growth/notifications/growth-sequence-notification-content.ts",
  "lib/growth/sequences/conditions/sequence-operator-notifications.ts",
  "lib/growth/sequences/conditions/sequence-branch-audit.ts",
  "lib/growth/sequences/conditions/sequence-branch-advance-gate.ts",
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

const SEQUENCE_DEDUPE_EXPECTATIONS: Record<
  (typeof GROWTH_OPERATOR_NOTIFICATION_SEQUENCE_EVENTS)[number],
  string
> = {
  sequence_wait_started: "one_hour",
  sequence_wait_resolved: "never",
  sequence_wait_timeout: "never",
  sequence_branch_evaluated: "fifteen_minutes",
  sequence_advancement_blocked: "never",
}

const AUDIT_TO_OPERATOR_EVENT: Record<string, string> = {
  wait_started: "sequence_wait_started",
  wait_resolved: "sequence_wait_resolved",
  condition_timeout: "sequence_wait_timeout",
  branch_evaluated: "sequence_branch_evaluated",
  advancement_blocked: "sequence_advancement_blocked",
}

function runLocalRegression(): void {
  console.log(`\n=== SN-5 local regression (${GROWTH_SEQUENCE_OPERATOR_NOTIFICATIONS_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_SEQUENCE_OPERATOR_NOTIFICATIONS_QA_MARKER, "growth-sequence-notifications-sn5-v1")
  console.log("  ✓ QA marker")

  for (const relativePath of SN5_MODULE_PATHS) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ SN-5 module files exist")

  const auditSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/conditions/sequence-branch-audit.ts"),
    "utf8",
  )
  const gateSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/conditions/sequence-branch-advance-gate.ts"),
    "utf8",
  )
  const operatorSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sequences/conditions/sequence-operator-notifications.ts"),
    "utf8",
  )

  assert.match(operatorSource, /createGrowthNotificationsForEvent/)
  assert.match(auditSource, /emitSequenceOperatorNotificationSafely/)
  assert.match(gateSource, /emitSequenceOperatorNotificationSafely/)
  for (const [auditKind, operatorEvent] of Object.entries(AUDIT_TO_OPERATOR_EVENT)) {
    if (auditKind === "advancement_blocked") continue
    assert.match(auditSource, new RegExp(`eventKind: "${auditKind}"`))
    assert.match(auditSource, new RegExp(`event: "${operatorEvent}"`))
  }
  assert.match(gateSource, /event: "sequence_advancement_blocked"/)
  console.log("  ✓ audit persistence wired before operator notifications")

  for (const event of GROWTH_OPERATOR_NOTIFICATION_SEQUENCE_EVENTS) {
    const first = buildGrowthSequenceOperatorNotificationContent({
      event,
      companyLabel: "Acme HVAC",
      campaignLabel: "HVAC Outbound",
      waitedForEventLabel: event === "sequence_wait_started" ? "email.opened" : null,
      resolutionReason: event === "sequence_wait_resolved" ? "matched" : null,
      blockReason: event === "sequence_advancement_blocked" ? "enrollment_paused" : null,
    })
    const second = buildGrowthSequenceOperatorNotificationContent({
      event,
      companyLabel: "Acme HVAC",
      campaignLabel: "HVAC Outbound",
      waitedForEventLabel: event === "sequence_wait_started" ? "email.opened" : null,
      resolutionReason: event === "sequence_wait_resolved" ? "matched" : null,
      blockReason: event === "sequence_advancement_blocked" ? "enrollment_paused" : null,
    })
    assert.deepEqual(first, second)
    assert.ok(first.body.includes("Acme HVAC"))
    assert.doesNotMatch(first.body, /@/)
  }
  assert.equal(formatSequenceWaitedForEventLabel("email.opened"), "email opened")
  console.log("  ✓ deterministic title/body")

  const routingContext = {
    leadOwnerUserId: "11111111-1111-4111-8111-111111111111",
    inboxOwnerUserId: null,
    campaignOwnerUserId: "33333333-3333-4333-8333-333333333333",
  }
  assert.ok(
    resolveGrowthOperatorNotificationRecipients("sequence_wait_started", routingContext).some(
      (recipient) => recipient.role === "campaign_owner",
    ),
  )
  assert.ok(
    resolveGrowthOperatorNotificationRecipients("sequence_wait_resolved", routingContext).some(
      (recipient) => recipient.role === "lead_owner",
    ),
  )
  assert.equal(
    shouldUseSequenceAdvancementBlockedPlatformAdminFallback({
      leadOwnerUserId: null,
      inboxOwnerUserId: null,
      campaignOwnerUserId: null,
    }),
    true,
  )
  console.log("  ✓ routing expectations")

  for (const [event, rule] of Object.entries(SEQUENCE_DEDUPE_EXPECTATIONS)) {
    assert.equal(
      resolveGrowthOperatorNotificationDedupeRule(event as keyof typeof SEQUENCE_DEDUPE_EXPECTATIONS),
      rule,
    )
  }
  const dedupeKey = buildSequenceOperatorNotificationDedupeSourceId({
    enrollmentStepId: "step-1",
    waitId: "wait-1",
    branchDecisionId: "edge-1",
  })
  assert.match(dedupeKey, /step-1/)
  assert.match(dedupeKey, /wait-1/)
  assert.match(dedupeKey, /edge-1/)
  console.log("  ✓ dedupe rules + dedupe source id shape")

  for (const relativePath of SN5_MODULE_PATHS) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    for (const pattern of FORBIDDEN_SOURCE_PATTERNS) {
      assert.doesNotMatch(source, pattern, `${relativePath} must not contain ${pattern}`)
    }
  }
  console.log("  ✓ no delivery, push, or autonomous action code")

  console.log("\nSN-5 local regression PASS\n")
}

async function resolveSn5CertUserId(admin: SupabaseClient): Promise<string> {
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
  const certUserId = await resolveSn5CertUserId(admin)
  const enrollmentId = "00000000-0000-4000-8000-000000000010"
  const enrollmentStepId = `00000000-0000-4000-8000-${Date.now().toString().slice(-12)}`
  const leadId = "00000000-0000-4000-8000-000000000011"

  const content = buildGrowthSequenceOperatorNotificationContent({
    event: "sequence_wait_started",
    companyLabel: "Certification Co",
    campaignLabel: "Cert Sequence",
    waitedForEventLabel: "email.opened",
  })

  const { createGrowthNotificationsForEvent } = await import(
    "../lib/growth/notifications/growth-notification-service"
  )

  await createGrowthNotificationsForEvent(admin, {
    organizationId: null,
    event: "sequence_wait_started",
    title: content.title,
    body: content.body,
    payload: {
      qa_marker: GROWTH_SEQUENCE_OPERATOR_NOTIFICATIONS_QA_MARKER,
      enrollment_id: enrollmentId,
      enrollment_step_id: enrollmentStepId,
      lead_id: leadId,
      cert: true,
    },
    targetEntityType: "sequence_enrollment",
    targetEntityId: enrollmentId,
    routingContext: {
      campaignOwnerUserId: certUserId,
      leadOwnerUserId: null,
      inboxOwnerUserId: null,
    },
    dedupe: {
      sourceSystem: "sequence_branch_wait",
      sourceId: buildSequenceOperatorNotificationDedupeSourceId({
        enrollmentStepId,
        waitId: "00000000-0000-4000-8000-000000000012",
        branchDecisionId: "cond-1",
      }),
      leadId,
      enrollmentId,
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
      row.eventType === "sequence_wait_started" &&
      row.payload &&
      typeof row.payload === "object" &&
      (row.payload as { enrollment_step_id?: string }).enrollment_step_id === enrollmentStepId,
  )
  assert.ok(certRows.length >= 1)
  await deleteNotificationsByIds(
    admin,
    certRows.map((row) => row.id),
  )

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_SEQUENCE_OPERATOR_NOTIFICATIONS_QA_MARKER,
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
      qa_marker: GROWTH_SEQUENCE_OPERATOR_NOTIFICATIONS_QA_MARKER,
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
    qa_marker: GROWTH_SEQUENCE_OPERATOR_NOTIFICATIONS_QA_MARKER,
    sequence_events_wired: GROWTH_OPERATOR_NOTIFICATION_SEQUENCE_EVENTS.length,
    sequence_dedupe_expectations: SEQUENCE_DEDUPE_EXPECTATIONS,
    audit_to_operator_mapping: AUDIT_TO_OPERATOR_EVENT,
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
          qa_marker: GROWTH_SEQUENCE_OPERATOR_NOTIFICATIONS_QA_MARKER,
          hint: "Run pnpm test:growth-sequence-notifications:integration or :production",
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(`\n=== SN-5 ${mode} diagnostics ===\n`)

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
          qa_marker: GROWTH_SEQUENCE_OPERATOR_NOTIFICATIONS_QA_MARKER,
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
