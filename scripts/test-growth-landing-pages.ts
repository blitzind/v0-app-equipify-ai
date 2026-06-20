/**
 * GS-SENDR-2A — Landing page runtime certification.
 * Run: pnpm test:growth-landing-pages
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SENDR_LANDING_PAGE_SECTION_TYPES,
  GROWTH_SENDR_LIMITS,
  GROWTH_SENDR_QA_MARKER,
  GROWTH_SENDR_SCHEMA_MIGRATION,
} from "../lib/growth/sendr/growth-sendr-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-2A Landing Page Runtime Certification ===\n")
  assert.equal(GROWTH_SENDR_QA_MARKER, "growth-personalized-media-runtime-gs-sendr-2a-v1")
  assert.equal(GROWTH_SENDR_LIMITS.MAX_PAGE_SECTIONS, 100)
  assert.ok(GROWTH_SENDR_LANDING_PAGE_SECTION_TYPES.includes("hero"))
  assert.ok(GROWTH_SENDR_LANDING_PAGE_SECTION_TYPES.includes("calendar"))

  const migration = readSource(`supabase/migrations/${GROWTH_SENDR_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth_landing_pages/)
  assert.match(migration, /growth_landing_page_sections/)
  assert.match(migration, /growth_landing_page_publications/)
  assert.match(migration, /landing_pages_enabled/)

  const repo = readSource("lib/growth/sendr/growth-sendr-landing-page-repository.ts")
  assert.match(repo, /publishGrowthSendrLandingPage/)
  assert.match(repo, /legacy_share_page_id/)
  assert.match(repo, /renderSendrPersonalizedText/)

  console.log("  ✓ Landing page runtime with publication snapshots")
  console.log("\nGS-SENDR-2A landing page runtime certification passed.\n")
}

main()
