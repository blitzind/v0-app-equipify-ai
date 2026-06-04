/**
 * Phase 6.31A — native mailbox warmup execution regression checks.
 * Run: pnpm test:growth-native-warmup-execution
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_NATIVE_WARMUP_EXECUTION_MIGRATION,
  GROWTH_NATIVE_WARMUP_EXECUTION_QA_MARKER,
  NATIVE_WARMUP_DAY_MILESTONES,
} from "../lib/growth/warmup/warmup-execution-types"
import { interpolateWarmupVolume, DEFAULT_WARMUP_MILESTONES } from "../lib/growth/warmup/warmup-scheduler"
import { GROWTH_WARMUP_PROFILE_STATUSES } from "../lib/growth/warmup/warmup-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

assert.equal(GROWTH_NATIVE_WARMUP_EXECUTION_QA_MARKER, "growth-native-warmup-execution-v1")
assert.deepEqual(NATIVE_WARMUP_DAY_MILESTONES, DEFAULT_WARMUP_MILESTONES)
assert.equal(interpolateWarmupVolume(1), 5)
assert.equal(interpolateWarmupVolume(3), 10)
assert.equal(interpolateWarmupVolume(7), 20)
assert.equal(interpolateWarmupVolume(14), 35)
assert.equal(interpolateWarmupVolume(21), 50)
assert.equal(interpolateWarmupVolume(30), 75)

assert.deepEqual([...GROWTH_WARMUP_PROFILE_STATUSES], [
  "new",
  "warming",
  "active",
  "throttled",
  "paused",
  "disabled",
])

const migration = fs.readFileSync(
  path.join(process.cwd(), `supabase/migrations/${GROWTH_NATIVE_WARMUP_EXECUTION_MIGRATION}`),
  "utf8",
)
assert.match(migration, /current_warmup_day/)
assert.match(migration, /sends_today/)
assert.match(migration, /'new', 'warming', 'active', 'throttled'/)
assert.match(migration, /warmup_stage_changed/)

const execution = readSource("lib/growth/warmup/warmup-execution.ts")
assert.match(execution, /recordNativeWarmupSend/)
assert.match(execution, /runNativeWarmupProgressionBatch/)
assert.match(execution, /syncSenderWarmupCapacity/)

const preSend = readSource("lib/growth/warmup/warmup-pre-send-guard.ts")
assert.match(preSend, /evaluateWarmupPreSendAllowed/)
assert.match(preSend, /warmup_cap_exhausted/)

const infra = readSource("lib/growth/compliance/pre-send-infrastructure-guards.ts")
assert.match(infra, /evaluateWarmupPreSendAllowed/)

const transport = readSource("lib/growth/providers/transport/transport-orchestrator.ts")
assert.match(transport, /recordNativeWarmupSend/)

const cronRoute = readSource("app/api/cron/growth-warmup-progression/route.ts")
assert.match(cronRoute, /runNativeWarmupProgressionBatch/)

const vercel = JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as {
  crons: Array<{ path: string }>
}
assert.ok(vercel.crons.some((c) => c.path === "/api/cron/growth-warmup-progression"))

const rotation = readSource("lib/growth/sender-pools/sender-pool-rotation-service.ts")
assert.match(rotation, /warmup_profiles/)
assert.doesNotMatch(rotation, /warmup_enabled \? 50 : 100/)

console.log("growth native warmup execution tests passed")
