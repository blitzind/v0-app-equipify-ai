/**
 * GS-GROWTH-WARMUP-EXECUTOR-1G — explain no-send manual runs.
 * Run: pnpm test:growth-warmup-executor-1g
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildWarmupExecutorManualRunBreakdown,
  GROWTH_WARMUP_EXECUTOR_1G_QA_MARKER,
  GROWTH_WARMUP_EXECUTOR_BUILD_MARKER,
  normalizeWarmupSkipCodeForDisplay,
  summarizeRecipientPoolPressure,
  WARMUP_MANUAL_RUN_BEHAVIOR,
} from "../lib/growth/warmup/warmup-executor-manual-run-diagnostics"
import {
  buildWarmupExecutorSuccessBody,
  GROWTH_WARMUP_EXECUTOR_1C_QA_MARKER,
} from "../lib/growth/warmup/warmup-executor-api-response"
import { describeWarmupExecutorProfileDiagnostic } from "../lib/growth/warmup/warmup-executor-diagnostics"
import {
  GROWTH_WARMUP_EXECUTOR_QA_MARKER,
  type GrowthWarmupExecutorRunResult,
  type GrowthWarmupRecipient,
} from "../lib/growth/warmup/warmup-executor-types"
import type { GrowthWarmupProfile } from "../lib/growth/warmup/warmup-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function mockProfile(overrides: Partial<GrowthWarmupProfile> = {}): GrowthWarmupProfile {
  const today = new Date().toISOString().slice(0, 10)
  return {
    id: "profile-1",
    sender_account_id: "sender-1",
    sender_email: "mike@equipify.ai",
    sender_display_name: "Mike",
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
    sends_today_date: today,
    throttled_at: null,
    throttle_reason: null,
    last_capacity_sync_at: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    schedule: [{ id: "sched-1", day_number: 1, planned_volume: 5, actual_volume: 0, completed: false, completed_at: null }],
    ...overrides,
  }
}

function mockRecipient(overrides: Partial<GrowthWarmupRecipient> = {}): GrowthWarmupRecipient {
  return {
    id: "recipient-1",
    email: "colleague@company.com",
    name: "Colleague",
    label: "Colleague",
    recipient_type: "internal",
    active: true,
    approved: true,
    max_emails_per_day: 3,
    max_emails_per_week: 10,
    last_sent_at: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

function buildRunResult(input: {
  sendsSucceeded?: number
  senderResults?: GrowthWarmupExecutorRunResult["senderResults"]
  profileDiagnostics?: GrowthWarmupExecutorRunResult["profileDiagnostics"]
  skipReasons?: GrowthWarmupExecutorRunResult["skipReasons"]
  recipientPoolAvailable?: number
}): GrowthWarmupExecutorRunResult {
  return {
    qa_marker: GROWTH_WARMUP_EXECUTOR_QA_MARKER,
    executorBuildMarker: GROWTH_WARMUP_EXECUTOR_BUILD_MARKER,
    runId: "run-1",
    runKind: "manual",
    idempotencyKey: "warmup-manual:test",
    status: input.sendsSucceeded ? "completed" : "skipped",
    profilesScanned: 1,
    sendsAttempted: input.sendsSucceeded ?? 0,
    sendsSucceeded: input.sendsSucceeded ?? 0,
    sendsFailed: 0,
    sendsSkipped: input.sendsSucceeded ? 0 : 1,
    senderResults: input.senderResults ?? [],
    skipReasons: input.skipReasons ?? [],
    previewOnly: false,
    profileDiagnostics: input.profileDiagnostics,
    runSummary: {
      totalProfiles: 1,
      scannableProfiles: 1,
      warmingProfiles: 1,
      throttledProfiles: 0,
      pausedProfiles: 0,
      eligibleProfiles: 1,
      primaryMessage: "1 profile(s) eligible for executor sends.",
      plannedSendsThisRun: 1,
    },
    recipientPoolSummary: summarizeRecipientPoolPressure({
      recipients: [mockRecipient()],
      availableNow: input.recipientPoolAvailable ?? 0,
    }),
  }
}

function main(): void {
  console.log("\n=== GS-GROWTH-WARMUP-EXECUTOR-1G — Explain No-Send Manual Runs ===\n")

  assert.equal(GROWTH_WARMUP_EXECUTOR_1G_QA_MARKER, "growth-warmup-executor-1g-v1")
  assert.equal(GROWTH_WARMUP_EXECUTOR_BUILD_MARKER, "growth-warmup-executor-1f-v1")

  const panelSource = readSource("components/growth/growth-warmup-executor-panel.tsx")
  const apiSource = readSource("lib/growth/warmup/warmup-executor-api-response.ts")
  const diagnosticsSource = readSource("lib/growth/warmup/warmup-executor-manual-run-diagnostics.ts")

  assert.match(panelSource, /lastRunBreakdown/)
  assert.match(panelSource, /noSendExplanation/)
  assert.match(panelSource, /executor_build_marker/)
  assert.match(apiSource, /manualRunBreakdown/)
  assert.match(apiSource, /executor_build_marker/)
  assert.match(diagnosticsSource, /buildWarmupExecutorManualRunBreakdown/)
  console.log("  ✓ UI + API expose manual run breakdown and build marker")

  assert.match(WARMUP_MANUAL_RUN_BEHAVIOR, /immediately/)
  console.log("  ✓ Manual run behavior documented (immediate, not hourly wait)")

  const profile = mockProfile()
  const diagnostic = describeWarmupExecutorProfileDiagnostic({
    profile,
    remainingCapacity: 4,
    approvedRecipientCount: 2,
    enforceSendingWindow: false,
  })
  assert.equal(diagnostic.eligibility, "eligible")

  const recipientCapResult = buildRunResult({
    senderResults: [
      {
        senderAccountId: "sender-1",
        senderEmail: "mike@equipify.ai",
        profileId: "profile-1",
        plannedToday: 5,
        sendsToday: 0,
        executorSendsToday: 0,
        remainingCapacity: 4,
        attempted: 0,
        sent: 0,
        skipped: 1,
        failed: 0,
        skipReasons: [{ code: "recipient_daily_cap", message: "All approved recipients reached daily or weekly caps." }],
      },
    ],
    profileDiagnostics: [diagnostic],
  })
  recipientCapResult.recipientPoolSummary = summarizeRecipientPoolPressure({
    recipients: [mockRecipient()],
    availableNow: 0,
  })

  const recipientBreakdown = buildWarmupExecutorManualRunBreakdown({
    result: recipientCapResult,
    recipientPool: recipientCapResult.recipientPoolSummary!,
  })
  assert.equal(recipientBreakdown.sent, 0)
  assert.equal(recipientBreakdown.remainingProfiles, 1)
  assert.ok(recipientBreakdown.skipSummary.some((row) => row.code === "recipient_daily_cap"))
  assert.match(recipientBreakdown.noSendExplanation ?? "", /recipient/i)
  console.log("  ✓ Remaining capacity + no sends due to recipient cap")

  const senderCapResult = buildRunResult({
    senderResults: [
      {
        senderAccountId: "sender-1",
        senderEmail: "mike@equipify.ai",
        profileId: "profile-1",
        plannedToday: 5,
        sendsToday: 0,
        executorSendsToday: 0,
        remainingCapacity: 4,
        attempted: 0,
        sent: 0,
        skipped: 1,
        failed: 0,
        skipReasons: [{ code: "pre_send_blocked", message: "Sender daily send limit reached." }],
      },
    ],
    profileDiagnostics: [diagnostic],
  })
  const senderBreakdown = buildWarmupExecutorManualRunBreakdown({
    result: senderCapResult,
    recipientPool: summarizeRecipientPoolPressure({ recipients: [mockRecipient()], availableNow: 1 }),
  })
  assert.ok(senderBreakdown.skipSummary.some((row) => row.code === "pre_send_guard_blocked"))
  console.log("  ✓ Remaining capacity + no sends due to sender/pre-send guard")

  const idempotencyResult = buildRunResult({
    skipReasons: [{ code: "idempotent_skip", message: "Cron batch already ran for this hour." }],
    profileDiagnostics: [diagnostic],
  })
  const idempotencyBreakdown = buildWarmupExecutorManualRunBreakdown({
    result: idempotencyResult,
    recipientPool: summarizeRecipientPoolPressure({ recipients: [mockRecipient()], availableNow: 1 }),
  })
  assert.equal(normalizeWarmupSkipCodeForDisplay("idempotent_skip"), "idempotency_duplicate")
  assert.match(idempotencyBreakdown.noSendExplanation ?? "", /duplicate/i)
  console.log("  ✓ Remaining capacity + no sends due to idempotency duplicate")

  const staleBreakdown = buildWarmupExecutorManualRunBreakdown({
    result: recipientCapResult,
    recipientPool: recipientCapResult.recipientPoolSummary!,
    clientBuildMarker: "growth-warmup-executor-1a-v1",
  })
  assert.equal(staleBreakdown.productionBuildStale, true)
  assert.match(staleBreakdown.noSendExplanation ?? "", /1F executor/i)
  console.log("  ✓ Stale build marker reported")

  const successResult = buildRunResult({
    sendsSucceeded: 1,
    senderResults: [
      {
        senderAccountId: "sender-1",
        senderEmail: "mike@equipify.ai",
        profileId: "profile-1",
        plannedToday: 5,
        sendsToday: 1,
        executorSendsToday: 1,
        remainingCapacity: 3,
        attempted: 1,
        sent: 1,
        skipped: 0,
        failed: 0,
        skipReasons: [],
      },
    ],
    profileDiagnostics: [diagnostic],
  })
  successResult.recipientPoolSummary = summarizeRecipientPoolPressure({
    recipients: [mockRecipient()],
    availableNow: 1,
  })
  const successBreakdown = buildWarmupExecutorManualRunBreakdown({
    result: successResult,
    recipientPool: successResult.recipientPoolSummary!,
  })
  assert.equal(successBreakdown.sent, 1)
  assert.equal(successBreakdown.noSendExplanation, null)
  console.log("  ✓ Manual run sends immediately when no blockers")

  assert.ok(recipientBreakdown.profileResults[0]?.skipReason)
  assert.ok(recipientBreakdown.profileResults[0]?.skipCode)
  console.log("  ✓ Profile results include exact skip reason")

  const apiBody = buildWarmupExecutorSuccessBody(successResult)
  assert.equal(apiBody.executor_build_marker, GROWTH_WARMUP_EXECUTOR_BUILD_MARKER)
  assert.equal(apiBody.diagnostics_qa_marker, GROWTH_WARMUP_EXECUTOR_1G_QA_MARKER)
  assert.ok(apiBody.manualRunBreakdown)
  console.log("  ✓ API success body includes manualRunBreakdown")

  assert.equal(GROWTH_WARMUP_EXECUTOR_1C_QA_MARKER, "growth-warmup-executor-1c-v1")
  console.log("\nGS-GROWTH-WARMUP-EXECUTOR-1G passed.\n")
}

main()
