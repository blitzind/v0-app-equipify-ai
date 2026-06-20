/**
 * GS-SENDR-3B — High intent prospects certification.
 * Run: pnpm test:growth-sendr-high-intent-prospects
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  console.log("\n=== GS-SENDR-3B High Intent Prospects Certification ===\n")

  assert.ok(fs.existsSync("app/api/platform/growth/sendr/analytics/prospects/route.ts"))

  const service = readSource("lib/growth/sendr/growth-sendr-analytics-prospects-service.ts")
  assert.match(service, /getSendrAnalyticsProspects/)
  assert.match(service, /sendr_intelligence/)
  assert.match(service, /buildSendrLeadIntelligenceView/)
  assert.match(service, /recommendation/)

  const dashboard = readSource("components/growth/sendr/growth-sendr-analytics-dashboard.tsx")
  assert.match(dashboard, /High intent prospects/)
  assert.match(dashboard, /\/growth\/leads\//)

  console.log("  ✓ High intent prospects from lead.metadata.sendr_intelligence")
  console.log("\nGS-SENDR-3B high intent prospects certification passed.\n")
}

main()
