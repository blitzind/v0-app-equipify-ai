/**
 * GS-RG-1 — event retention framework regression checks.
 * Run: pnpm test:growth-event-retention
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  computeRetentionCutoff,
  GROWTH_DEFAULT_EVENT_RETENTION_POLICIES,
  GROWTH_RETENTION_PROTECTED_TABLES,
  isRollupIndefinite,
} from "../lib/growth/runtime-guardrails/growth-event-retention-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  assert.equal(GROWTH_DEFAULT_EVENT_RETENTION_POLICIES.length, 5)
  assert.ok(GROWTH_DEFAULT_EVENT_RETENTION_POLICIES.every((policy) => policy.retentionDays === 90))
  assert.ok(GROWTH_DEFAULT_EVENT_RETENTION_POLICIES.every((policy) => isRollupIndefinite(policy.rollupRetentionDays)))

  const cutoff = computeRetentionCutoff(90, Date.parse("2026-06-19T00:00:00.000Z"))
  assert.match(cutoff, /2026-03/)

  assert.ok(GROWTH_RETENTION_PROTECTED_TABLES.includes("media_asset_event_rollups"))
  assert.ok(GROWTH_RETENTION_PROTECTED_TABLES.includes("video_page_rollups"))

  const retentionService = readSource("lib/growth/runtime-guardrails/growth-event-retention-service.ts")
  assert.match(retentionService, /runEventRetentionBatch/)
  assert.doesNotMatch(retentionService, /media_asset_event_rollups.*delete/i)

  const cronRoute = readSource("app/api/cron/growth-event-retention/route.ts")
  assert.match(cronRoute, /runAllEventRetentionBatches/)

  console.log("GS-RG-1 event retention regression checks passed.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
