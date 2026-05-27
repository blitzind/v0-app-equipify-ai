/**
 * Regression checks for Warmup Engine Foundation (Phase 1D).
 * Run: pnpm test:growth-warmup
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildWarmupDashboard } from "../lib/growth/warmup/warmup-dashboard"
import { buildWarmupStatusChangeEvents } from "../lib/growth/warmup/warmup-event-builder"
import {
  computeCurrentWarmupDay,
  computeWarmupProgress,
  detectProgressMilestone,
  evaluateWarmupHealth,
} from "../lib/growth/warmup/warmup-health"
import { computeWarmupScore, warmupScoreToTier } from "../lib/growth/warmup/warmup-score"
import {
  computeDailyIncrement,
  computeTargetDailyVolume,
  generateWarmupScheduleDays,
  interpolateWarmupVolume,
} from "../lib/growth/warmup/warmup-scheduler"
import {
  GROWTH_WARMUP_FOUNDATION_QA_MARKER,
  GROWTH_WARMUP_PRIVACY_NOTE,
  GROWTH_WARMUP_TIMELINE_EVENT_TYPES,
} from "../lib/growth/warmup/warmup-types"
import { GROWTH_WARMUP_FOUNDATION_SCHEMA_MIGRATION } from "../lib/growth/warmup/warmup-schema-health"
import { GROWTH_SENDER_PROVIDER_CAPABILITIES } from "../lib/growth/sender/provider-sender-capabilities"

async function main(): Promise<void> {
  assert.equal(GROWTH_WARMUP_FOUNDATION_QA_MARKER, "growth-warmup-foundation-v1")
  assert.match(GROWTH_WARMUP_PRIVACY_NOTE, /no outbound|no sending/i)
  assert.equal(GROWTH_WARMUP_TIMELINE_EVENT_TYPES.length, 5)

  const migration = fs.readFileSync(
    path.join(process.cwd(), `supabase/migrations/${GROWTH_WARMUP_FOUNDATION_SCHEMA_MIGRATION}`),
    "utf8",
  )
  assert.match(migration, /growth\.warmup_profiles/)
  assert.match(migration, /growth\.warmup_schedule/)
  assert.match(migration, /growth\.warmup_events/)
  assert.match(migration, /warmup_started/)
  assert.match(migration, /warmup_progress_milestone/)
  assert.match(migration, /deleted_at/)
  assert.match(migration, /service role only/)

  assert.equal(interpolateWarmupVolume(1), 10)
  assert.equal(interpolateWarmupVolume(3), 20)
  assert.equal(interpolateWarmupVolume(7), 40)
  assert.equal(interpolateWarmupVolume(14), 80)
  assert.equal(interpolateWarmupVolume(21), 120)
  assert.equal(interpolateWarmupVolume(30), 150)
  assert.equal(interpolateWarmupVolume(2), 15)

  const schedule = generateWarmupScheduleDays(30)
  assert.equal(schedule.length, 30)
  assert.equal(schedule[0].planned_volume, 10)
  assert.equal(schedule[29].planned_volume, 150)
  assert.equal(computeTargetDailyVolume(30), 150)
  assert.equal(computeDailyIncrement(schedule), 5)

  assert.equal(computeWarmupScore({ status: "warming" }), 100)
  assert.equal(warmupScoreToTier(100), "healthy")
  assert.equal(warmupScoreToTier(75), "warning")
  assert.equal(warmupScoreToTier(55), "degraded")
  assert.equal(warmupScoreToTier(20), "critical")
  assert.equal(computeWarmupScore({ status: "paused" }), 80)
  assert.equal(
    computeWarmupScore({
      status: "warming",
      health_warning: true,
      progress_stalled: true,
      volume_behind_plan: true,
      has_critical_event: true,
    }),
    30,
  )

  const progress = computeWarmupProgress({
    status: "warming",
    warmup_days: 30,
    completed_days: 7,
    current_day_number: 8,
  })
  assert.equal(progress, 23)

  assert.equal(detectProgressMilestone(20, 26), 25)
  assert.equal(detectProgressMilestone(70, 72), null)

  const startedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  assert.equal(computeCurrentWarmupDay(startedAt), 3)

  const health = evaluateWarmupHealth({
    status: "paused",
    warmup_days: 30,
    warmup_progress: 10,
    current_daily_volume: 5,
    current_day_number: 3,
    schedule,
    last_progress_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  })
  assert.equal(health.warmup_score, 80)

  const events = buildWarmupStatusChangeEvents({
    senderEmail: "ops@example.com",
    previousStatus: "draft",
    nextStatus: "warming",
    previousScore: 100,
    nextScore: 90,
    previousProgress: 0,
    nextProgress: 25,
    progressMilestone: 25,
  })
  assert.ok(events.some((event) => event.timeline_type === "warmup_started"))
  assert.ok(events.some((event) => event.timeline_type === "warmup_progress_milestone"))

  const dashboard = buildWarmupDashboard([
    {
      id: "p1",
      sender_account_id: "s1",
      sender_email: "a@example.com",
      sender_display_name: "A",
      status: "warming",
      target_daily_volume: 150,
      current_daily_volume: 20,
      daily_increment: 5,
      warmup_days: 30,
      warmup_progress: 25,
      warmup_score: 95,
      warmup_health: "healthy",
      started_at: new Date().toISOString(),
      completed_at: null,
      last_progress_at: new Date().toISOString(),
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    },
    {
      id: "p2",
      sender_account_id: "s2",
      sender_email: "b@example.com",
      sender_display_name: "B",
      status: "paused",
      target_daily_volume: 150,
      current_daily_volume: 10,
      daily_increment: 5,
      warmup_days: 30,
      warmup_progress: 10,
      warmup_score: 70,
      warmup_health: "warning",
      started_at: null,
      completed_at: null,
      last_progress_at: null,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    },
  ])
  assert.equal(dashboard.qa_marker, GROWTH_WARMUP_FOUNDATION_QA_MARKER)
  assert.equal(dashboard.healthy_count, 1)
  assert.equal(dashboard.paused_count, 1)

  assert.equal(GROWTH_SENDER_PROVIDER_CAPABILITIES.google.supportsWarmup, true)
  assert.equal(GROWTH_SENDER_PROVIDER_CAPABILITIES.google.supportsWarmupScheduling, true)
  assert.equal(GROWTH_SENDER_PROVIDER_CAPABILITIES.google.supportsWarmupExecution, false)
  assert.equal(GROWTH_SENDER_PROVIDER_CAPABILITIES.smtp.supportsWarmupScheduling, false)

  const repoSource = fs.readFileSync(path.join(process.cwd(), "lib/growth/warmup/warmup-repository.ts"), "utf8")
  assert.match(repoSource, /softDeleteWarmupProfile/)
  assert.match(repoSource, /generateWarmupSchedule/)
  assert.match(repoSource, /deleted_at/)
  assert.doesNotMatch(repoSource, /sendMail|smtp\.send|outbound/i)

  const schedulerSource = fs.readFileSync(path.join(process.cwd(), "lib/growth/warmup/warmup-scheduler.ts"), "utf8")
  assert.match(schedulerSource, /interpolateWarmupVolume/)
  assert.doesNotMatch(schedulerSource, /sendMail|\.send\(|executeWarmup|warmupWorker/i)

  for (const route of [
    "app/api/platform/growth/warmup/route.ts",
    "app/api/platform/growth/warmup/dashboard/route.ts",
    "app/api/platform/growth/warmup/[id]/route.ts",
    "app/api/platform/growth/warmup/[id]/generate/route.ts",
    "app/api/platform/growth/warmup/[id]/pause/route.ts",
    "app/api/platform/growth/warmup/[id]/resume/route.ts",
  ]) {
    const apiSource = fs.readFileSync(path.join(process.cwd(), route), "utf8")
    assert.match(apiSource, /requireGrowthEnginePlatformAccess/)
  }

  const uiSource = fs.readFileSync(path.join(process.cwd(), "components/growth/growth-warmup-dashboard.tsx"), "utf8")
  assert.match(uiSource, /Warmup Overview/)
  assert.match(uiSource, /Schedule Viewer/)
  assert.match(uiSource, /Coming Soon/)
  assert.match(uiSource, /GROWTH_WARMUP_FOUNDATION_QA_MARKER/)

  const navSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/navigation/growth-navigation-destinations.ts"),
    "utf8",
  )
  assert.match(navSource, /\/admin\/growth\/infrastructure\/warmup/)

  console.log("growth-warmup: all checks passed")
}

void main()
