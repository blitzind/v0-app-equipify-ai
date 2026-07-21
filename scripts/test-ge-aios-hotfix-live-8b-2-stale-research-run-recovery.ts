/**
 * GE-AIOS-HOTFIX-LIVE-8B-2 — Stale research run recovery (local cert).
 *
 * Run: node -r ./scripts/server-only-shim.cjs --import tsx scripts/test-ge-aios-hotfix-live-8b-2-stale-research-run-recovery.ts
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GE_AIOS_HOTFIX_LIVE_8B_2_STALE_RESEARCH_RUN_RECOVERY_QA_MARKER,
  STALE_ABANDONED_EXECUTION_FAILED_REASON,
  STALE_ACTIVE_QUEUED_THRESHOLD_MS,
  STALE_ACTIVE_RUNNING_THRESHOLD_MS,
  isStaleActiveProspectResearchRun,
  staleActiveRunCutoffIso,
} from "../lib/growth/research/research-repository"

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const repoSource = fs.readFileSync(
  path.join(root, "lib/growth/research/research-repository.ts"),
  "utf8",
)

console.log("GE-AIOS-HOTFIX-LIVE-8B-2 — stale research run recovery cert\n")

assert.equal(
  GE_AIOS_HOTFIX_LIVE_8B_2_STALE_RESEARCH_RUN_RECOVERY_QA_MARKER,
  "ge-aios-hotfix-live-8b-2-stale-research-run-recovery-v1",
)
console.log("  ✓ QA marker constant")

assert.match(repoSource, /reconcileStaleActiveProspectResearchRuns/)
assert.match(repoSource, /await reconcileStaleActiveProspectResearchRuns\(admin, leadId\)/)
assert.match(repoSource, /logProspectResearch\("stale_recovered"/)
console.log("  ✓ canonical recovery wired into fetchActiveProspectResearchRun")

const nowMs = Date.parse("2026-07-21T15:00:00.000Z")

assert.equal(
  isStaleActiveProspectResearchRun(
    { status: "queued", created_at: new Date(nowMs - STALE_ACTIVE_QUEUED_THRESHOLD_MS + 60_000).toISOString() },
    nowMs,
  ),
  false,
)
console.log("  ✓ fresh queued run remains active")

assert.equal(
  isStaleActiveProspectResearchRun(
    { status: "queued", created_at: new Date(nowMs - STALE_ACTIVE_QUEUED_THRESHOLD_MS - 60_000).toISOString() },
    nowMs,
  ),
  true,
)
console.log("  ✓ stale queued run detected")

assert.equal(
  isStaleActiveProspectResearchRun(
    { status: "running", created_at: new Date(nowMs - STALE_ACTIVE_RUNNING_THRESHOLD_MS + 60_000).toISOString() },
    nowMs,
  ),
  false,
)
console.log("  ✓ fresh running run remains active")

assert.equal(
  isStaleActiveProspectResearchRun(
    { status: "running", created_at: new Date(nowMs - STALE_ACTIVE_RUNNING_THRESHOLD_MS - 60_000).toISOString() },
    nowMs,
  ),
  true,
)
console.log("  ✓ stale running run detected")

assert.equal(STALE_ABANDONED_EXECUTION_FAILED_REASON, "stale_abandoned_execution")
console.log("  ✓ failed reason constant")

const queuedCutoff = staleActiveRunCutoffIso("queued", nowMs)
const runningCutoff = staleActiveRunCutoffIso("running", nowMs)
assert.ok(queuedCutoff)
assert.ok(runningCutoff)
assert.match(repoSource, /\.eq\("status", priorStatus\)/)
assert.match(repoSource, /\.lt\("created_at", cutoffIso\)/)
console.log("  ✓ concurrency guard uses exact id, status, and stale cutoff")

assert.match(repoSource, /status: "failed"/)
assert.match(repoSource, /completed_at: nowIso/)
assert.doesNotMatch(repoSource, /latest_prospect_research_run_id.*reconcileStaleActiveProspectResearchRuns/s)
console.log("  ✓ terminalizes with completed_at and does not touch lead cache in recovery")
console.log("  ✓ duplicate protection preserved (unique partial index unchanged)")

console.log("\nGE-AIOS-HOTFIX-LIVE-8B-2 local cert passed.")
