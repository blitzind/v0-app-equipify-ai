/**
 * GS-GROWTH-WARMUP-REPUTATION-THROTTLE-FIX-1L — false warmup throttling regression cert.
 * Run: pnpm test:growth-warmup-reputation-throttle-1l
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import type { GrowthMailboxReputationMetrics } from "../lib/growth/deliverability/reputation-protection-types"
import { describeWarmupExecutorProfileDiagnostic } from "../lib/growth/warmup/warmup-executor-diagnostics"
import {
  applyWarmupVelocityReduction,
  evaluateWarmupReputationThrottle,
  evaluateWarmupThrottleClear,
  GROWTH_WARMUP_REPUTATION_THROTTLE_1L_QA_MARKER,
  isWarmupThrottleLikelyClearable,
  WARMUP_BOUNCE_HARD_THRESHOLD_PCT,
  WARMUP_COMPLAINT_HARD_THRESHOLD_PCT,
} from "../lib/growth/warmup/warmup-reputation-throttle-policy"
import type { GrowthWarmupProfile } from "../lib/growth/warmup/warmup-types"

function readSource(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8")
}

function mockMetrics(overrides: Partial<GrowthMailboxReputationMetrics> = {}): GrowthMailboxReputationMetrics {
  return {
    sender_account_id: "sender-1",
    mailbox_connection_id: "mb-1",
    email_address: "sender@equipify.ai",
    daily_send_count: 2,
    rolling_7d_send_volume: 10,
    rolling_30d_send_volume: 10,
    bounce_rate: 0,
    reply_rate: 0,
    positive_reply_rate: 0,
    unsubscribe_rate: 0,
    spam_complaint_rate: 0,
    open_rate: 0,
    inactivity_days: 0,
    sequence_participation_count: 0,
    warmup_status: "warming",
    warmup_progress: 5,
    ...overrides,
  }
}

function mockProfile(overrides: Partial<GrowthWarmupProfile> = {}): GrowthWarmupProfile {
  return {
    id: "profile-1",
    sender_account_id: "sender-1",
    sender_email: "sender@equipify.ai",
    sender_display_name: "Sender",
    status: "warming",
    target_daily_volume: 50,
    current_daily_volume: 8,
    daily_increment: 2,
    warmup_days: 30,
    warmup_progress: 10,
    warmup_score: 65,
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
  console.log("\n=== GS-GROWTH-WARMUP-REPUTATION-THROTTLE-FIX-1L ===\n")
  assert.equal(GROWTH_WARMUP_REPUTATION_THROTTLE_1L_QA_MARKER, "growth-warmup-reputation-throttle-fix-1l-v1")
  console.log("  ✓ QA marker")

  const softReputation = {
    health_tier: "caution" as const,
    risk_score: 65,
    risk_reasons: [] as string[],
    metrics: mockMetrics({ warmup_status: "warming" }),
  }
  assert.equal(softReputation.risk_score, 65)

  const softDecision = evaluateWarmupReputationThrottle({
    profileWarmupHealth: "healthy",
    profileStatus: "warming",
    senderStatus: "connected",
    senderHealthStatus: "degraded",
    reputation: softReputation,
  })
  assert.notEqual(softDecision.action, "full_throttle", "degraded sender + soft reputation must not full throttle")
  assert.ok(
    softDecision.action === "allow" || softDecision.action === "velocity_reduction",
    "soft reputation should allow or reduce velocity only",
  )
  console.log("  ✓ Degraded sender + score ~65 / soft tier does not full throttle")

  const highRiskSoft = evaluateWarmupReputationThrottle({
    profileWarmupHealth: "healthy",
    profileStatus: "warming",
    senderStatus: "connected",
    senderHealthStatus: "degraded",
    reputation: {
      ...softReputation,
      health_tier: "high_risk",
      risk_score: 55,
      risk_reasons: ["Elevated bounce rate 4.5%."],
      metrics: mockMetrics({ bounce_rate: 4.5 }),
    },
  })
  assert.equal(highRiskSoft.action, "velocity_reduction")
  assert.equal(highRiskSoft.velocityReductionFactor, 0.5)
  console.log("  ✓ High-risk soft tier → velocity reduction, not full throttle")

  const staleClear = evaluateWarmupThrottleClear({
    profileWarmupHealth: "healthy",
    profileStatus: "throttled",
    senderStatus: "connected",
    senderHealthStatus: "degraded",
    reputation: softReputation,
  })
  assert.equal(staleClear.canClear, true)
  assert.match(staleClear.reason, /controlled warmup allowed/i)
  console.log("  ✓ Stale throttled profile with healthy warmup can clear")

  const criticalWarmup = evaluateWarmupReputationThrottle({
    profileWarmupHealth: "critical",
    profileStatus: "warming",
    senderStatus: "connected",
    senderHealthStatus: "degraded",
    reputation: softReputation,
  })
  assert.equal(criticalWarmup.action, "full_throttle")
  console.log("  ✓ Warmup critical health still blocks")

  const blockedSender = evaluateWarmupReputationThrottle({
    profileWarmupHealth: "healthy",
    profileStatus: "warming",
    senderStatus: "connected",
    senderHealthStatus: "blocked",
    reputation: softReputation,
  })
  assert.equal(blockedSender.action, "full_throttle")
  console.log("  ✓ Blocked sender status still blocks")

  const bounceHard = evaluateWarmupReputationThrottle({
    profileWarmupHealth: "healthy",
    profileStatus: "warming",
    senderStatus: "connected",
    senderHealthStatus: "warming",
    reputation: {
      ...softReputation,
      health_tier: "high_risk",
      risk_score: 40,
      risk_reasons: [`Bounce rate ${WARMUP_BOUNCE_HARD_THRESHOLD_PCT}.0% exceeds safe threshold.`],
      metrics: mockMetrics({ bounce_rate: WARMUP_BOUNCE_HARD_THRESHOLD_PCT }),
    },
  })
  assert.equal(bounceHard.action, "full_throttle")
  assert.match(bounceHard.reason ?? "", /bounce rate/i)
  console.log("  ✓ Bounce hard threshold still throttles")

  const complaintHard = evaluateWarmupReputationThrottle({
    profileWarmupHealth: "healthy",
    profileStatus: "warming",
    senderStatus: "connected",
    senderHealthStatus: "warming",
    reputation: {
      ...softReputation,
      health_tier: "paused",
      risk_score: 20,
      risk_reasons: ["Spam complaint rate critical."],
      metrics: mockMetrics({ spam_complaint_rate: WARMUP_COMPLAINT_HARD_THRESHOLD_PCT }),
    },
  })
  assert.equal(complaintHard.action, "full_throttle")
  console.log("  ✓ Complaint hard threshold still throttles")

  const stillBlockedClear = evaluateWarmupThrottleClear({
    profileWarmupHealth: "healthy",
    profileStatus: "throttled",
    senderStatus: "connected",
    senderHealthStatus: "warming",
    reputation: {
      ...softReputation,
      health_tier: "paused",
      risk_score: 20,
      risk_reasons: ["Spam complaint rate critical."],
      metrics: mockMetrics({ spam_complaint_rate: WARMUP_COMPLAINT_HARD_THRESHOLD_PCT }),
    },
  })
  assert.equal(stillBlockedClear.canClear, false)
  assert.ok(stillBlockedClear.reason.length > 0)
  console.log("  ✓ Clear Throttle returns exact reason when still blocked")

  assert.equal(applyWarmupVelocityReduction(8, 0.75), 6)
  console.log("  ✓ Velocity reduction lowers planned volume")

  const throttledDiag = describeWarmupExecutorProfileDiagnostic({
    profile: mockProfile({
      status: "throttled",
      throttle_reason: "Reputation protection requires reduced velocity.",
    }),
    remainingCapacity: 8,
    approvedRecipientCount: 4,
    senderAccount: { status: "connected", health_status: "degraded" },
  })
  assert.equal(throttledDiag.eligibility, "skipped")
  assert.equal(throttledDiag.skipCode, "warmup_throttled")
  assert.equal(throttledDiag.throttleClearable, true)
  assert.match(throttledDiag.nextAction ?? "", /Clear Throttle/i)
  assert.doesNotMatch(throttledDiag.reason, /next run can send/i)
  console.log("  ✓ Diagnostics match throttle gate — no contradictory eligible copy")

  assert.equal(
    isWarmupThrottleLikelyClearable({
      profileStatus: "throttled",
      profileWarmupHealth: "healthy",
      senderStatus: "connected",
      senderHealthStatus: "degraded",
    }),
    true,
  )
  console.log("  ✓ Likely-clearable helper for degraded DNS-stub senders")

  const executionSource = readSource("lib/growth/warmup/warmup-execution.ts")
  assert.match(executionSource, /evaluateWarmupReputationThrottle/)
  assert.match(executionSource, /repairStaleWarmupThrottlesBatch/)
  assert.doesNotMatch(executionSource, /risk_score >= 75/)
  assert.doesNotMatch(executionSource, /health_tier === "high_risk"/)
  console.log("  ✓ Progression uses new policy — removed score>=75 / high_risk auto-throttle")

  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/platform/growth/warmup/repair-throttles/route.ts")))
  assert.match(readSource("app/api/platform/growth/warmup/repair-throttles/route.ts"), /repairStaleWarmupThrottlesBatch/)
  assert.match(readSource("app/api/platform/growth/warmup/[id]/sync-progression/route.ts"), /evaluateWarmupThrottleClear/)
  console.log("  ✓ Repair + Clear Throttle API routes wired")

  const panelSource = readSource("components/growth/growth-warmup-executor-panel.tsx")
  assert.match(panelSource, /throttleClearable/)
  assert.match(panelSource, /Throttle can be cleared/)
  console.log("  ✓ UI shows clearable throttle state without contradictory eligible copy")

  console.log("\nGS-GROWTH-WARMUP-REPUTATION-THROTTLE-FIX-1L passed.\n")
}

runTests()
