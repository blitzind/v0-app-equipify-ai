/**
 * GS-SENDR-2B — Page detail / editor surface certification.
 * Run: pnpm test:growth-sendr-page-detail
 */
import assert from "node:assert/strict"
import fs from "node:fs"

function main(): void {
  console.log("\n=== GS-SENDR-2B Page Detail Certification ===\n")
  assert.ok(fs.existsSync("app/(growth)/growth/sendr/[pageId]/page.tsx"))
  assert.ok(fs.existsSync("components/growth/sendr/growth-sendr-page-detail.tsx"))

  const detail = fs.readFileSync("components/growth/sendr/growth-sendr-page-detail.tsx", "utf8")
  for (const tab of ["overview", "sections", "personalization", "media", "booking", "publish"]) {
    assert.match(detail, new RegExp(tab, "i"))
  }
  assert.match(detail, /include=detail/)
  assert.doesNotMatch(detail, /drag/i)

  console.log("  ✓ Page detail editor with tabbed sections")
  console.log("\nGS-SENDR-2B page detail certification passed.\n")
}

main()
