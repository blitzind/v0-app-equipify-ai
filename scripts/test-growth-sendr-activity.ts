/**
 * GS-SENDR-3C — Activity workspace certification.
 * Run: pnpm test:growth-sendr-activity
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SENDR_ACTIVITY_QA_MARKER,
  GROWTH_SENDR_LIMITS,
} from "../lib/growth/sendr/growth-sendr-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-3C SENDR Activity Certification ===\n")

  assert.equal(GROWTH_SENDR_ACTIVITY_QA_MARKER, "growth-sendr-activity-gs-sendr-3c-v1")
  assert.equal(GROWTH_SENDR_LIMITS.MAX_SENDR_ACTIVITY_ROWS, 1000)
  assert.equal(GROWTH_SENDR_LIMITS.MAX_SENDR_ACTIVITY_FEED, 500)
  assert.equal(GROWTH_SENDR_LIMITS.MAX_SENDR_ACTIVITY_PROSPECTS, 500)

  assert.ok(fs.existsSync("app/(growth)/growth/activity/page.tsx"))
  assert.ok(fs.existsSync("app/(growth)/growth/sendr/activity/page.tsx"))
  assert.ok(fs.existsSync("app/api/platform/growth/sendr/activity/route.ts"))

  const service = readSource("lib/growth/sendr/growth-sendr-activity-service.ts")
  assert.match(service, /getSendrActivityWorkspaceSummary/)
  assert.match(service, /recentActivity/)
  assert.match(service, /hotProspects/)

  const dashboard = readSource("components/growth/sendr/growth-sendr-activity-dashboard.tsx")
  assert.match(dashboard, /Recent activity feed/)
  assert.match(dashboard, /Hot prospects queue/)
  assert.match(dashboard, /Follow-up recommendations/)
  assert.doesNotMatch(dashboard, /setInterval/)

  const guardrails = readSource("lib/growth/sendr/growth-sendr-activity-guardrails.ts")
  assert.match(guardrails, /sendr_activity_enabled/)
  assert.match(guardrails, /sendr_activity/)

  console.log("  ✓ Read-only activity workspace + guardrails")
  console.log("\nGS-SENDR-3C activity certification passed.\n")
}

main()
