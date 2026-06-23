/**
 * GS-GROWTH-WARMUP-EXECUTOR-1B — throttled/paused profile diagnostics regression.
 * Run: pnpm test:growth-warmup-executor-1b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  describeWarmupExecutorProfileDiagnostic,
  GROWTH_WARMUP_EXECUTOR_1B_QA_MARKER,
  isWarmupExecutorScannableProfile,
  isWarmupExecutorSendEligibleStatus,
  summarizeWarmupExecutorRun,
  WARMUP_EXECUTOR_SCANNABLE_STATUSES,
} from "../lib/growth/warmup/warmup-executor-diagnostics"
import type { GrowthWarmupProfile } from "../lib/growth/warmup/warmup-types"

function mockProfile(overrides: Partial<GrowthWarmupProfile> = {}): GrowthWarmupProfile {
  return {
    id: "profile-1",
    sender_account_id: "sender-1",
    sender_email: "sender@equipify.ai",
    sender_display_name: "Sender",
    status: "warming",
    target_daily_volume: 50,
    current_daily_volume: 5,
    daily_increment: 2,
    warmup_days: 30,
    warmup_progress: 10,
    warmup_score: 100,
    warmup_health: "healthy",
    started_at: new Date().toISOString(),
    completed_at: null,
    last_progress_at: null,
    current_warmup_day: 1,
    sends_today: 0,
    sends_today_date: new Date().toISOString().slice(0, 10),
    throttled_at: null,
    throttle_reason: null,
    last_capacity_sync_at: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    schedule: [],
    ...overrides,
  }
}

function runTests(): void {
  console.log("\n=== GS-GROWTH-WARMUP-EXECUTOR-1B ===\n")

  assert.equal(GROWTH_WARMUP_EXECUTOR_1B_QA_MARKER, "growth-warmup-executor-1b-v1")
  console.log("  ✓ 1B QA marker")

  assert.ok(WARMUP_EXECUTOR_SCANNABLE_STATUSES.includes("throttled"))
  assert.ok(WARMUP_EXECUTOR_SCANNABLE_STATUSES.includes("paused"))
  assert.ok(WARMUP_EXECUTOR_SCANNABLE_STATUSES.includes("warming"))
  assert.ok(!WARMUP_EXECUTOR_SCANNABLE_STATUSES.includes("disabled"))
  console.log("  ✓ Scannable statuses include throttled/paused, exclude disabled")

  assert.equal(isWarmupExecutorSendEligibleStatus("warming"), true)
  assert.equal(isWarmupExecutorSendEligibleStatus("throttled"), false)
  assert.equal(isWarmupExecutorSendEligibleStatus("paused"), false)
  console.log("  ✓ Only warming status is send-eligible")

  const throttled = mockProfile({
    status: "throttled",
    throttle_reason: "bounce_rate_elevated",
  })
  assert.equal(isWarmupExecutorScannableProfile(throttled), true)
  const throttledDiag = describeWarmupExecutorProfileDiagnostic({
    profile: throttled,
    remainingCapacity: 5,
    approvedRecipientCount: 4,
  })
  assert.equal(throttledDiag.eligibility, "skipped")
  assert.equal(throttledDiag.skipCode, "warmup_throttled")
  assert.match(throttledDiag.reason, /bounce_rate_elevated/)
  assert.match(throttledDiag.nextAction, /Clear throttle/i)
  console.log("  ✓ Throttled profile: skipped with throttle reason + next action")

  const pausedDiag = describeWarmupExecutorProfileDiagnostic({
    profile: mockProfile({ status: "paused" }),
    remainingCapacity: 5,
    approvedRecipientCount: 4,
  })
  assert.equal(pausedDiag.skipCode, "warmup_paused")
  assert.match(pausedDiag.nextAction, /Resume/i)
  console.log("  ✓ Paused profile: skipped with resume next action")

  const eligibleDiag = describeWarmupExecutorProfileDiagnostic({
    profile: mockProfile({ status: "warming" }),
    remainingCapacity: 3,
    approvedRecipientCount: 2,
  })
  assert.equal(eligibleDiag.eligibility, "eligible")
  assert.match(eligibleDiag.reason, /3 warmup send/)
  console.log("  ✓ Warming profile with capacity: eligible")

  const noRecipientsDiag = describeWarmupExecutorProfileDiagnostic({
    profile: mockProfile({ status: "warming" }),
    remainingCapacity: 5,
    approvedRecipientCount: 0,
  })
  assert.equal(noRecipientsDiag.skipCode, "no_approved_recipients")
  console.log("  ✓ Warming profile without recipients: skipped")

  const throttledOnlySummary = summarizeWarmupExecutorRun({
    allProfiles: [throttled],
    scannableProfiles: [throttled],
    diagnostics: [throttledDiag],
    approvedRecipientCount: 4,
  })
  assert.equal(throttledOnlySummary.warmingProfiles, 0)
  assert.equal(throttledOnlySummary.throttledProfiles, 1)
  assert.equal(throttledOnlySummary.eligibleProfiles, 0)
  assert.match(throttledOnlySummary.primaryMessage, /throttled/)
  assert.doesNotMatch(throttledOnlySummary.primaryMessage, /No warming profiles found/i)
  console.log("  ✓ Run summary explains throttled profiles (not misleading zero message)")

  const executorSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/warmup/warmup-send-executor.ts"),
    "utf8",
  )
  assert.match(executorSource, /isWarmupExecutorScannableProfile/)
  assert.match(executorSource, /summarizeWarmupExecutorRun/)
  assert.match(executorSource, /profileDiagnostics/)
  assert.doesNotMatch(executorSource, /\.filter\(\(p\) => p\.status === "warming"\)/)
  console.log("  ✓ Executor scans scannable profiles and emits diagnostics")

  const uiSource = fs.readFileSync(
    path.join(process.cwd(), "components/growth/growth-warmup-executor-panel.tsx"),
    "utf8",
  )
  assert.match(uiSource, /runSummary/)
  assert.match(uiSource, /profileDiagnostics/)
  assert.match(uiSource, /Skipped:/)
  assert.match(uiSource, /Resume Warmup/)
  assert.match(uiSource, /Clear Throttle/)
  console.log("  ✓ Executor panel shows skip reasons and safe operator actions")

  const syncRoute = path.join(
    process.cwd(),
    "app/api/platform/growth/warmup/[id]/sync-progression/route.ts",
  )
  assert.ok(fs.existsSync(syncRoute))
  const syncSource = fs.readFileSync(syncRoute, "utf8")
  assert.match(syncSource, /runWarmupProgressionForProfile/)
  assert.doesNotMatch(syncSource, /\.update\(/)
  console.log("  ✓ Sync progression route uses reputation-aware progression (no direct DB hack)")

  console.log("\nGS-GROWTH-WARMUP-EXECUTOR-1B passed.\n")
}

runTests()
