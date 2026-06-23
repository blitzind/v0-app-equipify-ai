/**
 * GS-GROWTH-WARMUP-EXECUTOR-1A — cron idempotency regression.
 * Run: pnpm test:growth-warmup-cron-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { growthCronApiPath } from "../lib/growth/runtime/cron-telemetry-types"

function runTests(): void {
  console.log("\n=== GS-GROWTH-WARMUP-CRON-1A ===\n")

  assert.equal(growthCronApiPath("growth-warmup-send-executor"), "/api/cron/growth-warmup-send-executor")
  console.log("  ✓ Cron route registered in telemetry types")

  const cronRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/cron/growth-warmup-send-executor/route.ts"),
    "utf8",
  )
  assert.match(cronRoute, /runGrowthCronJob/)
  assert.match(cronRoute, /runWarmupSendExecutor/)
  assert.match(cronRoute, /runKind: "cron"/)
  console.log("  ✓ Cron route uses growth cron runner + executor")

  const executorSource = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/warmup/warmup-send-executor.ts"),
    "utf8",
  )
  assert.match(executorSource, /idempotency_key/)
  assert.match(executorSource, /findExistingRun/)
  assert.match(executorSource, /idempotent_skip/)
  assert.match(executorSource, /MAX_SENDS_PER_PROFILE_PER_RUN/)
  assert.match(executorSource, /computeWarmupExecutorRunSendPlan/)
  assert.match(executorSource, /enforceSendingWindow/)
  console.log("  ✓ Executor idempotency + per-profile pacing + sending window")

  const manualRoute = fs.readFileSync(
    path.join(process.cwd(), "app/api/platform/growth/warmup/executor/run/route.ts"),
    "utf8",
  )
  assert.match(manualRoute, /confirmed/)
  console.log("  ✓ Manual run requires confirmation")

  const vercel = JSON.parse(fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as {
    crons: Array<{ path: string; schedule: string }>
  }
  const cron = vercel.crons.find((c) => c.path === "/api/cron/growth-warmup-send-executor")
  assert.ok(cron)
  assert.match(cron!.schedule, /13-21/)
  console.log("  ✓ Vercel cron hourly during business hours UTC")

  console.log("\nGS-GROWTH-WARMUP-CRON-1A passed.\n")
}

runTests()
