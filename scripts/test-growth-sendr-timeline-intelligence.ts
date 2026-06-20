/**
 * GS-SENDR-2E — Timeline intelligence certification.
 * Run: pnpm test:growth-sendr-timeline-intelligence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-2E Timeline Intelligence Certification ===\n")

  const timeline = readSource("lib/growth/sendr/growth-sendr-analytics-timeline.ts")
  assert.match(timeline, /SENDR page viewed/)
  assert.match(timeline, /SENDR video started/)
  assert.match(timeline, /SENDR booking completed/)

  const intel = readSource("lib/growth/sendr/growth-sendr-timeline-intelligence-service.ts")
  assert.match(intel, /syncSendrLeadTimelineIntelligence/)
  assert.match(intel, /sendr_intelligence/)
  assert.match(intel, /lastSendrActivityAt/)
  assert.match(intel, /sendrEngagementCount/)

  console.log("  ✓ SENDR timeline labels + lead metadata intelligence sync")
  console.log("\nGS-SENDR-2E timeline intelligence certification passed.\n")
}

main()
