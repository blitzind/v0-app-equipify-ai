/**
 * GS-WARMUP-FIX-1B — Capacity-aware warmup planning certification.
 * Run: pnpm test:gs-warmup-fix-1b-capacity-planning
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import {
  aggregateWarmupDailyCapacityPlan,
  buildWarmupSenderCapacitySnapshot,
  computeWarmupCapacityStatus,
  formatWarmupCapacityStatusLabel,
  GROWTH_WARMUP_CAPACITY_FIX_1B_QA_MARKER,
} from "../lib/growth/warmup/warmup-capacity-engine"
import { WARMUP_EXECUTOR_RECIPIENT_DEDUP_POLICY } from "../lib/growth/warmup/warmup-executor-fairness"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

console.log("[GS-WARMUP-FIX-1B] Capacity-aware warmup planning certification")

assert.equal(GROWTH_WARMUP_CAPACITY_FIX_1B_QA_MARKER, "growth-warmup-capacity-fix-1b-v1")

const engineSource = readSource("lib/growth/warmup/warmup-capacity-engine.ts")
assert.match(engineSource, /expectedMaxToday/)
assert.match(engineSource, /capacityShortfall/)
assert.match(engineSource, /repeat_after_days/)

const dashboardRoute = readSource("app/api/platform/growth/warmup/dashboard/route.ts")
assert.match(dashboardRoute, /buildWarmupDailyCapacityPlan/)
assert.match(dashboardRoute, /daily_capacity_plan/)

const uiSource = readSource("components/growth/growth-warmup-executor-panel.tsx")
assert.match(uiSource, /Today(?:'|&apos;)s Plan/)
assert.match(uiSource, /Maximum Possible/)
assert.match(uiSource, /GROWTH_WARMUP_CAPACITY_FIX_1B_QA_MARKER/)
assert.equal(uiSource.includes("createAiWorkOrder"), false)

const executorSource = readSource("lib/growth/warmup/warmup-send-executor.ts")
assert.match(executorSource, /buildWarmupDailyCapacityPlan/)
assert.match(executorSource, /dailyCapacityPlan/)

console.log("  ✓ Capacity engine + dashboard + UI wiring present")

const healthy = computeWarmupCapacityStatus({
  totalPlannedToday: 10,
  totalAchievableToday: 24,
  totalTheoreticalMaximumToday: 24,
  approvedRecipients: 4,
  warmingSenders: 6,
})
assert.equal(healthy.status, "healthy")
console.log("  ✓ Healthy when planned <= achievable")

const constrained = computeWarmupCapacityStatus({
  totalPlannedToday: 78,
  totalAchievableToday: 24,
  totalTheoreticalMaximumToday: 24,
  approvedRecipients: 4,
  warmingSenders: 6,
})
assert.equal(constrained.status, "constrained")
assert.ok(constrained.recommendation?.includes("Increase approved recipient pool"))
console.log("  ✓ Constrained when planned > achievable (78 planned vs 24 max)")

const impossible = computeWarmupCapacityStatus({
  totalPlannedToday: 13,
  totalAchievableToday: 0,
  totalTheoreticalMaximumToday: 4,
  approvedRecipients: 4,
  warmingSenders: 1,
})
assert.equal(impossible.status, "impossible")
console.log("  ✓ Impossible when achievable is zero")

const sender = buildWarmupSenderCapacitySnapshot({
  profileId: "profile-1",
  senderEmail: "sender@example.com",
  profileStatus: "warming",
  approvedRecipients: 4,
  recipientsUsedToday: 4,
  recipientsRemaining: 0,
  remainingVolumeToday: 13,
})
assert.equal(sender.maxAdditionalSendsToday, 0)
console.log("  ✓ Per-sender max additional sends = min(remaining volume, recipients remaining)")

const fleetPlan = aggregateWarmupDailyCapacityPlan({
  approvedRecipients: 4,
  senders: [
    sender,
    buildWarmupSenderCapacitySnapshot({
      profileId: "profile-2",
      senderEmail: "sender2@example.com",
      profileStatus: "warming",
      approvedRecipients: 4,
      recipientsUsedToday: 0,
      recipientsRemaining: 4,
      remainingVolumeToday: 13,
    }),
  ],
})
assert.equal(fleetPlan.totalPlannedToday, 26)
assert.equal(fleetPlan.totalAchievableToday, 4)
assert.equal(fleetPlan.expectedMaxToday, 4)
assert.equal(fleetPlan.capacityShortfall, 22)
assert.equal(fleetPlan.dedupPolicy, WARMUP_EXECUTOR_RECIPIENT_DEDUP_POLICY)
assert.equal(formatWarmupCapacityStatusLabel(fleetPlan.status), "Constrained")
console.log("  ✓ Fleet aggregation with expected_max_today and capacity_shortfall")

const impossibleFleet = aggregateWarmupDailyCapacityPlan({
  approvedRecipients: 4,
  senders: [sender],
})
assert.equal(impossibleFleet.status, "impossible")
console.log("  ✓ Impossible when fleet achievable is zero")

console.log("[GS-WARMUP-FIX-1B] Running 1A regression…")
const result = spawnSync("pnpm", ["test:gs-warmup-fix-1a-recipient-pool"], {
  stdio: "inherit",
  shell: true,
})
assert.equal(result.status, 0, "GS-WARMUP-FIX-1A regression failed")

console.log("[GS-WARMUP-FIX-1B] PASS — capacity planning certified")
