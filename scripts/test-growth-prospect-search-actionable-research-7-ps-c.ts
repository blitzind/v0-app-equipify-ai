/**
 * Phase 7.PS-C — Prospect Search actionable Growth Engine research workflow tests.
 * Run: pnpm test:growth-prospect-search-actionable-research-7-ps-c
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildGrowthEngineJobRequestBody,
  buildProspectSearchActionableResearchPlan,
  buildProspectSearchEngineDiscoveryRollup,
  buildProspectSearchSuggestedGrowthEngineActions,
  growthEngineJobEndpoint,
  mapProspectSearchResearchActionToJobLane,
  resolveProspectSearchCanonicalResearchContext,
} from "../lib/growth/prospect-search/prospect-search-actionable-research"
import { GROWTH_PROSPECT_SEARCH_ACTIONABLE_RESEARCH_QA_MARKER } from "../lib/growth/prospect-search/prospect-search-actionable-research-types"
import { GROWTH_PROSPECT_SEARCH_ENGINE_INTELLIGENCE_QA_MARKER } from "../lib/growth/prospect-search/prospect-search-engine-intelligence-types"
import type { GrowthProspectSearchCompanyResult } from "../lib/growth/prospect-search/prospect-search-types"

assert.equal(
  GROWTH_PROSPECT_SEARCH_ACTIONABLE_RESEARCH_QA_MARKER,
  "growth-prospect-search-actionable-research-7-ps-c-v1",
)

const researchModule = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-actionable-research.ts"),
  "utf8",
)
assert.doesNotMatch(researchModule, /cron|orchestrator|openai|anthropic/i)
assert.match(researchModule, /email-discovery\/jobs/)
assert.match(researchModule, /phone-discovery\/jobs/)
assert.match(researchModule, /social-profile-discovery\/jobs/)
assert.match(researchModule, /company-intelligence\/jobs/)
assert.match(researchModule, /buying-committee-intelligence\/jobs/)

const executeModule = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-actionable-research-execute.ts"),
  "utf8",
)
assert.match(executeModule, /executeProspectSearchActionableResearch/)
assert.match(executeModule, /contact-discovery/)

const shell = fs.readFileSync(
  path.join(process.cwd(), "components/growth/prospect-search/prospect-search-shell.tsx"),
  "utf8",
)
assert.match(shell, /executeProspectSearchActionableResearch/)

const enginePanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/prospect-search/prospect-search-engine-intelligence-panel.tsx"),
  "utf8",
)
assert.match(enginePanel, /ProspectSearchActionableResearchActions/)
assert.match(enginePanel, /ProspectSearchEngineDiscoveryRollup/)

const summary = fs.readFileSync(
  path.join(process.cwd(), "components/growth/prospect-search/prospect-search-engine-intelligence-summary.tsx"),
  "utf8",
)
assert.match(summary, /ProspectSearchEngineDiscoveryRollup/)

assert.equal(mapProspectSearchResearchActionToJobLane("verify_email"), "email_discovery")
assert.equal(mapProspectSearchResearchActionToJobLane("verify_phone_numbers"), "phone_discovery")
assert.equal(mapProspectSearchResearchActionToJobLane("rerun_website_extraction"), "company_intelligence")
assert.equal(mapProspectSearchResearchActionToJobLane("find_owner"), "buying_committee_intelligence")
assert.equal(mapProspectSearchResearchActionToJobLane("refresh_stale_contacts"), "legacy_contact_discovery")

assert.equal(growthEngineJobEndpoint("email_discovery"), "/api/platform/growth/email-discovery/jobs")
assert.equal(growthEngineJobEndpoint("legacy_contact_discovery"), null)

function mockCompany(
  engine: NonNullable<GrowthProspectSearchCompanyResult["contact_intelligence"]>["engine_intelligence"],
): GrowthProspectSearchCompanyResult {
  return {
    id: "staging-1",
    source_type: "external_discovered",
    company_name: "Acme",
    contact_intelligence: {
      contacts: [{ id: "ct1", canonical_person_id: "p1" } as never],
      account_contact_strategy: {
        primary_contact: { contact_id: "ct1" },
      } as never,
      engine_intelligence: engine,
    } as never,
  } as GrowthProspectSearchCompanyResult
}

const withEngine = mockCompany({
  qa_marker: GROWTH_PROSPECT_SEARCH_ENGINE_INTELLIGENCE_QA_MARKER,
  schema_ready: true,
  schema_health: null,
  canonical_company_id: "co1",
  has_canonical_company: true,
  company_intelligence: {
    has_verified_intelligence: false,
    snapshot_count: 0,
    categories_present: [],
    discovery_status: "none",
    snapshots: [],
  },
  buying_committee: null,
  verified_channels: {
    person_count: 1,
    persons_with_verified_email: 0,
    persons_with_verified_phone: 0,
    persons_with_verified_profile: 0,
    by_person_id: {
      p1: {
        person_id: "p1",
        has_verified_email: false,
        verified_email: null,
        has_verified_phone: false,
        verified_phone: null,
        has_verified_profile: false,
        verified_profile_url: null,
      },
    },
  },
  source_labels: [],
})

const ctx = resolveProspectSearchCanonicalResearchContext(withEngine)
assert.equal(ctx.canonical_company_id, "co1")
assert.equal(ctx.canonical_person_id, "p1")

const emailPlan = buildProspectSearchActionableResearchPlan({
  company: withEngine,
  actionKind: "verify_email",
})
assert.equal(emailPlan.lane, "email_discovery")
assert.equal(emailPlan.can_execute, true)
assert.equal(emailPlan.company_id, "co1")
assert.equal(emailPlan.person_id, "p1")

const body = buildGrowthEngineJobRequestBody(emailPlan)
assert.deepEqual(body, {
  company_id: "co1",
  person_id: "p1",
  promote_on_complete: true,
  trigger_source: "manual",
})

const noCanonical = buildProspectSearchActionableResearchPlan({
  company: { id: "x", source_type: "growth_lead", company_name: "X" } as GrowthProspectSearchCompanyResult,
  actionKind: "verify_email",
})
assert.equal(noCanonical.can_execute, false)
assert.ok(noCanonical.blocked_reason?.includes("canonical"))

const suggestions = buildProspectSearchSuggestedGrowthEngineActions(withEngine)
assert.ok(suggestions.length >= 2)

const rollup = buildProspectSearchEngineDiscoveryRollup(withEngine)
assert.ok(rollup?.lanes.length === 5)
assert.ok(rollup?.summary?.includes("lane"))

console.log("growth-prospect-search-actionable-research-7-ps-c: PASS")
