/**
 * GS-GROWTH-WARMUP-HEALTH-FIX-1K — warmup sender health alignment regression.
 * Run: pnpm test:growth-warmup-health-fix-1k
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  describeWarmupExecutorProfileDiagnostic,
  GROWTH_WARMUP_HEALTH_FIX_1K_QA_MARKER,
} from "../lib/growth/warmup/warmup-executor-diagnostics"
import {
  evaluateWarmupExecutorSenderHealthGate,
  isControlledWarmupSenderHealthAllowed,
  resolveWarmupAlignedSenderHealthStatus,
} from "../lib/growth/warmup/warmup-sender-health-gate"
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
    sends_today: 1,
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
  console.log("\n=== GS-GROWTH-WARMUP-HEALTH-FIX-1K ===\n")

  assert.equal(GROWTH_WARMUP_HEALTH_FIX_1K_QA_MARKER, "growth-warmup-health-fix-1k-v1")
  console.log("  ✓ QA marker")

  const degradedAllowed = evaluateWarmupExecutorSenderHealthGate({
    senderStatus: "connected",
    senderHealthStatus: "degraded",
    profileStatus: "warming",
    warmupHealth: "healthy",
  })
  assert.equal(degradedAllowed.allowed, true)
  assert.equal(degradedAllowed.controlledWarmupAllowed, true)
  assert.match(degradedAllowed.senderHealthNote ?? "", /controlled warmup is allowed/i)
  console.log("  ✓ Connected + warming + healthy + sender degraded → allowed")

  const warmupCritical = evaluateWarmupExecutorSenderHealthGate({
    senderStatus: "connected",
    senderHealthStatus: "degraded",
    profileStatus: "warming",
    warmupHealth: "critical",
  })
  assert.equal(warmupCritical.allowed, false)
  assert.equal(warmupCritical.skipCode, "sender_unhealthy")
  console.log("  ✓ Warmup critical → blocked")

  const senderCritical = evaluateWarmupExecutorSenderHealthGate({
    senderStatus: "connected",
    senderHealthStatus: "critical",
    profileStatus: "warming",
    warmupHealth: "healthy",
  })
  assert.equal(senderCritical.allowed, false)
  assert.match(senderCritical.message ?? "", /critical/i)
  console.log("  ✓ Sender critical → blocked")

  const disconnected = evaluateWarmupExecutorSenderHealthGate({
    senderStatus: "error",
    senderHealthStatus: "healthy",
    profileStatus: "warming",
    warmupHealth: "healthy",
  })
  assert.equal(disconnected.allowed, false)
  assert.equal(disconnected.skipCode, "sender_not_connected")
  console.log("  ✓ Sender disconnected → blocked")

  const nonWarmupDegraded = evaluateWarmupExecutorSenderHealthGate({
    senderStatus: "connected",
    senderHealthStatus: "degraded",
    profileStatus: "active",
    warmupHealth: "healthy",
  })
  assert.equal(nonWarmupDegraded.allowed, false)
  console.log("  ✓ Non-warming sender degraded → unchanged block behavior")

  assert.equal(
    resolveWarmupAlignedSenderHealthStatus({ profileStatus: "warming", warmupHealth: "healthy" }),
    "warming",
  )
  console.log("  ✓ Warmup-aligned sender health resolves to warming")

  const eligibleDiag = describeWarmupExecutorProfileDiagnostic({
    profile: mockProfile(),
    remainingCapacity: 4,
    approvedRecipientCount: 2,
    senderAccount: { status: "connected", health_status: "degraded" },
  })
  assert.equal(eligibleDiag.eligibility, "eligible")
  assert.equal(eligibleDiag.controlledWarmupAllowed, true)
  assert.match(eligibleDiag.reason, /controlled warmup is allowed/i)
  console.log("  ✓ Diagnostics eligible with degraded sender note")

  const criticalDiag = describeWarmupExecutorProfileDiagnostic({
    profile: mockProfile({ warmup_health: "critical" }),
    remainingCapacity: 4,
    approvedRecipientCount: 2,
    senderAccount: { status: "connected", health_status: "degraded" },
  })
  assert.equal(criticalDiag.eligibility, "skipped")
  assert.equal(criticalDiag.skipCode, "sender_unhealthy")
  assert.match(criticalDiag.nextAction ?? "", /Review warmup health/i)
  console.log("  ✓ Diagnostics skipped for warmup critical")

  assert.equal(
    isControlledWarmupSenderHealthAllowed({
      senderStatus: "connected",
      senderHealthStatus: "degraded",
      profileStatus: "warming",
      warmupHealth: "healthy",
    }),
    true,
  )
  console.log("  ✓ Controlled warmup helper")

  const executionSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/warmup/warmup-execution.ts"),
    "utf8",
  )
  assert.match(executionSource, /skipHealthRecompute:\s*true/)
  assert.match(executionSource, /repairWarmupAlignedSenderHealthBatch/)
  console.log("  ✓ syncSenderWarmupCapacity skips health recompute and repair batch exists")

  const senderRepoSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/sender/sender-repository.ts"),
    "utf8",
  )
  assert.match(senderRepoSource, /skipHealthRecompute\?: boolean/)
  console.log("  ✓ updateSenderAccount supports skipHealthRecompute")

  const executorSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/warmup/warmup-send-executor.ts"),
    "utf8",
  )
  assert.match(executorSource, /evaluateWarmupExecutorSenderHealthGate/)
  assert.match(executorSource, /loadSenderAccountGateContext/)
  console.log("  ✓ Executor uses shared sender health gate + sender context for diagnostics")

  const repairRoute = path.join(
    process.cwd(),
    "app/api/platform/growth/warmup/repair-sender-health/route.ts",
  )
  assert.ok(fs.existsSync(repairRoute))
  console.log("  ✓ Repair sender health API route exists")

  console.log("\nGS-GROWTH-WARMUP-HEALTH-FIX-1K passed.\n")
}

runTests()
