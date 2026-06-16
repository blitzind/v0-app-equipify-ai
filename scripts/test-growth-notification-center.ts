/**
 * SN-7 — Operator notification center UI certification.
 *
 * Local: pnpm test:growth-notification-center
 * Integration: pnpm test:growth-notification-center:integration
 * Production: pnpm test:growth-notification-center:production
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { SupabaseClient } from "@supabase/supabase-js"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "../lib/growth/notifications/growth-notification-cert-bootstrap"
import { GROWTH_OPERATOR_NOTIFICATION_EVENTS } from "../lib/growth/notifications/growth-notification-events"
import {
  GROWTH_OPERATOR_NOTIFICATION_CENTER_QA_MARKER,
  type GrowthOperatorNotificationUnreadCounts,
} from "../lib/growth/notifications/growth-notification-persistence-types"
import {
  mapGrowthOperatorNotificationCenterItem,
  resolveGrowthOperatorNotificationEntityLink,
} from "../lib/growth/notifications/growth-notification-center-utils"
import { resolveGrowthOperatorNotificationSeverity } from "../lib/growth/notifications/growth-notification-severity"
import { resolveLinkedSupabaseProjectRef } from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"

const SN7_MODULE_PATHS = [
  "components/growth/notifications/growth-notification-center.tsx",
  "components/growth/notifications/growth-notification-list.tsx",
  "components/growth/notifications/growth-notification-card.tsx",
  "components/growth/notifications/growth-notification-filters.tsx",
  "components/growth/notifications/growth-notification-badge.tsx",
  "lib/growth/notifications/growth-notification-center-utils.ts",
  "app/api/platform/growth/notifications/route.ts",
  "app/api/platform/growth/notifications/unread/route.ts",
  "app/api/platform/growth/notifications/[id]/acknowledge/route.ts",
  "app/api/platform/growth/notifications/[id]/dismiss/route.ts",
  "app/(admin)/admin/growth/notifications/page.tsx",
  "lib/growth/navigation/growth-navigation-destinations.ts",
] as const

const FORBIDDEN_SOURCE_PATTERNS = [
  /sendPushNotification/,
  /web-push/,
  /PushSubscription/,
  /serviceWorker\.register/,
  /Notification\.requestPermission/,
  /emitGrowthNotification/,
  /createNotification\(/,
] as const

function runLocalRegression(): void {
  console.log(`\n=== SN-7 local regression (${GROWTH_OPERATOR_NOTIFICATION_CENTER_QA_MARKER}) ===\n`)

  assert.equal(GROWTH_OPERATOR_NOTIFICATION_CENTER_QA_MARKER, "growth-notification-center-sn7-v1")
  console.log("  ✓ QA marker")

  for (const relativePath of SN7_MODULE_PATHS) {
    assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  }
  console.log("  ✓ SN-7 module files exist")

  const centerSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/notifications/growth-notification-center.tsx"),
    "utf8",
  )
  const listSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/notifications/growth-notification-list.tsx"),
    "utf8",
  )
  const cardSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/notifications/growth-notification-card.tsx"),
    "utf8",
  )
  const filtersSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/notifications/growth-notification-filters.tsx"),
    "utf8",
  )
  const listRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/notifications/route.ts"),
    "utf8",
  )
  const ackRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/notifications/[id]/acknowledge/route.ts"),
    "utf8",
  )
  const dismissRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/notifications/[id]/dismiss/route.ts"),
    "utf8",
  )
  const unreadRouteSource = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/notifications/unread/route.ts"),
    "utf8",
  )
  const navSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/navigation/growth-navigation-destinations.ts"),
    "utf8",
  )
  const sidebarHookSource = fs.readFileSync(
    path.join(process.cwd(), "hooks/use-growth-sidebar-console.ts"),
    "utf8",
  )

  assert.match(listRouteSource, /listNotifications/)
  assert.match(ackRouteSource, /acknowledgeNotification/)
  assert.match(dismissRouteSource, /dismissNotification/)
  assert.match(unreadRouteSource, /getUnreadCounts/)
  assert.match(centerSource, /optimistic|patchItemStatus|setItems\(\(current\)/)
  assert.match(listSource, /Load more/)
  assert.match(cardSource, /severity/)
  assert.match(cardSource, /entityHref/)
  assert.doesNotMatch(cardSource, /JSON\.stringify\(item\.payload/)
  assert.match(filtersSource, /severity/)
  assert.match(filtersSource, /event/)
  assert.match(filtersSource, /recipientRole/)
  assert.match(navSource, /\/admin\/growth\/notifications/)
  assert.match(sidebarHookSource, /\/api\/platform\/growth\/notifications\/unread/)
  assert.match(sidebarHookSource, /operator_notifications/)
  console.log("  ✓ APIs, UI wiring, pagination, and navigation")

  const leadLink = resolveGrowthOperatorNotificationEntityLink({
    targetEntityType: "lead",
    targetEntityId: "00000000-0000-4000-8000-000000000001",
  })
  assert.match(leadLink.href ?? "", /\/admin\/growth\/leads\//)
  console.log("  ✓ entity link mapping")

  const mapped = mapGrowthOperatorNotificationCenterItem({
    id: "00000000-0000-4000-8000-000000000002",
    organizationId: null,
    eventType: "reply_received",
    severity: "medium",
    recipientRole: "lead_owner",
    recipientUserId: null,
    dedupeKey: "abc",
    title: "Reply received",
    body: "Acme replied.",
    payload: { secret: "must-not-render" },
    targetEntityType: "reply",
    targetEntityId: "00000000-0000-4000-8000-000000000003",
    acknowledgedAt: null,
    dismissedAt: null,
    expiresAt: null,
    createdAt: "2026-06-15T12:00:00.000Z",
    updatedAt: "2026-06-15T12:00:00.000Z",
  })
  assert.equal(mapped.status, "unread")
  assert.equal(mapped.title, "Reply received")
  assert.doesNotMatch(mapped.body, /must-not-render/)
  console.log("  ✓ list item mapping without raw payload rendering")

  for (const relativePath of SN7_MODULE_PATHS) {
    const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    for (const pattern of FORBIDDEN_SOURCE_PATTERNS) {
      assert.doesNotMatch(source, pattern, `${relativePath} must not contain ${pattern}`)
    }
  }
  console.log("  ✓ no delivery, push, preferences, or autonomous action code")

  console.log("\nSN-7 local regression PASS\n")
}

async function resolveSn7CertUserId(admin: SupabaseClient): Promise<string> {
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
  const certUserId = await resolveSn7CertUserId(admin)
  const { createNotification, listNotifications, acknowledgeNotification, dismissNotification, getUnreadCounts, deleteNotificationsByIds } =
    await import("../lib/growth/notifications/growth-notification-repository")

  const event = "reply_received" as const
  const dedupeKey = `sn7-cert-${Date.now()}`
  const created = await createNotification(admin, {
    organizationId: null,
    eventType: event,
    severity: resolveGrowthOperatorNotificationSeverity(event),
    recipientRole: "lead_owner",
    recipientUserId: certUserId,
    dedupeKey,
    title: "SN-7 certification notification",
    body: "Certification Co replied.",
    targetEntityType: "lead",
    targetEntityId: "00000000-0000-4000-8000-000000000099",
    payload: { qa_marker: GROWTH_OPERATOR_NOTIFICATION_CENTER_QA_MARKER, cert: true },
  })

  const unreadBefore = await getUnreadCounts(admin, {
    recipientUserId: certUserId,
    includePlatformAdminPool: true,
  })

  const filtered = await listNotifications(admin, {
    recipientUserId: certUserId,
    includePlatformAdminPool: true,
    status: "unread",
    eventType: event,
    severity: "medium",
    recipientRole: "lead_owner",
    limit: 10,
    offset: 0,
  })
  assert.ok(filtered.items.some((row) => row.id === created.id))

  const pageTwo = await listNotifications(admin, {
    recipientUserId: certUserId,
    includePlatformAdminPool: true,
    status: "all",
    limit: 1,
    offset: 0,
  })
  assert.equal(typeof pageTwo.hasMore, "boolean")

  const acknowledged = await acknowledgeNotification(admin, created.id)
  assert.ok(acknowledged?.acknowledgedAt)

  const acknowledgedList = await listNotifications(admin, {
    recipientUserId: certUserId,
    includePlatformAdminPool: true,
    status: "acknowledged",
    limit: 10,
  })
  assert.ok(acknowledgedList.items.some((row) => row.id === created.id))

  const dismissed = await dismissNotification(admin, created.id)
  assert.ok(dismissed?.dismissedAt)

  const dismissedList = await listNotifications(admin, {
    recipientUserId: certUserId,
    includePlatformAdminPool: true,
    status: "dismissed",
    limit: 10,
  })
  assert.ok(dismissedList.items.some((row) => row.id === created.id))

  await deleteNotificationsByIds(admin, [created.id])

  const unreadAfter: GrowthOperatorNotificationUnreadCounts = await getUnreadCounts(admin, {
    recipientUserId: certUserId,
    includePlatformAdminPool: true,
  })
  assert.ok(unreadAfter.unreadTotal <= unreadBefore.unreadTotal)

  return {
    ok: true,
    final_verdict: "PASS",
    qa_marker: GROWTH_OPERATOR_NOTIFICATION_CENTER_QA_MARKER,
    integration_crud: true,
    filtered_unread_found: true,
    pagination_checked: true,
    acknowledge_flow: true,
    dismiss_flow: true,
    unread_counts_checked: true,
    live_schema_verified: true,
  }
}

async function runProductionDiagnostics(): Promise<Record<string, unknown>> {
  const boot = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) {
    return {
      ok: false,
      final_verdict: "FAIL",
      qa_marker: GROWTH_OPERATOR_NOTIFICATION_CENTER_QA_MARKER,
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
    qa_marker: GROWTH_OPERATOR_NOTIFICATION_CENTER_QA_MARKER,
    notification_center_routes: [
      "/api/platform/growth/notifications",
      "/api/platform/growth/notifications/unread",
      "/api/platform/growth/notifications/[id]/acknowledge",
      "/api/platform/growth/notifications/[id]/dismiss",
    ],
    ui_page: "/admin/growth/notifications",
    supported_events: GROWTH_OPERATOR_NOTIFICATION_EVENTS.length,
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
          qa_marker: GROWTH_OPERATOR_NOTIFICATION_CENTER_QA_MARKER,
          hint: "Run pnpm test:growth-notification-center:integration or :production",
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(`\n=== SN-7 ${mode} diagnostics ===\n`)

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
          qa_marker: GROWTH_OPERATOR_NOTIFICATION_CENTER_QA_MARKER,
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
