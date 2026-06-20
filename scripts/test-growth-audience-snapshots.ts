/**
 * GS-RG-2A — Audience snapshot foundation certification (local static).
 * Run: pnpm test:growth-audience-snapshots
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AUDIENCE_LIMITS,
  GROWTH_AUDIENCE_QA_MARKER,
  GROWTH_AUDIENCE_SCHEMA_MIGRATION,
  estimateAudienceSnapshotBatches,
} from "../lib/growth/audiences/growth-audience-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-RG-2A Audience Snapshots Certification ===\n")

  assert.equal(GROWTH_AUDIENCE_QA_MARKER, "growth-dynamic-audiences-gs-rg-2c-v1")
  assert.equal(GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_MEMBERS_PER_SNAPSHOT, 10_000)
  assert.equal(GROWTH_AUDIENCE_LIMITS.SNAPSHOT_SEARCH_PAGE_SIZE, 500)

  const migration = readSource(`supabase/migrations/${GROWTH_AUDIENCE_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth_audiences/)
  assert.match(migration, /growth_audience_snapshots/)
  assert.match(migration, /growth_audience_members/)
  assert.match(migration, /growth_audience_refresh_runs/)
  assert.match(migration, /manual_only/)
  assert.match(migration, /audience_snapshot_enabled/)

  const snapshotService = readSource("lib/growth/audiences/growth-audience-snapshot-service.ts")
  assert.match(snapshotService, /runProspectSearch/)
  assert.match(snapshotService, /insertGrowthAudienceMembersBatch/)
  assert.match(snapshotService, /snapshot_cursor|snapshotCursor/)
  assert.match(snapshotService, /processed_count|processedCount/)
  assert.match(snapshotService, /remaining_estimate|remainingEstimate/)
  assert.doesNotMatch(snapshotService, /setInterval/)

  const est = estimateAudienceSnapshotBatches(10_000)
  assert.equal(est.searchPages, 20)
  assert.equal(est.memberInsertBatches, 50)

  console.log("  ✓ Migration + batched snapshot generation")
  console.log("\nGS-RG-2A audience snapshots certification passed.\n")
}

main()
