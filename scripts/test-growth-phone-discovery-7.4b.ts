/**
 * Phase 7.4B — Phone discovery runtime integration regression tests.
 * Run: pnpm test:growth-phone-discovery-7.4b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_CRON_ROUTE_IDS } from "../lib/growth/runtime/cron-telemetry-types"
import { GROWTH_PHONE_DISCOVERY_PROSPECT_FILTERS } from "../lib/growth/phone-discovery/phone-discovery-runtime-types"
import { GROWTH_PHONE_DISCOVERY_RUNTIME_QA_MARKER } from "../lib/growth/phone-discovery/phone-discovery-runtime-types"
import {
  GROWTH_PHONE_DISCOVERY_STALE_RUNNING_ERROR,
  GROWTH_PHONE_DISCOVERY_STALE_RUNNING_MS,
  resolvePhoneDiscoveryDisplayStatus,
} from "../lib/growth/phone-discovery/phone-discovery-discovery-status"
import {
  matchesPhoneDiscoveryProspectFilter,
  type GrowthPhoneDiscoveryLeadRollup,
} from "../lib/growth/phone-discovery/phone-discovery-runtime-types"

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270714120000_growth_engine_phone_discovery_jobs_7_4b.sql"),
  "utf8",
)
assert.match(migration, /phone_discovery_jobs/)
assert.match(migration, /pending.*running.*completed.*failed/s)
assert.match(migration, /phone_discovery_jobs_active_pair_uidx/)
assert.match(migration, /public\.set_updated_at/)

assert.ok(GROWTH_CRON_ROUTE_IDS.includes("growth-phone-discovery-worker"))

const vercel = fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")
assert.match(vercel, /growth-phone-discovery-worker/)

const cronRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/cron/growth-phone-discovery-worker/route.ts"),
  "utf8",
)
assert.match(cronRoute, /processPhoneDiscoveryJobQueue/)

const queueLib = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/phone-discovery/phone-discovery-queue.ts"),
  "utf8",
)
assert.match(queueLib, /skip_if_verified/)
assert.match(queueLib, /findActivePhoneDiscoveryJob/)
assert.match(queueLib, /GROWTH_PHONE_DISCOVERY_MAX_JOBS_PER_CRON = 2/)
assert.match(queueLib, /GROWTH_PHONE_DISCOVERY_MAX_COMPANY_ENRICH_QUEUE = 8/)
assert.match(queueLib, /recoverStalePhoneDiscoveryRunningJobs/)
assert.match(queueLib, /stale_recovered/)
assert.match(queueLib, /phone_discovery_job_enqueued/)
assert.match(queueLib, /phone_discovery_job_completed/)

const staleJobs = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/phone-discovery/phone-discovery-stale-jobs.ts"),
  "utf8",
)
assert.match(staleJobs, /GROWTH_PHONE_DISCOVERY_STALE_RUNNING_MS/)
assert.match(staleJobs, /GROWTH_PHONE_DISCOVERY_STALE_RUNNING_ERROR/)
assert.match(staleJobs, /\.eq\("status", "running"\)/)

const operatorStatus = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/phone-discovery/phone-discovery-operator-status.ts"),
  "utf8",
)
assert.match(operatorStatus, /recoverStalePhoneDiscoveryRunningJobs/)
assert.match(operatorStatus, /resolvePhoneDiscoveryDisplayStatus/)
assert.match(operatorStatus, /latestJob/)
assert.match(operatorStatus, /can_discover: !active_job_blocked && !has_verified_phone/)

const discoveryStatus = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/phone-discovery/phone-discovery-discovery-status.ts"),
  "utf8",
)
assert.match(discoveryStatus, /resolvePhoneDiscoveryDisplayStatus/)

assert.equal(GROWTH_PHONE_DISCOVERY_STALE_RUNNING_MS, 30 * 60 * 1000)
assert.equal(GROWTH_PHONE_DISCOVERY_STALE_RUNNING_ERROR, "stale_running_job_recovered_v1")

assert.equal(
  resolvePhoneDiscoveryDisplayStatus({
    active_job_status: null,
    latest_job_status: "failed",
    last_run_status: "completed",
  }),
  "failed",
)
assert.equal(
  resolvePhoneDiscoveryDisplayStatus({
    active_job_status: "pending",
    latest_job_status: "failed",
    last_run_status: "completed",
  }),
  "pending",
)

const triggers = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/phone-discovery/phone-discovery-triggers.ts"),
  "utf8",
)
assert.match(triggers, /triggerPhoneDiscoveryAfterPersonPersist/)
assert.match(triggers, /triggerPhoneDiscoveryAfterCompanyEnriched/)

const persist = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/canonical-persons/canonical-person-repository-core.ts"),
  "utf8",
)
assert.match(persist, /triggerPhoneDiscoveryAfterPersonPersist/)

const companyRefresh = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/contact-discovery/company-contact-repository.ts"),
  "utf8",
)
assert.match(companyRefresh, /triggerPhoneDiscoveryAfterCompanyEnriched/)

const jobsRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/phone-discovery/jobs/route.ts"),
  "utf8",
)
assert.match(jobsRoute, /enqueuePhoneDiscoveryJob/)

const operatorCard = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-phone-discovery-operator-card.tsx"),
  "utf8",
)
assert.match(operatorCard, /Discover Phone/)
assert.match(operatorCard, /View Evidence/)
assert.match(operatorCard, /phone-discovery\/jobs/)
assert.match(operatorCard, /evidence_text/)
assert.match(operatorCard, /source_url/)
assert.doesNotMatch(operatorCard, /fetch\("\/api\/platform\/growth\/phone-discovery\/run"/)

const panel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-phone-discovery-panel.tsx"),
  "utf8",
)
assert.match(panel, /phone-discovery\/jobs/)
assert.match(panel, /GROWTH_PHONE_DISCOVERY_RUNTIME_QA_MARKER/)

const browserRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/browser-intake/phone-discovery/route.ts"),
  "utf8",
)
assert.match(browserRoute, /browser_extension/)

const sources = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/phone-discovery/phone-discovery-sources.ts"),
  "utf8",
)
assert.match(sources, /stagingNameMatchesPerson/)

const rollupBase: GrowthPhoneDiscoveryLeadRollup = {
  lead_id: "lead",
  company_id: "co",
  canonical_pair_count: 1,
  has_verified_phone: false,
  missing_verified_phone: true,
  discovery_pending: false,
  discovery_failed: false,
}

assert.equal(matchesPhoneDiscoveryProspectFilter("missing_verified_phone", rollupBase), true)
assert.equal(
  matchesPhoneDiscoveryProspectFilter("has_verified_phone", {
    ...rollupBase,
    has_verified_phone: true,
    missing_verified_phone: false,
  }),
  true,
)
assert.equal(
  matchesPhoneDiscoveryProspectFilter("discovery_pending", {
    ...rollupBase,
    discovery_pending: true,
  }),
  true,
)
assert.equal(
  matchesPhoneDiscoveryProspectFilter("discovery_failed", {
    ...rollupBase,
    discovery_failed: true,
  }),
  true,
)
assert.equal(
  matchesPhoneDiscoveryProspectFilter("has_verified_phone", {
    ...rollupBase,
    canonical_pair_count: 0,
  }),
  false,
)

assert.equal(GROWTH_PHONE_DISCOVERY_PROSPECT_FILTERS.length, 4)
assert.equal(GROWTH_PHONE_DISCOVERY_RUNTIME_QA_MARKER, "growth-phone-discovery-runtime-7.4b-v1")

const callQueueRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/call-queue/route.ts"),
  "utf8",
)
assert.match(callQueueRoute, /phone_discovery_filter/)

const decisionMakers = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-decision-makers-panel.tsx"),
  "utf8",
)
assert.match(decisionMakers, /GrowthPhoneDiscoveryOperatorCard/)

const extension = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/extension-workspace.js"),
  "utf8",
)
assert.match(extension, /phone-discovery/)
assert.match(extension, /phone_discovery_contacts/)

console.log("growth-phone-discovery-7.4b: ok")
