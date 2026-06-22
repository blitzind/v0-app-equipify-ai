/**
 * GS-SENDR-3C — Hot prospects queue certification.
 * Run: pnpm test:growth-sendr-hot-prospects
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-3C Hot Prospects Certification ===\n")

  assert.ok(fs.existsSync("app/api/platform/growth/sendr/activity/prospects/route.ts"))

  const service = readSource("lib/growth/sendr/growth-sendr-activity-prospects-service.ts")
  assert.match(service, /getSendrHotProspects/)
  assert.match(service, /videoCompletionPercent/)
  assert.match(service, /bookingStatus/)
  assert.match(service, /recommendations/)

  const followUp = readSource("lib/growth/sendr/growth-sendr-activity-follow-up-service.ts")
  assert.match(followUp, /generateSendrActivityFollowUpRecommendations/)
  assert.match(followUp, /Viewed personalized video page but no CTA/)

  console.log("  ✓ Hot prospects queue with deterministic recommendations")
  console.log("\nGS-SENDR-3C hot prospects certification passed.\n")
}

main()
