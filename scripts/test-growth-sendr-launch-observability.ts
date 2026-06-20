/**
 * GS-SENDR-3A — Launch observability certification.
 * Run: pnpm test:growth-sendr-launch-observability
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-3A Launch Observability Certification ===\n")

  const observability = readSource("lib/growth/sendr/growth-sendr-observability.ts")
  assert.match(observability, /launchesToday/)
  assert.match(observability, /launchPreviewsToday/)
  assert.match(observability, /launchFailuresToday/)
  assert.match(observability, /membersEnrolledViaLaunchesToday/)
  assert.match(observability, /analyticsLoadsToday/)
  assert.match(observability, /dashboardRefreshesToday/)

  const launchService = readSource("lib/growth/sendr/growth-sendr-launch-run-service.ts")
  assert.match(launchService, /continueSendrLaunchRun/)
  assert.match(launchService, /cancelSendrLaunchRun/)
  assert.match(observability, /launchFailuresToday/)
  assert.match(observability, /membersEnrolledViaLaunchesToday/)

  const dashboard = readSource("components/growth/growth-runtime-observability-dashboard.tsx")
  assert.match(dashboard, /Launches today/)
  assert.match(dashboard, /Launch previews today/)
  assert.match(dashboard, /Members enrolled via launches/)
  assert.match(dashboard, /Analytics loads today/)
  assert.match(dashboard, /Dashboard refreshes today/)

  console.log("  ✓ SENDR launch metrics on runtime card")
  console.log("\nGS-SENDR-3A launch observability certification passed.\n")
}

main()
