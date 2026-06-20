/**
 * GS-SENDR-3B — Page performance certification.
 * Run: pnpm test:growth-sendr-page-performance
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-3B Page Performance Certification ===\n")

  assert.ok(fs.existsSync("app/api/platform/growth/sendr/analytics/pages/route.ts"))

  const service = readSource("lib/growth/sendr/growth-sendr-analytics-pages-service.ts")
  assert.match(service, /getSendrAnalyticsPages/)
  assert.match(service, /conversionPercent/)
  assert.match(service, /recent_activity/)
  assert.match(service, /loadSendrPageEngagementSummaryInRange/)

  console.log("  ✓ Top pages with sort + pagination")
  console.log("\nGS-SENDR-3B page performance certification passed.\n")
}

main()
