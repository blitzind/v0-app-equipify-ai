/**
 * GS-SENDR-2A — SENDR media asset registry certification (distinct from S1.5 media_assets).
 * Run: pnpm test:growth-sendr-media-assets
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SENDR_LIMITS,
  GROWTH_SENDR_MEDIA_ASSET_TYPES,
  GROWTH_SENDR_QA_MARKER,
  GROWTH_SENDR_SCHEMA_MIGRATION,
} from "../lib/growth/sendr/growth-sendr-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-2A Media Asset Registry Certification ===\n")
  assert.equal(GROWTH_SENDR_QA_MARKER, "growth-personalized-media-runtime-gs-sendr-2a-v1")
  assert.equal(GROWTH_SENDR_LIMITS.MAX_MEDIA_ASSETS_PER_ORG, 5_000)
  assert.deepEqual([...GROWTH_SENDR_MEDIA_ASSET_TYPES], [
    "page", "video", "avatar_video", "voice", "calendar", "cta", "conversation_agent",
  ])

  const migration = readSource(`supabase/migrations/${GROWTH_SENDR_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth_media_assets/)
  assert.match(migration, /growth_media_asset_versions/)
  assert.match(migration, /growth_media_asset_access_logs/)
  assert.match(migration, /media_assets_enabled/)

  const repo = readSource("lib/growth/sendr/growth-sendr-media-asset-repository.ts")
  assert.match(repo, /createGrowthSendrMediaAsset/)
  assert.match(repo, /publishGrowthSendrMediaAssetVersion/)
  assert.doesNotMatch(repo, /setInterval/)

  console.log("  ✓ Versioned SENDR media asset registry (metadata only)")
  console.log("\nGS-SENDR-2A media asset registry certification passed.\n")
}

main()
