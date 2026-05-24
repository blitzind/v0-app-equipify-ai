/**
 * Regression checks for Growth Engine notifications + attention (slice 6.18A).
 * Run: pnpm test:growth-notifications
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_NOTIFICATIONS_QA_MARKER,
  GROWTH_NOTIFICATION_TYPES,
} from "../lib/growth/notifications/notification-types"
import {
  buildGrowthNotificationDeterministicHash,
  resolveGrowthNotificationCooldownMinutes,
} from "../lib/growth/notifications/notification-dedupe"
import {
  computeGrowthNotificationPriorityScore,
  resolveGrowthNotificationSeverity,
} from "../lib/growth/notifications/notification-priority"

assert.equal(GROWTH_NOTIFICATIONS_QA_MARKER, "growth-notifications-v1")
assert.ok(GROWTH_NOTIFICATION_TYPES.includes("approval_required"))
assert.equal(resolveGrowthNotificationSeverity("provider_disconnected"), "critical")
assert.equal(resolveGrowthNotificationSeverity("workload_imbalance"), "low")

const hashA = buildGrowthNotificationDeterministicHash({
  notificationType: "provider_degraded",
  sourceSystem: "provider",
  sourceId: "conn-1",
})
const hashB = buildGrowthNotificationDeterministicHash({
  notificationType: "provider_degraded",
  sourceSystem: "provider",
  sourceId: "conn-1",
})
assert.equal(hashA, hashB)

assert.ok(
  computeGrowthNotificationPriorityScore({ notificationType: "high_fit_lead" }) >
    computeGrowthNotificationPriorityScore({ notificationType: "workload_imbalance" }),
)

assert.equal(resolveGrowthNotificationCooldownMinutes("provider_degraded"), 60)

const emitSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/notifications/emit-growth-notification.ts"),
  "utf8",
)
assert.match(emitSource, /collapseCount/)
assert.match(emitSource, /dryRun/)
assert.doesNotMatch(emitSource, /executeGrowthOutreachQueueItem/)

const schedulerSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/sequence-enrollment/run-sequence-scheduler.ts"),
  "utf8",
)
assert.match(schedulerSource, /emitGrowthApprovalRequiredNotification/)

const feedRouteSource = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/attention/feed/route.ts"),
  "utf8",
)
assert.match(feedRouteSource, /requireGrowthEnginePlatformAccess/)

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270225120000_growth_engine_notifications_attention.sql"),
  "utf8",
)
assert.match(migrationSource, /growth\.notifications/)
assert.match(migrationSource, /notification_created/)
assert.match(migrationSource, /deterministic_hash/)

console.log("growth notifications tests passed")
