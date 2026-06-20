/**
 * GS-SENDR-2E — SENDR observability certification.
 * Run: pnpm test:growth-sendr-observability
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-2E Observability Certification ===\n")

  const observability = readSource("lib/growth/sendr/growth-sendr-observability.ts")
  assert.match(observability, /pagesLinkedToday/)
  assert.match(observability, /intentCalculationsToday/)
  assert.match(observability, /recommendationsGeneratedToday/)
  assert.match(observability, /timelineWritesToday/)
  assert.match(observability, /launchesToday/)
  assert.match(observability, /launchPreviewsToday/)

  const dashboard = readSource("components/growth/growth-runtime-observability-dashboard.tsx")
  assert.match(dashboard, /Intent calculations today/)
  assert.match(dashboard, /Recommendations generated/)
  assert.match(dashboard, /Timeline writes today/)
  assert.match(dashboard, /Launches today/)
  assert.doesNotMatch(dashboard, /setInterval/)

  console.log("  ✓ Runtime dashboard extended for SENDR intelligence metrics")
  console.log("\nGS-SENDR-2E observability certification passed.\n")
}

main()
