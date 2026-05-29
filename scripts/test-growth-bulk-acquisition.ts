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

const runnerSource = fs.readFileSync(path.join(root, "lib/growth/acquisition/bulk-acquisition-runner.ts"), "utf8")
assert.match(runnerSource, /runRealWorldCompanyDiscovery/)
assert.match(runnerSource, /runContactDiscoveryForCompany/)
assert.match(runnerSource, /syncContactCandidatesToCompanyContacts/)
assert.match(runnerSource, /verifyCompanyContactForAcquisition/)
assert.match(runnerSource, /isEmailReadyForLeadPromotion/)
assert.match(runnerSource, /promoteVerifiedContactsBatch/)
assert.doesNotMatch(runnerSource, /LeadInbox|lead_inbox|executeBulkPushToLeadInbox/)

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

console.log("growth-bulk-acquisition regression checks passed")
