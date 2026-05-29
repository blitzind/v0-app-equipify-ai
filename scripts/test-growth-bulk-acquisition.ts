/**
 * Regression checks for bulk contact acquisition engine.
 * Run: pnpm test:growth-bulk-acquisition
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { planLiveProviderQueryBatches } from "../lib/growth/real-world-discovery/live-provider-query-expansion"
import {
  allQueriesExhaustedForTile,
  companyDiscoveryQueriesRemain,
  currentAcquisitionQuery,
  repairAcquisitionRunPhase,
  resolveNextPhase,
} from "../lib/growth/acquisition/acquisition-query-phase"
import { emptyAcquisitionRunState } from "../lib/growth/acquisition/acquisition-types"

const root = process.cwd()

const hvacTennesseeBatches = planLiveProviderQueryBatches({
  industry: "commercial hvac",
  location: "Tennessee",
})

function hvacDiscoveryStateAfterFivePrimaryTicks() {
  return emptyAcquisitionRunState({
    search_inputs: { industry: "commercial hvac", location: "Tennessee" },
    query_plan: hvacTennesseeBatches,
    limit_per_query: 50,
    geo_tiles: ["Tennessee"],
    target_company_count: 100,
  })
}

// Regression: 6th discovery tick must run fallback queries, not flip to discover_contacts early.
{
  const state = hvacDiscoveryStateAfterFivePrimaryTicks()
  state.stats.companies_discovered = 50
  state.query_index = 5
  state.executed_query_keys = hvacTennesseeBatches.primary.map((q, i) => `tennessee|${q}|${i}`).slice(0, 5)

  assert.equal(currentAcquisitionQuery(state), null)
  assert.equal(allQueriesExhaustedForTile(state), false)
  assert.equal(companyDiscoveryQueriesRemain(state), true)
  assert.equal(resolveNextPhase(state), "discover_companies")

  state.use_fallback_queries = true
  const sixthQuery = currentAcquisitionQuery(state)
  assert.ok(sixthQuery)
  assert.match(sixthQuery, /Tennessee/i)
  assert.equal(resolveNextPhase({ ...state, query_index: 5, use_fallback_queries: true }), "discover_companies")
}

// Regression: rewind premature discover_contacts so partial runs resume company discovery.
{
  const stuck = hvacDiscoveryStateAfterFivePrimaryTicks()
  stuck.phase = "discover_contacts"
  stuck.query_index = 5
  stuck.stats.companies_discovered = 50
  const repaired = repairAcquisitionRunPhase(stuck)
  assert.equal(repaired.phase, "discover_companies")
}

// Regression: fallback query builder must not throw TDZ (minified "Cannot access 'f' before initialization").
{
  for (let i = 0; i < 50; i++) {
    const batches = planLiveProviderQueryBatches({ industry: "commercial hvac", location: "Tennessee" })
    assert.equal(batches.primary.length, 5)
    assert.ok(batches.fallback.length > 0)
    assert.ok(batches.fallback[0]?.length > 0)
  }
}

const typesSource = fs.readFileSync(path.join(root, "lib/growth/acquisition/acquisition-types.ts"), "utf8")
assert.match(typesSource, /growth-bulk-acquisition-v1/)
assert.match(typesSource, /discover_companies/)
assert.match(typesSource, /promote_leads/)
assert.match(typesSource, /contact_discovery_cursor/)
assert.match(typesSource, /GrowthBulkAcquisitionThroughputMetrics/)

const geoSource = fs.readFileSync(
  path.join(root, "lib/growth/acquisition/acquisition-geographic-expansion.ts"),
  "utf8",
)
assert.match(geoSource, /buildAcquisitionGeoTiles/)
assert.match(geoSource, /Tennessee/)

const repoSource = fs.readFileSync(path.join(root, "lib/growth/acquisition/acquisition-repository.ts"), "utf8")
assert.doesNotMatch(repoSource, /\.limit\(500\)/)
assert.doesNotMatch(repoSource, /\.limit\(5000\)/)
assert.match(repoSource, /applyKeysetCursor/)
assert.match(repoSource, /listRunnableBulkAcquisitionRuns/)

const runnerSource = fs.readFileSync(path.join(root, "lib/growth/acquisition/bulk-acquisition-runner.ts"), "utf8")
assert.match(runnerSource, /acquisition-query-phase/)
assert.match(runnerSource, /repairAcquisitionRunPhase/)
assert.match(runnerSource, /currentAcquisitionQuery/)
assert.doesNotMatch(runnerSource, /function resolveNextPhase\(/)
assert.match(runnerSource, /runRealWorldCompanyDiscovery/)
assert.match(runnerSource, /runContactDiscoveryForCompany/)
assert.match(runnerSource, /syncContactCandidatesToCompanyContacts/)
assert.match(runnerSource, /verifyCompanyContactForAcquisition/)
assert.match(runnerSource, /isEmailReadyForLeadPromotion/)
assert.match(runnerSource, /promoteVerifiedContactsBatch/)
assert.match(runnerSource, /buildAcquisitionGeoTiles/)
assert.match(runnerSource, /loadAcquisitionDedupeHashes/)
assert.match(runnerSource, /tick_duration_ms/)
assert.doesNotMatch(runnerSource, /LeadInbox|lead_inbox|executeBulkPushToLeadInbox/)

const cronWorkerSource = fs.readFileSync(
  path.join(root, "lib/growth/acquisition/acquisition-cron-worker.ts"),
  "utf8",
)
assert.match(cronWorkerSource, /processBulkAcquisitionRuns/)
assert.match(cronWorkerSource, /tickBulkAcquisitionRun/)

const cronRouteSource = fs.readFileSync(
  path.join(root, "app/api/cron/growth-acquisition-worker/route.ts"),
  "utf8",
)
assert.match(cronRouteSource, /growth-acquisition-worker/)
assert.match(cronRouteSource, /runGrowthCronJob/)

const expansionSource = fs.readFileSync(
  path.join(root, "lib/growth/real-world-discovery/live-provider-query-expansion.ts"),
  "utf8",
)
assert.match(expansionSource, /dedupedFallbackQueries/)
assert.doesNotMatch(expansionSource, /const fallback = withLocation/)

const diagnosticsSource = fs.readFileSync(
  path.join(root, "lib/growth/acquisition/acquisition-diagnostics.ts"),
  "utf8",
)
assert.match(diagnosticsSource, /GROWTH_BULK_ACQUISITION_DIAGNOSTICS_QA_MARKER/)
assert.match(diagnosticsSource, /last_error_stack/)
assert.match(diagnosticsSource, /logAcquisitionTickFailure/)
assert.match(diagnosticsSource, /acquisition_tick_failed/)

assert.match(typesSource, /last_error_stack/)
assert.match(typesSource, /last_error_diagnostics/)
assert.match(typesSource, /error_stack/)

assert.match(runnerSource, /acquisition-diagnostics/)
assert.match(runnerSource, /applyAcquisitionTickFailureToState/)
assert.match(runnerSource, /buildFailedAcquisitionTickLogEntry/)
assert.match(runnerSource, /withAcquisitionDiagnosticContext/)

assert.match(repoSource, /last_error_stack/)
assert.match(repoSource, /parseLastErrorDiagnostics/)

const promoteSource = fs.readFileSync(
  path.join(root, "lib/growth/acquisition/promote-verified-contact-to-lead.ts"),
  "utf8",
)
assert.match(promoteSource, /createGrowthLead/)
assert.match(promoteSource, /createGrowthLeadDecisionMaker/)
assert.match(promoteSource, /recomputeGrowthLeadWorkflowSignals/)
assert.match(promoteSource, /findImportDedupeMatch/)
assert.match(promoteSource, /assertEmailSendAllowed/)
assert.match(promoteSource, /bulk_acquisition/)

const routeSource = fs.readFileSync(
  path.join(root, "app/api/platform/growth/acquisition/runs/route.ts"),
  "utf8",
)
assert.match(routeSource, /startBulkAcquisitionRun/)
assert.match(routeSource, /tickBulkAcquisitionRun/)
assert.match(routeSource, /requireGrowthEnginePlatformAccess/)

const vercelSource = fs.readFileSync(path.join(root, "vercel.json"), "utf8")
assert.match(vercelSource, /growth-acquisition-worker/)

const adminPageSource = fs.readFileSync(
  path.join(root, "app/(admin)/admin/growth/acquisition/page.tsx"),
  "utf8",
)
assert.match(adminPageSource, /GrowthAcquisitionRunsDashboard/)
assert.match(adminPageSource, /Acquisition Runs/)

const detailPageSource = fs.readFileSync(
  path.join(root, "app/(admin)/admin/growth/acquisition/[runId]/page.tsx"),
  "utf8",
)
assert.match(detailPageSource, /GrowthAcquisitionRunDetail/)

console.log("growth-bulk-acquisition regression checks passed")
