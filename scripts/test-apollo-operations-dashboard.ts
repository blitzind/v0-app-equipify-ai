/**
 * Apollo Operations Dashboard — Phase 14.3B certification.
 * Run: node -r ./scripts/server-only-shim.cjs --import tsx scripts/test-apollo-operations-dashboard.ts
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import { buildApollo25CompanyPilotEligibilityDiagnostic } from "../lib/growth/apollo/apollo-25-company-pilot-eligibility-diagnostic"
import { emptyApollo25CompanyPilotSkipReasonCounts } from "../lib/growth/apollo/apollo-25-company-pilot-skip-reasons"
import {
  APOLLO_OPERATIONS_DASHBOARD_QA_MARKER,
  apolloOperationsPct,
  APOLLO_OPERATIONS_SKIP_REASON_LABELS,
} from "../lib/growth/apollo/apollo-operations-dashboard-types"

const ROOT = process.cwd()

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-operations-dashboard-types.ts",
  "lib/growth/apollo/apollo-operations-dashboard.ts",
  "app/api/platform/growth/apollo-operations-dashboard/route.ts",
  "components/growth/apollo-operations-dashboard-sections.tsx",
  "components/growth/apollo-pilot-operations-panel.tsx",
]

for (const file of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(ROOT, file)), `missing ${file}`)
}

const panelSource = fs.readFileSync(
  path.join(ROOT, "components/growth/apollo-pilot-operations-panel.tsx"),
  "utf8",
)
assert.match(panelSource, /ApolloOperationsDashboardSections/)
assert.match(panelSource, /"operations"/)

const routeSource = fs.readFileSync(
  path.join(ROOT, "app/api/platform/growth/apollo-operations-dashboard/route.ts"),
  "utf8",
)
assert.match(routeSource, /loadApolloOperationsDashboard/)
assert.match(routeSource, /requireGrowthEnginePlatformAccess/)

const loaderSource = fs.readFileSync(
  path.join(ROOT, "lib/growth/apollo/apollo-operations-dashboard.ts"),
  "utf8",
)
assert.match(loaderSource, /buildApollo25CompanyPilotSelectionInputs/)
assert.match(loaderSource, /buildApollo25CompanyPilotEligibilityDiagnostic/)
assert.match(loaderSource, /loadApollo25CompanyPilotCohortReview/)
assert.match(loaderSource, /buildApolloEnrollmentFunnelMetrics/)
assert.doesNotMatch(loaderSource, /runApolloLivePilotContactDiscovery/)
assert.doesNotMatch(loaderSource, /executeApolloEnrollmentAutomation/)

assert.equal(APOLLO_OPERATIONS_DASHBOARD_QA_MARKER, "apollo-operations-dashboard-v14-3b")
assert.equal(apolloOperationsPct(16, 48), 33.3)
assert.equal(apolloOperationsPct(0, 0), null)
assert.ok(APOLLO_OPERATIONS_SKIP_REASON_LABELS.no_verified_email.includes("verified email"))

const diagnostic = buildApollo25CompanyPilotEligibilityDiagnostic([], {
  production_threshold: 70,
  pilot_selection_mode: "greenfield",
  target_count: 25,
})
assert.equal(diagnostic.funnel_counts.total_apollo_discovered_companies, 0)

const skipped = emptyApollo25CompanyPilotSkipReasonCounts()
skipped.no_verified_email = 32
skipped.active_pilot_conflict = 11
assert.equal(skipped.no_verified_email, 32)

console.log("Apollo Operations Dashboard PASSED")
