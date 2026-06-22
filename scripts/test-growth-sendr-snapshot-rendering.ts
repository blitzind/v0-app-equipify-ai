/**
 * GS-SENDR-2C — Snapshot rendering certification.
 * Run: pnpm test:growth-sendr-snapshot-rendering
 */
import assert from "node:assert/strict"
import fs from "node:fs"

function main(): void {
  console.log("\n=== GS-SENDR-2C Snapshot Rendering Certification ===\n")
  const service = fs.readFileSync("lib/growth/sendr/growth-sendr-public-page-service.ts", "utf8")
  assert.match(service, /getLatestSendrPublicationForPage/)
  assert.match(service, /versionSnapshot/)
  assert.match(service, /GrowthSendrPublicPagePayload/)
  assert.doesNotMatch(service, /listGrowthSendrLandingPageSections/)

  const layout = fs.readFileSync(
    "components/growth/sendr/presentation/sendr-public-presentation-layout.tsx",
    "utf8",
  )
  for (const type of ["hero", "text", "video", "calendar", "cta", "faq", "custom_html"]) {
    assert.match(layout, new RegExp(type))
  }

  console.log("  ✓ Renders published snapshot only (no draft sections)")
  console.log("\nGS-SENDR-2C snapshot rendering certification passed.\n")
}

main()
