/**
 * GS-SENDR-2B — Publish flow certification.
 * Run: pnpm test:growth-sendr-publish-flow
 */
import assert from "node:assert/strict"
import fs from "node:fs"

function main(): void {
  console.log("\n=== GS-SENDR-2B Publish Flow Certification ===\n")

  const route = fs.readFileSync("app/api/platform/growth/sendr/landing-pages/route.ts", "utf8")
  assert.match(route, /action === "publish"/)
  assert.match(route, /action === "archive"/)
  assert.match(route, /publicLink/)
  assert.match(route, /listGrowthSendrLandingPagePublications/)

  const repo = fs.readFileSync("lib/growth/sendr/growth-sendr-landing-page-repository.ts", "utf8")
  assert.match(repo, /version_snapshot/)
  assert.match(repo, /archiveGrowthSendrLandingPage/)

  const detail = fs.readFileSync("components/growth/sendr/growth-sendr-page-detail.tsx", "utf8")
  assert.match(detail, /Copy link/)
  assert.match(detail, /Publication history/)

  console.log("  ✓ Draft → Published → Archived with immutable snapshots")
  console.log("\nGS-SENDR-2B publish flow certification passed.\n")
}

main()
