/**
 * SN-2 — Operator notification persistence + routing service certification.
 *
 * Local: pnpm test:growth-notifications
 * Integration: pnpm test:growth-notifications:integration
 * Production: pnpm test:growth-notifications:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "../lib/growth/notifications/growth-notification-cert-bootstrap"
import { resolveLinkedSupabaseProjectRef } from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"
import {
  GROWTH_OPERATOR_NOTIFICATION_EVENTS,
  GROWTH_OPERATOR_NOTIFICATIONS_QA_MARKER,
} from "../lib/growth/notifications/growth-notification-events"
import {
  buildGrowthOperatorNotificationDedupeKey,
  resolveGrowthOperatorNotificationDedupeRule,
} from "../lib/growth/notifications/growth-notification-dedupe-rules"
import {
  GROWTH_OPERATOR_NOTIFICATIONS_SN2_MIGRATION,
  GROWTH_OPERATOR_NOTIFICATIONS_SN2_QA_MARKER,
} from "../lib/growth/notifications/growth-notification-persistence-types"
import { resolveGrowthOperatorNotificationSeverity } from "../lib/growth/notifications/growth-notification-severity"
import { resolveGrowthOperatorNotificationRecipients } from "../lib/growth/notifications/growth-notification-routing"

const SN2_MODULE_PATHS = [
  "lib/growth/notifications/growth-notification-persistence-types.ts",
  "lib/growth/notifications/growth-notification-schema-health.ts",
  "lib/growth/notifications/growth-notification-cert-bootstrap.ts",
  "lib/growth/notifications/growth-notification-production-diagnostics.ts",
  "lib/growth/notifications/growth-notification-repository.ts",
  "lib/growth/notifications/growth-notification-service.ts",
  `supabase/migrations/${GROWTH_OPERATOR_NOTIFICATIONS_SN2_MIGRATION}`,
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

async function resolveSn2CertContext(admin: SupabaseClient): Promise<{
  userId: string
  organizationId: string | null
}> {
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, organization_id")
    .ilike("email", "%blitz%")
    .limit(1)
    .maybeSingle()

  if (profile?.id) {
    return {
      userId: profile.id,
      organizationId: typeof profile.organization_id === "string" ? profile.organization_id : null,
    }
  }

  const { data: authData, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 20 })
  if (!error) {
    const user = authData.users.find((entry) => entry.id)
    if (user?.id) {
      return { userId: user.id, organizationId: null }
    }
  }

  throw new Error("Could not resolve cert acting user from production Supabase (auth.users FK)")
}

function runLocalRegression(): void {
  console.log(`\n=== SN-2 local regression (${GROWTH_OPERATOR_NOTIFICATIONS_SN2_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_OPERATOR_NOTIFICATIONS_SN2_QA_MARKER, "growth-operator-notifications-sn2-v1")
  assert.equal(GROWTH_OPERATOR_NOTIFICATIONS_SN2_MIGRATION, "20270827120200_growth_operator_notifications_sn2.sql")
  assert.equal(GROWTH_OPERATOR_NOTIFICATIONS_QA_MARKER, "growth-operator-notifications-sn1-v1")
  console.log("  ✓ QA markers + migration id")

  for (const relativePath of SN2_MODULE_PATHS) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ SN-2 module files exist")

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_OPERATOR_NOTIFICATIONS_SN2_MIGRATION}`),
    "utf8",
  )
  for (const token of [
    "growth.operator_notifications",
    "organization_id",
    "event_type",
    "severity",
    "recipient_role",
    "recipient_user_id",
    "dedupe_key",
    "payload",
    "target_entity_type",
    "target_entity_id",
    "acknowledged_at",
    "dismissed_at",
    "expires_at",
    "idx_growth_operator_notifications_organization_id",
    "idx_growth_operator_notifications_recipient_user_id",
    "idx_growth_operator_notifications_event_type",
    "idx_growth_operator_notifications_severity",
    "idx_growth_operator_notifications_acknowledged_at",
    "idx_growth_operator_notifications_created_at",
    "idx_growth_operator_notifications_dedupe_key",
    "grant select, insert, update, delete on table growth.operator_notifications to service_role",
  ]) {
    assert.ok(migration.includes(token), `Missing migration token: ${token}`)
  }
  console.log("  ✓ migration shape")

  const serviceSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/notifications/growth-notification-service.ts"),
    "utf8",
  )
  assert.match(serviceSource, /resolveGrowthOperatorNotificationSeverity/)
  assert.match(serviceSource, /resolveGrowthOperatorNotificationRecipients/)
  assert.match(serviceSource, /resolveGrowthOperatorNotificationDedupeRule/)
  assert.match(serviceSource, /createNotification/)
  assert.doesNotMatch(serviceSource, /sendPushNotification/)
  assert.doesNotMatch(serviceSource, /emitGrowthNotification/)
  console.log("  ✓ service integrates severity, routing, dedupe, persistence")

  for (const relativePath of SN2_MODULE_PATHS.filter((entry) => entry.endsWith(".ts"))) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    for (const pattern of FORBIDDEN_SOURCE_PATTERNS) {
      assert.doesNotMatch(source, pattern, `${relativePath} must not contain ${pattern}`)
    }
  }
  console.log("  ✓ no delivery, push, or autonomous action code")

  console.log("\nSN-2 local regression PASS\n")
}

async function runRepositoryIntegration(admin: SupabaseClient): Promise<Record<string, unknown>> {
  const {
    acknowledgeNotification,
    createNotification,
    deleteNotificationsByIds,
    dismissNotification,
    expireNotifications,
    getUnreadCounts,
    listNotifications,
  } = await import("../lib/growth/notifications/growth-notification-repository")
  const { createGrowthNotificationsForEvent } = await import(
    "../lib/growth/notifications/growth-notification-service"
  )

  const certContext = await resolveSn2CertContext(admin)
  const certUserId = certContext.userId
  const certOrgId = certContext.organizationId

  const createdIds: string[] = []
  const certSourceId = `sn2-cert-${Date.now()}`
  const routingContext = {
    leadOwnerUserId: certUserId,
    inboxOwnerUserId: null,
    campaignOwnerUserId: null,
  }

  const first = await createGrowthNotificationsForEvent(admin, {
    organizationId: certOrgId,
    event: "engagement_spike",
    title: "Engagement spike",
    body: "Certification spike detected.",
    payload: { cert: true, sourceId: certSourceId },
    targetEntityType: "lead",
    targetEntityId: "lead-cert-1",
    routingContext,
    dedupe: {
      sourceSystem: "sn2-cert",
      sourceId: certSourceId,
      leadId: "lead-cert-1",
    },
  })
  assert.equal(first.created.length, 1)
  assert.equal(first.skipped.length, 0)
  createdIds.push(...first.created.map((row) => row.id))

  const second = await createGrowthNotificationsForEvent(admin, {
    organizationId: certOrgId,
    event: "engagement_spike",
    title: "Engagement spike duplicate",
    body: "Should dedupe within one hour.",
    routingContext,
    dedupe: {
      sourceSystem: "sn2-cert",
      sourceId: certSourceId,
      leadId: "lead-cert-1",
    },
  })
  assert.equal(second.created.length, 0)
  assert.ok(second.skipped.some((entry) => entry.reason === "one_hour_dedupe_window"))
  console.log("  ✓ one_hour dedupe window honored")

  const replaceEvent = "thread_sla_overdue" as const
  const replaceDedupeKey = buildGrowthOperatorNotificationDedupeKey({
    event: replaceEvent,
    sourceSystem: "sn2-cert",
    sourceId: `${certSourceId}-replace`,
    threadId: "thread-cert-1",
  })

  const replaceFirst = await createNotification(admin, {
    organizationId: certOrgId,
    eventType: replaceEvent,
    severity: resolveGrowthOperatorNotificationSeverity(replaceEvent),
    recipientRole: "inbox_owner",
    recipientUserId: certUserId,
    dedupeKey: replaceDedupeKey,
    title: "SLA at risk",
    body: "Initial SLA warning.",
  })
  createdIds.push(replaceFirst.id)

  const replaceSecond = await createGrowthNotificationsForEvent(admin, {
    organizationId: certOrgId,
    event: replaceEvent,
    title: "SLA at risk updated",
    body: "Replacement SLA warning.",
    routingContext: { inboxOwnerUserId: certUserId },
    dedupe: {
      sourceSystem: "sn2-cert",
      sourceId: `${certSourceId}-replace`,
      threadId: "thread-cert-1",
    },
  })
  assert.equal(replaceSecond.replaced, 1)
  assert.equal(replaceSecond.created.length, 1)
  createdIds.push(...replaceSecond.created.map((row) => row.id))
  console.log("  ✓ replace_previous dedupe honored")

  const neverEvent = "reply_meeting_requested" as const
  const neverDedupeKey = buildGrowthOperatorNotificationDedupeKey({
    event: neverEvent,
    sourceSystem: "sn2-cert",
    sourceId: `${certSourceId}-never`,
    leadId: "lead-cert-2",
  })

  const neverFirst = await createNotification(admin, {
    organizationId: certOrgId,
    eventType: neverEvent,
    severity: resolveGrowthOperatorNotificationSeverity(neverEvent),
    recipientRole: "lead_owner",
    recipientUserId: certUserId,
    dedupeKey: neverDedupeKey,
    title: "Meeting requested",
    body: "First meeting request.",
  })
  const neverSecond = await createNotification(admin, {
    organizationId: certOrgId,
    eventType: neverEvent,
    severity: resolveGrowthOperatorNotificationSeverity(neverEvent),
    recipientRole: "lead_owner",
    recipientUserId: certUserId,
    dedupeKey: neverDedupeKey,
    title: "Meeting requested again",
    body: "Second meeting request.",
  })
  createdIds.push(neverFirst.id, neverSecond.id)
  assert.notEqual(neverFirst.id, neverSecond.id)
  console.log("  ✓ never dedupe rule allows duplicates")

  const unreadBefore = await getUnreadCounts(admin, { recipientUserId: certUserId })
  assert.ok(unreadBefore.unreadTotal >= 3)

  const listed = await listNotifications(admin, {
    recipientUserId: certUserId,
    unreadOnly: true,
    limit: 50,
  })
  assert.ok(listed.total >= 3)
  console.log("  ✓ listNotifications + unread counts")

  const acknowledged = await acknowledgeNotification(admin, neverSecond.id)
  assert.ok(acknowledged?.acknowledgedAt)

  const unreadAfterAck = await getUnreadCounts(admin, { recipientUserId: certUserId })
  assert.ok(unreadAfterAck.unreadTotal < unreadBefore.unreadTotal)
  console.log("  ✓ acknowledgeNotification")

  const dismissed = await dismissNotification(admin, neverFirst.id)
  assert.ok(dismissed?.dismissedAt)
  console.log("  ✓ dismissNotification")

  const expiredRow = await createNotification(admin, {
    organizationId: certOrgId,
    eventType: "share_page_viewed",
    severity: resolveGrowthOperatorNotificationSeverity("share_page_viewed"),
    recipientRole: "lead_owner",
    recipientUserId: certUserId,
    dedupeKey: buildGrowthOperatorNotificationDedupeKey({
      event: "share_page_viewed",
      sourceSystem: "sn2-cert-expire",
      sourceId: `${certSourceId}-expire`,
    }),
    title: "Expired view",
    body: "Should expire.",
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  })
  createdIds.push(expiredRow.id)
  const expiredCount = await expireNotifications(admin)
  assert.ok(expiredCount >= 1)
  console.log("  ✓ expireNotifications")

  await deleteNotificationsByIds(admin, createdIds)

  for (const event of GROWTH_OPERATOR_NOTIFICATION_EVENTS) {
    assert.ok(resolveGrowthOperatorNotificationSeverity(event))
    assert.ok(resolveGrowthOperatorNotificationRecipients(event, routingContext).length > 0)
    assert.ok(resolveGrowthOperatorNotificationDedupeRule(event))
  }
  console.log("  ✓ full SN-1 taxonomy wired through service inputs")

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_OPERATOR_NOTIFICATIONS_SN2_QA_MARKER,
    rows_exercised: createdIds.length,
    schema_ready: true,
    live_schema_verified: true,
    integration_crud: true,
    cert_user_id: certUserId,
    cert_organization_id: certOrgId,
  }
}

async function runProductionDiagnostics(): Promise<Record<string, unknown>> {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_OPERATOR_NOTIFICATIONS_SN2_QA_MARKER,
      schema_ready: false,
      live_schema_verified: false,
      error: "production_supabase_unavailable",
      note:
        "Run via pnpm test:growth-notifications:production with Vercel Production env loaded and Supabase CLI linked to production project",
      vercel_production_env_run: process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN === "1",
      has_supabase_service_role_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
      supabase_cli_linked_project: Boolean(resolveLinkedSupabaseProjectRef()),
    }
  }

  const { executeGrowthOperatorNotificationsProductionDiagnostics } = await import(
    "../lib/growth/notifications/growth-notification-production-diagnostics"
  )
  const report = await executeGrowthOperatorNotificationsProductionDiagnostics(boot.admin)
  return {
    ...report,
    supabase_url: boot.url,
    env_source: boot.env_source,
    vercel_production_env_run: boot.vercel_production_env_run,
  }
}

async function runIntegrationDiagnostics(): Promise<Record<string, unknown>> {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv()
  if (!boot) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_OPERATOR_NOTIFICATIONS_SN2_QA_MARKER,
      schema_ready: false,
      error: "supabase_unavailable",
      note: "Run via pnpm test:growth-notifications:integration with Vercel Production env loaded and Supabase CLI linked to production project",
    }
  }

  const { probeGrowthOperatorNotificationsSchema } = await import(
    "../lib/growth/notifications/growth-notification-schema-health"
  )
  const schema = await probeGrowthOperatorNotificationsSchema(boot.admin)
  if (!schema.ready) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_OPERATOR_NOTIFICATIONS_SN2_QA_MARKER,
      schema_ready: false,
      schema_error: schema.error,
      migration: GROWTH_OPERATOR_NOTIFICATIONS_SN2_MIGRATION,
      env_source: boot.env_source,
    }
  }

  const report = await runRepositoryIntegration(boot.admin)
  return {
    ...report,
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

  if (mode === "local") {
    runLocalRegression()
    console.log(
      JSON.stringify(
        {
          ok: true,
          local_only: true,
          qa_marker: GROWTH_OPERATOR_NOTIFICATIONS_SN2_QA_MARKER,
          hint: "Run pnpm test:growth-notifications:integration or :production after applying migration",
        },
        null,
        2,
      ),
    )
    return
  }

  runLocalRegression()
  console.log(`\n=== SN-2 ${mode} diagnostics ===\n`)

  const report =
    mode === "production" ? await runProductionDiagnostics() : await runIntegrationDiagnostics()

  console.log(JSON.stringify(report, null, 2))
  if (report.final_verdict !== "PASS") {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
