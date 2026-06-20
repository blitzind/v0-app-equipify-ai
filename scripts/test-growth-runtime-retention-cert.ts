/**
 * GS-RG-1B — Event retention dry-run certification (local static).
 * Run: pnpm test:growth-runtime-retention-cert
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  computeRetentionCutoff,
  GROWTH_DEFAULT_EVENT_RETENTION_POLICIES,
  GROWTH_EVENT_RETENTION_TABLE_MAP,
  GROWTH_RETENTION_PROTECTED_TABLES,
} from "../lib/growth/runtime-guardrails/growth-event-retention-config"
import { GROWTH_RUNTIME_GUARDRAIL_LIMITS } from "../lib/growth/runtime-guardrails/growth-runtime-guardrail-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-RG-1B Retention Certification (Dry-Run Plan) ===\n")

  assert.equal(GROWTH_RUNTIME_GUARDRAIL_LIMITS.RAW_EVENT_RETENTION_DAYS, 90)
  assert.equal(GROWTH_RUNTIME_GUARDRAIL_LIMITS.RETENTION_DELETE_BATCH, 1000)

  for (const policy of GROWTH_DEFAULT_EVENT_RETENTION_POLICIES) {
    assert.equal(policy.retentionDays, 90)
    assert.ok(policy.rollupRetentionDays < 0, `${policy.eventFamily} rollups must be indefinite`)
  }
  console.log("  ✓ Default 90-day raw retention, indefinite rollups")

  for (const protectedTable of GROWTH_RETENTION_PROTECTED_TABLES) {
    const retentionService = readSource("lib/growth/runtime-guardrails/growth-event-retention-service.ts")
    assert.doesNotMatch(retentionService, new RegExp(`from\\("${protectedTable}"\\).*delete`, "i"))
  }
  console.log("  ✓ Retention worker never targets protected rollup tables")

  const families = Object.keys(GROWTH_EVENT_RETENTION_TABLE_MAP)
  const batchSize = GROWTH_RUNTIME_GUARDRAIL_LIMITS.RETENTION_DELETE_BATCH
  console.log("\n  Dry-run daily worker plan:")
  console.log(`  - ${families.length} event families × up to ${batchSize} deletes = ${families.length * batchSize} max deletes/day`)
  console.log("  - Cursor: runtime_retention_batch_state.last_deleted_id per family")
  console.log("  - Resumable: hasMore=true when batch full")
  console.log("  - Kill switch: retention_worker_enabled")

  const cutoff = computeRetentionCutoff(90)
  console.log(`  - Cutoff example (90d): ${cutoff}`)

  const cronRoute = readSource("app/api/cron/growth-event-retention/route.ts")
  assert.match(cronRoute, /runAllEventRetentionBatches/)
  assert.match(readSource("vercel.json"), /growth-event-retention/)

  console.log("\n  Post-deploy production dry-run steps:")
  console.log("  1. Verify growth_event_retention_config rows seeded")
  console.log("  2. Enable retention_worker_enabled=true")
  console.log("  3. POST /api/cron/growth-event-retention with cron secret")
  console.log("  4. Confirm deleted_count increments in runtime_retention_batch_state")
  console.log("  5. Confirm media_asset_event_rollups row counts unchanged")

  console.log("\nGS-RG-1B retention certification passed.\n")
}

main()
