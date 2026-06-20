/**
 * GS-SENDR-3B — Analytics dashboard certification.
 * Run: pnpm test:growth-sendr-analytics
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_SENDR_ANALYTICS_QA_MARKER,
  GROWTH_SENDR_LIMITS,
} from "../lib/growth/sendr/growth-sendr-config"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-3B SENDR Analytics Certification ===\n")

  assert.equal(GROWTH_SENDR_ANALYTICS_QA_MARKER, "growth-sendr-analytics-gs-sendr-3b-v1")
  assert.equal(GROWTH_SENDR_LIMITS.MAX_SENDR_ANALYTICS_ROWS, 1000)
  assert.equal(GROWTH_SENDR_LIMITS.MAX_SENDR_ANALYTICS_LEADS, 500)
  assert.equal(GROWTH_SENDR_LIMITS.MAX_SENDR_ANALYTICS_PAGES, 500)

  assert.ok(fs.existsSync("app/(growth)/growth/sendr/analytics/page.tsx"))
  assert.ok(fs.existsSync("app/api/platform/growth/sendr/analytics/route.ts"))

  const service = readSource("lib/growth/sendr/growth-sendr-analytics-service.ts")
  assert.match(service, /getSendrAnalyticsWorkspaceSummary/)
  assert.match(service, /pagesNeedingAttention/)
  assert.match(service, /highIntentProspects/)

  const dashboard = readSource("components/growth/sendr/growth-sendr-analytics-dashboard.tsx")
  assert.match(dashboard, /GrowthSendrAnalyticsDashboard/)
  assert.match(dashboard, /Refresh/)
  assert.doesNotMatch(dashboard, /setInterval/)

  const guardrails = readSource("lib/growth/sendr/growth-sendr-analytics-guardrails.ts")
  assert.match(guardrails, /sendr_analytics_enabled/)
  assert.match(guardrails, /sendr_analytics/)
  assert.match(guardrails, /sendr_dashboard_refreshes/)

  console.log("  ✓ Read-only analytics dashboard + guardrails")
  console.log("\nGS-SENDR-3B analytics certification passed.\n")
}

main()
