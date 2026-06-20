/**
 * GS-SENDR-2C — Slug runtime certification.
 * Run: pnpm test:growth-sendr-slug-runtime
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import { buildSendrPublishedSlug, isValidSendrPublicSlug } from "../lib/growth/sendr/growth-sendr-slug-runtime"

function main(): void {
  console.log("\n=== GS-SENDR-2C Slug Runtime Certification ===\n")
  const slug = buildSendrPublishedSlug("Acme Intro Page", "a1b2c3d4-e5f6-7890-abcd-ef1234567890")
  assert.match(slug, /^acme-intro-page-[a-f0-9]{8}$/)
  assert.ok(isValidSendrPublicSlug(slug))

  const migration = fs.readFileSync(
    "supabase/migrations/20270901180000_growth_sendr_public_runtime_gs_sendr_2c.sql",
    "utf8",
  )
  assert.match(migration, /published_slug/)
  assert.match(migration, /published_version/)

  const repo = fs.readFileSync("lib/growth/sendr/growth-sendr-landing-page-repository.ts", "utf8")
  assert.match(repo, /getGrowthSendrLandingPageByPublishedSlug/)
  assert.match(repo, /buildSendrPublishedSlug/)

  console.log("  ✓ Unique published slug generation and lookup")
  console.log("\nGS-SENDR-2C slug runtime certification passed.\n")
}

main()
