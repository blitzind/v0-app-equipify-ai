/**
 * Phase 7.7B — Buying committee intelligence runtime integration regression tests.
 * Run: pnpm test:growth-buying-committee-intelligence-7.7b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_CRON_ROUTE_IDS } from "../lib/growth/runtime/cron-telemetry-types"
import {
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_PROSPECT_FILTERS,
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_RUNTIME_QA_MARKER,
  matchesBuyingCommitteeIntelligenceProspectFilter,
  type GrowthBuyingCommitteeIntelligenceLeadRollup,
} from "../lib/growth/buying-committee-intelligence/buying-committee-intelligence-runtime-types"
import {
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_STALE_RUNNING_ERROR,
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_STALE_RUNNING_MS,
  resolveBuyingCommitteeIntelligenceDisplayStatus,
} from "../lib/growth/buying-committee-intelligence/buying-committee-intelligence-discovery-status"

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20270720120000_growth_engine_buying_committee_jobs_7_7b.sql",
  ),
  "utf8",
)
assert.match(migration, /buying_committee_jobs/)
assert.match(migration, /buying_committee_jobs_active_company_uidx/)
assert.doesNotMatch(migration, /person_id/)

assert.ok(GROWTH_CRON_ROUTE_IDS.includes("growth-buying-committee-intelligence-worker"))

const vercel = fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")
assert.match(vercel, /growth-buying-committee-intelligence-worker/)

const cronRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/cron/growth-buying-committee-intelligence-worker/route.ts"),
  "utf8",
)
assert.match(cronRoute, /processBuyingCommitteeIntelligenceJobQueue/)

const queueLib = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/buying-committee-intelligence/buying-committee-intelligence-queue.ts"),
  "utf8",
)
assert.match(queueLib, /skip_if_verified/)
assert.match(queueLib, /findActiveBuyingCommitteeIntelligenceJob/)
assert.match(queueLib, /GROWTH_BUYING_COMMITTEE_INTELLIGENCE_MAX_JOBS_PER_CRON = 2/)
assert.match(queueLib, /recoverStaleBuyingCommitteeIntelligenceRunningJobs/)
assert.match(queueLib, /buying_committee_intelligence_job_enqueued/)
assert.match(queueLib, /runBuyingCommitteeIntelligenceForCanonicalCompany/)
assert.doesNotMatch(queueLib, /openai|guess|pdl|apollo|zoominfo/i)

const operatorStatus = fs.readFileSync(
  path.join(
    process.cwd(),
    "lib/growth/buying-committee-intelligence/buying-committee-intelligence-operator-status.ts",
  ),
  "utf8",
)
assert.match(operatorStatus, /recoverStaleBuyingCommitteeIntelligenceRunningJobs/)
assert.match(operatorStatus, /resolveBuyingCommitteeIntelligenceDisplayStatus/)
assert.match(operatorStatus, /can_discover: !active_job_blocked && !has_verified_committee/)

const triggers = fs.readFileSync(
  path.join(
    process.cwd(),
    "lib/growth/buying-committee-intelligence/buying-committee-intelligence-triggers.ts",
  ),
  "utf8",
)
assert.match(triggers, /triggerBuyingCommitteeIntelligenceAfterCompanyIntelligence/)

const companyQueue = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/company-intelligence/company-intelligence-queue.ts"),
  "utf8",
)
assert.match(companyQueue, /triggerBuyingCommitteeIntelligenceAfterCompanyIntelligence/)

const jobsRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/buying-committee-intelligence/jobs/route.ts"),
  "utf8",
)
assert.match(jobsRoute, /enqueueBuyingCommitteeIntelligenceJob/)

const operatorCard = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-buying-committee-intelligence-panel.tsx"),
  "utf8",
)
assert.match(operatorCard, /buying-committee-intelligence\/jobs/)
assert.match(operatorCard, /Queue buying committee intelligence/)
assert.match(operatorCard, /Sync debug run/)
assert.match(operatorCard, /GROWTH_BUYING_COMMITTEE_INTELLIGENCE_RUNTIME_QA_MARKER/)

const callQueueRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/call-queue/route.ts"),
  "utf8",
)
assert.match(callQueueRoute, /buying_committee_intelligence_filter/)

assert.equal(GROWTH_BUYING_COMMITTEE_INTELLIGENCE_STALE_RUNNING_MS, 30 * 60 * 1000)
assert.equal(GROWTH_BUYING_COMMITTEE_INTELLIGENCE_STALE_RUNNING_ERROR, "stale_running_job_recovered_v1")

assert.equal(
  resolveBuyingCommitteeIntelligenceDisplayStatus({
    active_job_status: "pending",
    latest_job_status: "failed",
    last_run_status: "completed",
  }),
  "pending",
)

const rollup: GrowthBuyingCommitteeIntelligenceLeadRollup = {
  lead_id: "lead-1",
  company_id: "co-1",
  has_canonical_company: true,
  has_verified_committee: false,
  missing_verified_committee: true,
  discovery_pending: true,
  discovery_failed: false,
}
assert.equal(matchesBuyingCommitteeIntelligenceProspectFilter("discovery_pending", rollup), true)
assert.equal(matchesBuyingCommitteeIntelligenceProspectFilter("has_verified_committee", rollup), false)
assert.equal(GROWTH_BUYING_COMMITTEE_INTELLIGENCE_PROSPECT_FILTERS.length, 4)

assert.equal(
  GROWTH_BUYING_COMMITTEE_INTELLIGENCE_RUNTIME_QA_MARKER,
  "growth-buying-committee-intelligence-runtime-7.7b-v1",
)

console.log("growth-buying-committee-intelligence-7.7b: PASS")
