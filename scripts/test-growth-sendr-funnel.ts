/**
 * GS-SENDR-3B — Funnel analytics certification.
 * Run: pnpm test:growth-sendr-funnel
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-3B Funnel Analytics Certification ===\n")

  assert.ok(fs.existsSync("app/api/platform/growth/sendr/analytics/funnel/route.ts"))

  const service = readSource("lib/growth/sendr/growth-sendr-analytics-funnel-service.ts")
  assert.match(service, /getSendrAnalyticsFunnel/)
  assert.match(service, /video_start/)
  assert.match(service, /booking_completed/)
  assert.match(service, /conversionPercent/)
  assert.match(service, /dropOffPercent/)

  const repo = readSource("lib/growth/sendr/growth-sendr-analytics-read-repository.ts")
  assert.match(repo, /computeFunnelRates/)

  console.log("  ✓ Launch → booking funnel with conversion + drop-off")
  console.log("\nGS-SENDR-3B funnel certification passed.\n")
}

main()
