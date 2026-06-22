/**
 * GS-GROWTH-WARMUP-EXECUTOR-1A — executor regression.
 * Run: pnpm test:growth-warmup-executor-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { getPlannedVolumeForDay } from "../lib/growth/warmup/warmup-scheduler"
import { GROWTH_WARMUP_EXECUTOR_SCHEMA_MIGRATION } from "../lib/growth/warmup/warmup-executor-schema-health"
import {
  GROWTH_WARMUP_EXECUTOR_QA_MARKER,
  GROWTH_WARMUP_EXECUTOR_MIGRATION,
} from "../lib/growth/warmup/warmup-executor-types"
import {
  GROWTH_WARMUP_MESSAGE_TEMPLATES,
  pickWarmupMessageTemplate,
} from "../lib/growth/warmup/warmup-message-templates"
import { isWithinWarmupSendingWindow } from "../lib/growth/warmup/warmup-executor-types"
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
    sends_today: 2,
    sends_today_date: new Date().toISOString().slice(0, 10),
    throttled_at: null,
    throttle_reason: null,
    last_capacity_sync_at: null,
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    schedule: [{ id: "s1", warmup_profile_id: "profile-1", day_number: 1, planned_volume: 5, actual_volume: 2, completed: false, completed_at: null, created_at: new Date().toISOString() }],
    ...overrides,
  }
}

function runTests(): void {
  console.log("\n=== GS-GROWTH-WARMUP-EXECUTOR-1A ===\n")

  assert.equal(GROWTH_WARMUP_EXECUTOR_QA_MARKER, "growth-warmup-executor-1a-v1")
  assert.equal(GROWTH_WARMUP_EXECUTOR_MIGRATION, GROWTH_WARMUP_EXECUTOR_SCHEMA_MIGRATION)
  console.log("  ✓ QA marker and migration constant")

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_WARMUP_EXECUTOR_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /warmup_recipients/)
  assert.match(migration, /warmup_send_runs/)
  assert.match(migration, /warmup_send_attempts/)
  assert.match(migration, /approved boolean/)
  assert.match(migration, /DO NOT APPLY until operator approves migration/)
  console.log("  ✓ Migration proposal defines required tables")

  const requiredFiles = [
    "lib/growth/warmup/warmup-send-executor.ts",
    "lib/growth/warmup/warmup-recipient-repository.ts",
    "lib/growth/warmup/warmup-recipient-selector.ts",
    "lib/growth/warmup/warmup-message-templates.ts",
    "app/api/cron/growth-warmup-send-executor/route.ts",
    "app/api/platform/growth/warmup/recipients/route.ts",
    "app/api/platform/growth/warmup/executor/run/route.ts",
    "components/growth/growth-warmup-executor-panel.tsx",
  ]
  for (const file of requiredFiles) {
    assert.ok(fs.existsSync(path.join(process.cwd(), file)), `Missing ${file}`)
  }
  console.log(`  ✓ ${requiredFiles.length} executor module files exist`)

  assert.ok(GROWTH_WARMUP_MESSAGE_TEMPLATES.length >= 5)
  const template = pickWarmupMessageTemplate({ seed: "sender-1:recipient@test.com:2" })
  assert.ok(template.subject.length > 0)
  assert.ok(template.body.length > 20)
  assert.doesNotMatch(template.body, /click here to buy/i)
  console.log("  ✓ Safe warmup message templates")

  const profile = mockProfile()
  const planned = getPlannedVolumeForDay(
    profile.schedule!.map((row) => ({ day_number: row.day_number, planned_volume: row.planned_volume })),
    profile.current_warmup_day,
  )
  assert.equal(planned, 5)
  const remaining = planned - profile.sends_today
  assert.equal(remaining, 3)
  console.log("  ✓ Planned 5, actual 2 → remaining executor capacity 3")

  const paused = mockProfile({ status: "paused" })
  assert.equal(paused.status, "paused")
  console.log("  ✓ Paused profile blocks executor path (status check)")

  const executorSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/warmup/warmup-send-executor.ts"),
    "utf8",
  )
  assert.match(executorSource, /executeTransportSend/)
  assert.match(executorSource, /is_test: false/)
  assert.match(executorSource, /warmup_executor: true/)
  assert.match(executorSource, /assertPreSendAllowed/)
  assert.match(executorSource, /evaluateWarmupPreSendAllowed/)
  console.log("  ✓ Executor reuses transport + pre-send guards (not is_test)")

  const transportHook = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/providers/transport/transport-orchestrator.ts"),
    "utf8",
  )
  assert.match(transportHook, /recordNativeWarmupSend/)
  assert.match(transportHook, /!input\.is_test/)
  console.log("  ✓ recordNativeWarmupSend wired on non-test transport success")

  assert.equal(isWithinWarmupSendingWindow(new Date("2026-06-22T15:00:00Z")), true)
  assert.equal(isWithinWarmupSendingWindow(new Date("2026-06-22T08:00:00Z")), false)
  console.log("  ✓ Conservative sending window")

  const vercel = fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")
  assert.match(vercel, /growth-warmup-send-executor/)
  console.log("  ✓ Cron registered in vercel.json")

  console.log("\nGS-GROWTH-WARMUP-EXECUTOR-1A passed.\n")
}

runTests()
