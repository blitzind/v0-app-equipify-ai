/**
 * Regression checks for bulk contact acquisition engine.
 * Run: pnpm test:growth-bulk-acquisition
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

const root = process.cwd()

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

console.log("growth-bulk-acquisition regression checks passed")
