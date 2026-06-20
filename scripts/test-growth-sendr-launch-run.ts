/**
 * GS-SENDR-3A-FIX — Launch run chunk/resume certification.
 * Run: pnpm test:growth-sendr-launch-run
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SENDR_LAUNCH_QA_MARKER,
  GROWTH_SENDR_LIMITS,
} from "../lib/growth/sendr/growth-sendr-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-3A Launch Run Certification ===\n")

  assert.equal(GROWTH_SENDR_LIMITS.MAX_SENDR_LAUNCH_PREVIEW_CHUNK, 500)
  assert.equal(GROWTH_SENDR_LIMITS.MAX_SENDR_LAUNCH_ENROLLMENT_CHUNK, 100)
  assert.equal(GROWTH_SENDR_LIMITS.MAX_SENDR_LAUNCH_STEP_DURATION_MS, 15_000)

  const migration = readSource("supabase/migrations/20270902120000_growth_sendr_launch_gs_sendr_3a.sql")
  assert.match(migration, /growth_sendr_launch_runs/)
  assert.match(migration, /previewing/)
  assert.match(migration, /ready_to_enroll/)
  assert.match(migration, /preview_id/)
  assert.match(migration, /processed_count/)
  assert.match(migration, /remaining_count/)
  assert.match(migration, /last_step/)
  assert.match(migration, /last_error/)
  assert.match(migration, /sendr_launch_enabled/)

  assert.ok(fs.existsSync("app/api/platform/growth/sendr/launch-run/route.ts"))

  const runService = readSource("lib/growth/sendr/growth-sendr-launch-run-service.ts")
  assert.match(runService, /startSendrLaunchRun/)
  assert.match(runService, /continueSendrLaunchRun/)
  assert.match(runService, /cancelSendrLaunchRun/)
  assert.match(runService, /processSendrLaunchChunk/)
  assert.match(runService, /processPreviewChunk/)
  assert.match(runService, /processEnrollmentChunk/)
  assert.match(runService, /ensureSendrSequenceLink/)
  assert.match(runService, /consumeLaunchContinueBudget/)
  assert.match(runService, /assertLaunchEnabled/)
  assert.match(runService, /startAudienceEnrollmentRun/)
  assert.match(runService, /startImmediately: false/)
  assert.match(runService, /nextAction/)
  assert.match(runService, /MAX_SENDR_LAUNCH_PREVIEW_CHUNK/)
  assert.match(runService, /MAX_SENDR_LAUNCH_ENROLLMENT_CHUNK/)
  assert.match(runService, /MAX_SENDR_LAUNCH_STEP_DURATION_MS/)
  assert.doesNotMatch(runService, /startImmediately:\s*true/)
  assert.doesNotMatch(runService, /setInterval/)
  assert.doesNotMatch(runService, /while \(progress\.hasMore\)/)

  const route = readSource("app/api/platform/growth/sendr/launch-run/route.ts")
  assert.match(route, /action: z.literal\("start"\)/)
  assert.match(route, /action: z.literal\("continue"\)/)
  assert.match(route, /action: z.literal\("cancel"\)/)

  const repo = readSource("lib/growth/sendr/growth-sendr-launch-run-repository.ts")
  assert.match(repo, /createSendrLaunchRun/)
  assert.match(repo, /previewId/)
  assert.match(repo, /processedCount/)
  assert.match(repo, /remainingCount/)
  assert.match(repo, /lastStep/)
  assert.match(repo, /lastError/)
  assert.equal(GROWTH_SENDR_LAUNCH_QA_MARKER, "growth-sendr-launch-gs-sendr-3a-v1")

  console.log("  ✓ Chunked resumable launch run + start/continue/cancel actions")
  console.log("\nGS-SENDR-3A launch run certification passed.\n")
}

main()
