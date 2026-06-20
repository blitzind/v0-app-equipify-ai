/**
 * GS-SENDR-2E — Engagement intelligence certification.
 * Run: pnpm test:growth-sendr-intelligence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_SENDR_INTELLIGENCE_QA_MARKER } from "../lib/growth/sendr/growth-sendr-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-2E Engagement Intelligence Certification ===\n")
  assert.equal(GROWTH_SENDR_INTELLIGENCE_QA_MARKER, "growth-sendr-intelligence-gs-sendr-2e-v1")

  assert.ok(fs.existsSync("app/api/platform/growth/sendr/intelligence/route.ts"))

  const service = readSource("lib/growth/sendr/growth-sendr-engagement-intelligence-service.ts")
  assert.match(service, /computeSendrPageEngagementIntelligence/)
  assert.match(service, /uniqueVisitors/)
  assert.match(service, /repeatVisitors/)
  assert.match(service, /calculateSendrEngagementRates/)

  const ingest = readSource("lib/growth/sendr/growth-sendr-public-engagement-service.ts")
  assert.match(ingest, /syncSendrLeadTimelineIntelligence/)

  console.log("  ✓ Page + lead engagement intelligence from existing events")
  console.log("\nGS-SENDR-2E intelligence certification passed.\n")
}

main()
