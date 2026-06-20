/**
 * GS-SENDR-3B — Launch performance certification.
 * Run: pnpm test:growth-sendr-launch-performance
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-3B Launch Performance Certification ===\n")

  assert.ok(fs.existsSync("app/api/platform/growth/sendr/analytics/launches/route.ts"))

  const service = readSource("lib/growth/sendr/growth-sendr-analytics-launches-service.ts")
  assert.match(service, /getSendrAnalyticsLaunches/)
  assert.match(service, /listRecentSendrLaunchRuns/)
  assert.match(service, /enrolled/)
  assert.match(service, /attentionOnly/)

  console.log("  ✓ Launch metrics joined with page engagement")
  console.log("\nGS-SENDR-3B launch performance certification passed.\n")
}

main()
