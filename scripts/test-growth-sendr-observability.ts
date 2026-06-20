/**
 * GS-SENDR-2C — SENDR observability certification.
 * Run: pnpm test:growth-sendr-observability
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-2C Observability Certification ===\n")

  const observability = readSource("lib/growth/sendr/growth-sendr-observability.ts")
  assert.match(observability, /publicPageViewsToday/)
  assert.match(observability, /ctaClicksToday/)
  assert.match(observability, /countGrowthSendrEngagementEventsByTypeToday/)

  const dashboard = readSource("components/growth/growth-runtime-observability-dashboard.tsx")
  assert.match(dashboard, /Public page views today/)
  assert.match(dashboard, /CTA clicks today/)
  assert.doesNotMatch(dashboard, /setInterval/)

  console.log("  ✓ Runtime dashboard extended for public SENDR metrics")
  console.log("\nGS-SENDR-2C observability certification passed.\n")
}

main()
