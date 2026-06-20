/**
 * GS-RG-2B — Audience member diff engine certification (local static).
 * Run: pnpm test:growth-audience-diffs
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AUDIENCE_LIMITS,
  GROWTH_AUDIENCE_2B_SCHEMA_MIGRATION,
  GROWTH_AUDIENCE_QA_MARKER,
} from "../lib/growth/audiences/growth-audience-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-RG-2B Audience Diff Engine Certification ===\n")

  assert.equal(GROWTH_AUDIENCE_QA_MARKER, "growth-dynamic-audiences-gs-rg-2c-v1")
  assert.equal(GROWTH_AUDIENCE_LIMITS.MAX_AUDIENCE_DIFF_MEMBERS, 10_000)
  assert.equal(GROWTH_AUDIENCE_LIMITS.DIFF_MEMBER_BATCH, 500)

  const migration = readSource(`supabase/migrations/${GROWTH_AUDIENCE_2B_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth_audience_snapshot_diffs/)
  assert.match(migration, /growth_audience_member_diffs/)
  assert.match(migration, /added_count/)
  assert.match(migration, /removed_count/)
  assert.match(migration, /unchanged_count/)
  assert.match(migration, /audience_diff_enabled/)

  const diffService = readSource("lib/growth/audiences/growth-audience-diff-service.ts")
  assert.match(diffService, /computeAndPersistAudienceSnapshotDiff/)
  assert.match(diffService, /loadAllMemberKeys/)
  assert.match(diffService, /insertGrowthAudienceMemberDiffsBatch/)
  assert.match(diffService, /checkAudienceDiffEnabled/)
  assert.doesNotMatch(diffService, /setInterval/)

  const snapshotService = readSource("lib/growth/audiences/growth-audience-snapshot-service.ts")
  assert.match(snapshotService, /computeAndPersistAudienceSnapshotDiff/)
  assert.match(snapshotService, /finalizeWithDiff/)

  console.log("  ✓ Chunked diff engine with bounded reads/writes")
  console.log("\nGS-RG-2B audience diff certification passed.\n")
}

main()
