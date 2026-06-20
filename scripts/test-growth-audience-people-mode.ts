/**
 * GS-RG-2B — Audience people mode certification (local static).
 * Run: pnpm test:growth-audience-people-mode
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_AUDIENCE_RESULT_MODES } from "../lib/growth/audiences/growth-audience-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-RG-2B Audience People Mode Certification ===\n")

  assert.deepEqual([...GROWTH_AUDIENCE_RESULT_MODES], ["companies", "people"])

  const migration = readSource("supabase/migrations/20270901150000_growth_dynamic_audiences_gs_rg_2b.sql")
  assert.match(migration, /result_mode/)
  assert.match(migration, /growth_person_id/)
  assert.match(migration, /canonical_person_id/)
  assert.match(migration, /member_kind/)

  const snapshotService = readSource("lib/growth/audiences/growth-audience-snapshot-service.ts")
  assert.match(snapshotService, /mapPersonToMember/)
  assert.match(snapshotService, /result_mode: resultMode/)
  assert.match(snapshotService, /people_cursor/)
  assert.match(snapshotService, /people_rows/)
  assert.doesNotMatch(snapshotService, /bulkEnroll/)

  const repo = readSource("lib/growth/audiences/growth-audience-repository.ts")
  assert.match(repo, /growth_person_id/)
  assert.match(repo, /member_key/)

  const detail = readSource("components/growth/audiences/growth-audience-detail.tsx")
  assert.match(detail, /memberKind === "person"/)
  assert.match(detail, /resultMode/)

  console.log("  ✓ People snapshots — review first, no auto lead creation")
  console.log("\nGS-RG-2B audience people mode certification passed.\n")
}

main()
