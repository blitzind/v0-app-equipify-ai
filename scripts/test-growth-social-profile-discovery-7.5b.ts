/**
 * Phase 7.5B — Social profile discovery runtime integration regression tests.
 * Run: pnpm test:growth-social-profile-discovery-7.5b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_CRON_ROUTE_IDS } from "../lib/growth/runtime/cron-telemetry-types"
import { GROWTH_SOCIAL_PROFILE_DISCOVERY_PROSPECT_FILTERS } from "../lib/growth/social-profile-discovery/social-profile-discovery-runtime-types"
import { GROWTH_SOCIAL_PROFILE_DISCOVERY_RUNTIME_QA_MARKER } from "../lib/growth/social-profile-discovery/social-profile-discovery-runtime-types"
import {
  GROWTH_SOCIAL_PROFILE_DISCOVERY_STALE_RUNNING_ERROR,
  GROWTH_SOCIAL_PROFILE_DISCOVERY_STALE_RUNNING_MS,
  resolveSocialProfileDiscoveryDisplayStatus,
} from "../lib/growth/social-profile-discovery/social-profile-discovery-discovery-status"
import {
  matchesSocialProfileDiscoveryProspectFilter,
  type GrowthSocialProfileDiscoveryLeadRollup,
} from "../lib/growth/social-profile-discovery/social-profile-discovery-runtime-types"

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20270716120000_growth_engine_social_profile_discovery_jobs_7_5b.sql"),
  "utf8",
)
assert.match(migration, /social_profile_discovery_jobs/)
assert.match(migration, /discovery_scope/)
assert.match(migration, /social_profile_discovery_jobs_active_person_pair_uidx/)
assert.match(migration, /social_profile_discovery_jobs_active_company_uidx/)

assert.ok(GROWTH_CRON_ROUTE_IDS.includes("growth-social-profile-discovery-worker"))

const vercel = fs.readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")
assert.match(vercel, /growth-social-profile-discovery-worker/)

const cronRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/cron/growth-social-profile-discovery-worker/route.ts"),
  "utf8",
)
assert.match(cronRoute, /processSocialProfileDiscoveryJobQueue/)

const queueLib = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/social-profile-discovery/social-profile-discovery-queue.ts"),
  "utf8",
)
assert.match(queueLib, /skip_if_verified/)
assert.match(queueLib, /findActiveSocialProfileDiscoveryJob/)
assert.match(queueLib, /GROWTH_SOCIAL_PROFILE_DISCOVERY_MAX_JOBS_PER_CRON = 2/)
assert.match(queueLib, /recoverStaleSocialProfileDiscoveryRunningJobs/)
assert.match(queueLib, /social_profile_discovery_job_enqueued/)
assert.match(queueLib, /runSocialProfileDiscoveryForCanonicalCompany/)
assert.doesNotMatch(queueLib, /openai|guess|puppeteer/i)

const verification = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/social-profile-discovery/social-profile-discovery-verification.ts"),
  "utf8",
)
assert.match(verification, /stagingTrusted && confidence >= 0\.85/)
assert.doesNotMatch(verification, /hasStagingEvidence/)

const sources = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/social-profile-discovery/social-profile-discovery-sources.ts"),
  "utf8",
)
assert.doesNotMatch(sources, /linkedin_company_url, metadata/)
assert.match(sources, /meta\.linkedin_company_url/)

const operatorStatus = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/social-profile-discovery/social-profile-discovery-operator-status.ts"),
  "utf8",
)
assert.match(operatorStatus, /recoverStaleSocialProfileDiscoveryRunningJobs/)
assert.match(operatorStatus, /resolveSocialProfileDiscoveryDisplayStatus/)
assert.match(operatorStatus, /can_discover: !active_job_blocked && !has_verified_profile/)

assert.equal(GROWTH_SOCIAL_PROFILE_DISCOVERY_STALE_RUNNING_MS, 30 * 60 * 1000)
assert.equal(GROWTH_SOCIAL_PROFILE_DISCOVERY_STALE_RUNNING_ERROR, "stale_running_job_recovered_v1")

assert.equal(
  resolveSocialProfileDiscoveryDisplayStatus({
    active_job_status: "pending",
    latest_job_status: "failed",
    last_run_status: "completed",
  }),
  "pending",
)

const triggers = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/social-profile-discovery/social-profile-discovery-triggers.ts"),
  "utf8",
)
assert.match(triggers, /triggerSocialProfileDiscoveryAfterPersonPersist/)
assert.match(triggers, /triggerSocialProfileDiscoveryAfterCompanyEnriched/)

const persist = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/canonical-persons/canonical-person-repository-core.ts"),
  "utf8",
)
assert.match(persist, /triggerSocialProfileDiscoveryAfterPersonPersist/)

const companyRefresh = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/contact-discovery/company-contact-repository.ts"),
  "utf8",
)
assert.match(companyRefresh, /triggerSocialProfileDiscoveryAfterCompanyEnriched/)

const jobsRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/social-profile-discovery/jobs/route.ts"),
  "utf8",
)
assert.match(jobsRoute, /enqueueSocialProfileDiscoveryJob/)

const operatorCard = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-social-profile-discovery-operator-card.tsx"),
  "utf8",
)
assert.match(operatorCard, /Discover Social/)
assert.match(operatorCard, /social-profile-discovery\/jobs/)
assert.match(operatorCard, /evidence_text/)
assert.doesNotMatch(operatorCard, /social-profile-discovery\/run"/)

const panel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-social-profile-discovery-panel.tsx"),
  "utf8",
)
assert.match(panel, /social-profile-discovery\/jobs/)
assert.match(panel, /GROWTH_SOCIAL_PROFILE_DISCOVERY_RUNTIME_QA_MARKER/)

const browserRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/browser-intake/social-profile-discovery/route.ts"),
  "utf8",
)
assert.match(browserRoute, /browser_extension/)

const rollupBase: GrowthSocialProfileDiscoveryLeadRollup = {
  lead_id: "lead",
  company_id: "co",
  canonical_pair_count: 1,
  has_verified_profile: false,
  missing_verified_profile: true,
  discovery_pending: false,
  discovery_failed: false,
}
assert.equal(matchesSocialProfileDiscoveryProspectFilter("missing_verified_profile", rollupBase), true)
assert.equal(GROWTH_SOCIAL_PROFILE_DISCOVERY_PROSPECT_FILTERS.length, 4)
assert.equal(GROWTH_SOCIAL_PROFILE_DISCOVERY_RUNTIME_QA_MARKER, "growth-social-profile-discovery-runtime-7.5b-v1")

const callQueueRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/call-queue/route.ts"),
  "utf8",
)
assert.match(callQueueRoute, /social_profile_discovery_filter/)

const decisionMakers = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-decision-makers-panel.tsx"),
  "utf8",
)
assert.match(decisionMakers, /GrowthSocialProfileDiscoveryOperatorCard/)

const extension = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/extension-workspace.js"),
  "utf8",
)
assert.match(extension, /social-profile-discovery/)
assert.match(extension, /social_profile_discovery_contacts/)

console.log("growth-social-profile-discovery-7.5b: ok")
