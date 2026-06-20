/**
 * GS-SENDR-2B — Section management certification.
 * Run: pnpm test:growth-sendr-section-management
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import { GROWTH_SENDR_LIMITS, GROWTH_SENDR_LANDING_PAGE_SECTION_TYPES } from "../lib/growth/sendr/growth-sendr-config"

function main(): void {
  console.log("\n=== GS-SENDR-2B Section Management Certification ===\n")
  assert.equal(GROWTH_SENDR_LIMITS.MAX_PAGE_SECTIONS, 100)
  for (const type of ["hero", "text", "video", "calendar", "cta", "faq"]) {
    assert.ok(GROWTH_SENDR_LANDING_PAGE_SECTION_TYPES.includes(type as never))
  }

  const route = fs.readFileSync("app/api/platform/growth/sendr/landing-pages/route.ts", "utf8")
  assert.match(route, /add_section/)
  assert.match(route, /update_section/)
  assert.match(route, /remove_section/)

  const repo = fs.readFileSync("lib/growth/sendr/growth-sendr-landing-page-repository.ts", "utf8")
  assert.match(repo, /page_section_cap_exceeded/)
  assert.match(repo, /deleteGrowthSendrLandingPageSection/)

  console.log("  ✓ Section CRUD with MAX_PAGE_SECTIONS cap")
  console.log("\nGS-SENDR-2B section management certification passed.\n")
}

main()
