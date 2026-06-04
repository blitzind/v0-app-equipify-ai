/**
 * Phase 7.6B — Company intelligence runtime integration regression tests.
 * Run: pnpm test:growth-company-intelligence-7.6b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_CRON_ROUTE_IDS } from "../lib/growth/runtime/cron-telemetry-types"
import {
  GROWTH_COMPANY_INTELLIGENCE_PROSPECT_FILTERS,
  GROWTH_COMPANY_INTELLIGENCE_RUNTIME_QA_MARKER,
  matchesCompanyIntelligenceProspectFilter,
  type GrowthCompanyIntelligenceLeadRollup,
} from "../lib/growth/company-intelligence/company-intelligence-runtime-types"
import {
  GROWTH_COMPANY_INTELLIGENCE_STALE_RUNNING_ERROR,
  GROWTH_COMPANY_INTELLIGENCE_STALE_RUNNING_MS,
  resolveCompanyIntelligenceDisplayStatus,
} from "../lib/growth/company-intelligence/company-intelligence-discovery-status"

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270718120000_growth_engine_company_intelligence_jobs_7_6b.sql"),
  "utf8",
)
assert.match(migration, /company_intelligence_jobs/)
assert.match(migration, /company_intelligence_jobs_active_company_uidx/)
assert.doesNotMatch(migration, /person_id/)

assert.ok(GROWTH_CRON_ROUTE_IDS.includes("growth-company-intelligence-worker"))

const vercel = fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")
assert.match(vercel, /growth-company-intelligence-worker/)

const cronRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/cron/growth-company-intelligence-worker/route.ts"),
  "utf8",
)
assert.match(cronRoute, /processCompanyIntelligenceJobQueue/)

const queueLib = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/company-intelligence/company-intelligence-queue.ts"),
  "utf8",
)
assert.match(queueLib, /skip_if_verified/)
assert.match(queueLib, /findActiveCompanyIntelligenceJob/)
assert.match(queueLib, /GROWTH_COMPANY_INTELLIGENCE_MAX_JOBS_PER_CRON = 2/)
assert.match(queueLib, /recoverStaleCompanyIntelligenceRunningJobs/)
assert.match(queueLib, /company_intelligence_job_enqueued/)
assert.match(queueLib, /runCompanyIntelligenceForCanonicalCompany/)
assert.doesNotMatch(queueLib, /openai|guess|pdl/i)

const operatorStatus = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/company-intelligence/company-intelligence-operator-status.ts"),
  "utf8",
)
assert.match(operatorStatus, /recoverStaleCompanyIntelligenceRunningJobs/)
assert.match(operatorStatus, /resolveCompanyIntelligenceDisplayStatus/)
assert.match(operatorStatus, /can_discover: !active_job_blocked && !has_verified_intelligence/)

assert.equal(GROWTH_COMPANY_INTELLIGENCE_STALE_RUNNING_MS, 30 * 60 * 1000)
assert.equal(GROWTH_COMPANY_INTELLIGENCE_STALE_RUNNING_ERROR, "stale_running_job_recovered_v1")

assert.equal(
  resolveCompanyIntelligenceDisplayStatus({
    active_job_status: "pending",
    latest_job_status: "failed",
    last_run_status: "completed",
  }),
  "pending",
)

const triggers = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/company-intelligence/company-intelligence-triggers.ts"),
  "utf8",
)
assert.match(triggers, /triggerCompanyIntelligenceAfterCompanyEnriched/)

const companyRefresh = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/contact-discovery/company-contact-repository.ts"),
  "utf8",
)
assert.match(companyRefresh, /triggerCompanyIntelligenceAfterCompanyEnriched/)

const jobsRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/company-intelligence/jobs/route.ts"),
  "utf8",
)
assert.match(jobsRoute, /enqueueCompanyIntelligenceJob/)

const operatorCard = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-company-intelligence-operator-card.tsx"),
  "utf8",
)
assert.match(operatorCard, /Collect intelligence/)
assert.match(operatorCard, /company-intelligence\/jobs/)
assert.match(operatorCard, /evidence_text/)
assert.doesNotMatch(operatorCard, /company-intelligence\/run"/)

const callQueueRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/call-queue/route.ts"),
  "utf8",
)
assert.match(callQueueRoute, /company_intelligence_filter/)

const rollup: GrowthCompanyIntelligenceLeadRollup = {
  lead_id: "lead-1",
  company_id: "co-1",
  has_canonical_company: true,
  has_verified_intelligence: false,
  missing_verified_intelligence: true,
  discovery_pending: true,
  discovery_failed: false,
}
assert.equal(matchesCompanyIntelligenceProspectFilter("discovery_pending", rollup), true)
assert.equal(matchesCompanyIntelligenceProspectFilter("has_verified_intelligence", rollup), false)
assert.equal(GROWTH_COMPANY_INTELLIGENCE_PROSPECT_FILTERS.length, 4)

assert.equal(GROWTH_COMPANY_INTELLIGENCE_RUNTIME_QA_MARKER, "growth-company-intelligence-runtime-7.6b-v1")

console.log("growth-company-intelligence-7.6b: PASS")
