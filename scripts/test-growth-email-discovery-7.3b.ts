/**
 * Phase 7.3B — Email discovery runtime integration regression tests.
 * Run: pnpm test:growth-email-discovery-7.3b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_CRON_ROUTE_IDS } from "../lib/growth/runtime/cron-telemetry-types"
import { GROWTH_EMAIL_DISCOVERY_PROSPECT_FILTERS } from "../lib/growth/email-discovery/email-discovery-runtime-types"
import { GROWTH_EMAIL_DISCOVERY_RUNTIME_QA_MARKER } from "../lib/growth/email-discovery/email-discovery-runtime-types"
import {
  GROWTH_EMAIL_DISCOVERY_STALE_RUNNING_ERROR,
  GROWTH_EMAIL_DISCOVERY_STALE_RUNNING_MS,
  resolveEmailDiscoveryDisplayStatus,
} from "../lib/growth/email-discovery/email-discovery-discovery-status"
import {
  matchesEmailDiscoveryProspectFilter,
  type GrowthEmailDiscoveryLeadRollup,
} from "../lib/growth/email-discovery/email-discovery-runtime-types"

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270712120000_growth_engine_email_discovery_jobs_7_3b.sql"),
  "utf8",
)
assert.match(migration, /email_discovery_jobs/)
assert.match(migration, /pending.*running.*completed.*failed/s)
assert.match(migration, /email_discovery_jobs_active_pair_uidx/)
assert.match(migration, /public\.set_updated_at/)

assert.ok(GROWTH_CRON_ROUTE_IDS.includes("growth-email-discovery-worker"))

const vercel = fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")
assert.match(vercel, /growth-email-discovery-worker/)

const cronRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/cron/growth-email-discovery-worker/route.ts"),
  "utf8",
)
assert.match(cronRoute, /processEmailDiscoveryJobQueue/)

const queueLib = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/email-discovery/email-discovery-queue.ts"),
  "utf8",
)
assert.match(queueLib, /skip_if_verified/)
assert.match(queueLib, /findActiveEmailDiscoveryJob/)
assert.match(queueLib, /GROWTH_EMAIL_DISCOVERY_MAX_JOBS_PER_CRON = 2/)
assert.match(queueLib, /GROWTH_EMAIL_DISCOVERY_MAX_COMPANY_ENRICH_QUEUE = 8/)
assert.match(queueLib, /recoverStaleEmailDiscoveryRunningJobs/)
assert.match(queueLib, /stale_recovered/)

const staleJobs = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/email-discovery/email-discovery-stale-jobs.ts"),
  "utf8",
)
assert.match(staleJobs, /GROWTH_EMAIL_DISCOVERY_STALE_RUNNING_MS/)
assert.match(staleJobs, /GROWTH_EMAIL_DISCOVERY_STALE_RUNNING_ERROR/)
assert.match(staleJobs, /\.eq\("status", "running"\)/)

const operatorStatus = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/email-discovery/email-discovery-operator-status.ts"),
  "utf8",
)
assert.match(operatorStatus, /recoverStaleEmailDiscoveryRunningJobs/)
assert.match(operatorStatus, /resolveEmailDiscoveryDisplayStatus/)
assert.match(operatorStatus, /latestJob/)

const discoveryStatus = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/email-discovery/email-discovery-discovery-status.ts"),
  "utf8",
)
assert.match(discoveryStatus, /resolveEmailDiscoveryDisplayStatus/)

assert.equal(GROWTH_EMAIL_DISCOVERY_STALE_RUNNING_MS, 30 * 60 * 1000)
assert.equal(GROWTH_EMAIL_DISCOVERY_STALE_RUNNING_ERROR, "stale_running_job_recovered_v1")

assert.equal(
  resolveEmailDiscoveryDisplayStatus({
    active_job_status: null,
    latest_job_status: "failed",
    last_run_status: "completed",
  }),
  "failed",
)
assert.equal(
  resolveEmailDiscoveryDisplayStatus({
    active_job_status: "pending",
    latest_job_status: "failed",
    last_run_status: "completed",
  }),
  "pending",
)
assert.equal(
  resolveEmailDiscoveryDisplayStatus({
    active_job_status: null,
    latest_job_status: "completed",
    last_run_status: "failed",
  }),
  "completed",
)
assert.equal(
  resolveEmailDiscoveryDisplayStatus({
    active_job_status: null,
    latest_job_status: null,
    last_run_status: "partial",
  }),
  "completed",
)

const triggers = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/email-discovery/email-discovery-triggers.ts"),
  "utf8",
)
assert.match(triggers, /triggerEmailDiscoveryAfterPersonPersist/)
assert.match(triggers, /triggerEmailDiscoveryAfterCompanyEnriched/)

const persist = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/canonical-persons/canonical-person-repository-core.ts"),
  "utf8",
)
assert.match(persist, /triggerEmailDiscoveryAfterPersonPersist/)

const companyRefresh = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/contact-discovery/company-contact-repository.ts"),
  "utf8",
)
assert.match(companyRefresh, /triggerEmailDiscoveryAfterCompanyEnriched/)

const jobsRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/email-discovery/jobs/route.ts"),
  "utf8",
)
assert.match(jobsRoute, /enqueueEmailDiscoveryJob/)

const operatorCard = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-email-discovery-operator-card.tsx"),
  "utf8",
)
assert.match(operatorCard, /Discover Email/)
assert.match(operatorCard, /View Evidence/)

const browserRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/browser-intake/email-discovery/route.ts"),
  "utf8",
)
assert.match(browserRoute, /browser_extension/)

const rollupBase: GrowthEmailDiscoveryLeadRollup = {
  lead_id: "lead",
  company_id: "co",
  canonical_pair_count: 1,
  has_verified_email: false,
  missing_verified_email: true,
  discovery_pending: false,
  discovery_failed: false,
}

assert.equal(
  matchesEmailDiscoveryProspectFilter("missing_verified_email", rollupBase),
  true,
)
assert.equal(
  matchesEmailDiscoveryProspectFilter("has_verified_email", {
    ...rollupBase,
    has_verified_email: true,
    missing_verified_email: false,
  }),
  true,
)
assert.equal(
  matchesEmailDiscoveryProspectFilter("discovery_pending", {
    ...rollupBase,
    discovery_pending: true,
  }),
  true,
)
assert.equal(
  matchesEmailDiscoveryProspectFilter("discovery_failed", {
    ...rollupBase,
    discovery_failed: true,
  }),
  true,
)
assert.equal(
  matchesEmailDiscoveryProspectFilter("has_verified_email", {
    ...rollupBase,
    canonical_pair_count: 0,
  }),
  false,
)

assert.equal(GROWTH_EMAIL_DISCOVERY_PROSPECT_FILTERS.length, 4)
assert.equal(GROWTH_EMAIL_DISCOVERY_RUNTIME_QA_MARKER, "growth-email-discovery-runtime-7.3b-v1")

const callQueueRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/call-queue/route.ts"),
  "utf8",
)
assert.match(callQueueRoute, /email_discovery_filter/)

console.log("growth-email-discovery-7.3b: ok")
