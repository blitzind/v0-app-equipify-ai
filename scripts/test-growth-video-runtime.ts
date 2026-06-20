/**
 * GS-SENDR-2A — Video runtime certification.
 * Run: pnpm test:growth-video-runtime
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_SENDR_SCHEMA_MIGRATION } from "../lib/growth/sendr/growth-sendr-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-2A Video Runtime Certification ===\n")
  const migration = readSource(`supabase/migrations/${GROWTH_SENDR_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth_video_assets/)
  assert.match(migration, /growth_video_asset_events/)
  assert.match(migration, /poster_url/)
  assert.match(migration, /transcript_status/)
  assert.match(migration, /video_tracking_enabled/)

  const repo = readSource("lib/growth/sendr/growth-sendr-video-runtime-repository.ts")
  assert.match(repo, /registerGrowthSendrVideoAssetMetadata/)
  assert.doesNotMatch(repo, /transcod/)
  assert.doesNotMatch(repo, /worker/)

  console.log("  ✓ Video metadata registry — operator upload only")
  console.log("\nGS-SENDR-2A video runtime certification passed.\n")
}

main()
