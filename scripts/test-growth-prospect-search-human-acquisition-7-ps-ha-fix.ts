/**
 * Phase 7.PS-HA-FIX — Human acquisition workspace + pipeline unit tests.
 * Run: pnpm test:growth-prospect-search-human-acquisition-7-ps-ha-fix
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_PROSPECT_SEARCH_COVERAGE_QA_MARKER } from "../lib/growth/prospect-search/prospect-search-coverage-types"
import { GROWTH_PROSPECT_SEARCH_ENGINE_READINESS_QA_MARKER } from "../lib/growth/prospect-search/prospect-search-engine-readiness-types"
import {
  hasProspectSearchReachableHumans,
  scoreProspectSearchReachableHumanFromContacts,
} from "../lib/growth/prospect-search/prospect-search-reachable-human-scoring"
import type { ProspectSearchContactOverlay } from "../lib/growth/prospect-search/prospect-search-contact-intelligence-types"
import { PROSPECT_SEARCH_WORKSPACE_QUEUE_TO_BULK_ACTION } from "../lib/growth/prospect-search/prospect-search-workspace-execution-preview"
import {
  buildProspectSearchOperatorWorkspace,
  planProspectSearchWorkspaceBulkAction,
  prospectSearchWorkspaceCompanyNeedsHumanAcquisition,
  prospectSearchWorkspaceCompanyRef,
} from "../lib/growth/prospect-search/prospect-search-workspace"
import { GROWTH_PROSPECT_SEARCH_HUMAN_ACQUISITION_QA_MARKER } from "../lib/growth/prospect-search/prospect-search-human-acquisition-types"
import {
  GROWTH_PROSPECT_SEARCH_WORKSPACE_HA_FIX_QA_MARKER,
  PROSPECT_SEARCH_WORKSPACE_RESEARCH_QUEUE_IDS,
} from "../lib/growth/prospect-search/prospect-search-workspace-types"
import type { GrowthProspectSearchCompanyResult } from "../lib/growth/prospect-search/prospect-search-types"

assert.equal(
  GROWTH_PROSPECT_SEARCH_HUMAN_ACQUISITION_QA_MARKER,
  "growth-prospect-search-human-acquisition-7-ps-ha-fix-v1",
)
const jobQueueSchemaModule = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/growth-engine-job-queue-schema-health.ts"),
  "utf8",
)
assert.match(
  jobQueueSchemaModule,
  /growth-engine-job-queue-schema-health-7-ps-he-v1/,
)
assert.match(jobQueueSchemaModule, /email_discovery_jobs/)
assert.match(jobQueueSchemaModule, /phone_discovery_jobs/)
assert.match(jobQueueSchemaModule, /social_profile_discovery_jobs/)
assert.match(jobQueueSchemaModule, /company_intelligence_jobs/)
assert.match(jobQueueSchemaModule, /buying_committee_jobs/)
assert.equal(
  GROWTH_PROSPECT_SEARCH_WORKSPACE_HA_FIX_QA_MARKER,
  "growth-prospect-search-workspace-7-ps-ha-fix-v1",
)
assert.equal(PROSPECT_SEARCH_WORKSPACE_RESEARCH_QUEUE_IDS[0], "acquire_humans")
assert.equal(PROSPECT_SEARCH_WORKSPACE_QUEUE_TO_BULK_ACTION.acquire_humans, "human_acquisition")

const bulkModule = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-workspace-bulk-execution.ts"),
  "utf8",
)
assert.match(bulkModule, /executeProspectSearchHumanAcquisition/)
assert.match(bulkModule, /bulkKind === "human_acquisition"/)
assert.doesNotMatch(bulkModule, /bulkKind !== "human_acquisition"\)[\s\S]*legacy lane blocked/)

const pipelineModule = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-human-acquisition.ts"),
  "utf8",
)
assert.match(pipelineModule, /runContactDiscoveryForCompany/)
assert.match(pipelineModule, /syncContactCandidatesToCompanyContacts/)
assert.match(pipelineModule, /runCanonicalPersonBackfillForCompanyCandidate/)
assert.match(pipelineModule, /refreshProspectSearchCompanyAfterHumanAcquisition/)
assert.match(pipelineModule, /company_snapshot/)
assert.match(pipelineModule, /refreshed_company/)

const hydrationModule = fs.readFileSync(
  path.join(
    process.cwd(),
    "lib/growth/prospect-search/prospect-search-human-acquisition-hydration.ts",
  ),
  "utf8",
)
assert.match(
  hydrationModule,
  /growth-prospect-search-human-acquisition-hydration-7-ps-he-v1/,
)
assert.match(hydrationModule, /applyProspectSearchContactIntelligenceOverlay/)
assert.match(hydrationModule, /attachReachableHumanToCompanies/)
assert.doesNotMatch(hydrationModule, /findCompanyInSearch/)

function mockColdCanonicalCompany(): GrowthProspectSearchCompanyResult {
  const coverage = {
    qa_marker: GROWTH_PROSPECT_SEARCH_COVERAGE_QA_MARKER,
    company: {
      canonical_company_id: "cc-cold-1",
      resolved: true,
      confidence: 0.9,
      method: "staging_candidate_id",
      reasons: [],
      evidence: [],
      unresolved_company: false,
      normalized_domain: "biomed.example",
    },
    contacts: [],
    unresolved_contact_count: 0,
    metrics: {
      contact_count: 0,
      contacts_with_canonical_person: 0,
      canonical_person_coverage_pct: 0,
      intelligence_coverage_pct: 0,
    },
  } as NonNullable<GrowthProspectSearchCompanyResult["contact_intelligence"]>["engine_coverage"]

  return {
    id: "candidate-1",
    source_type: "external_discovered",
    company_name: "Cold Biomed Co",
    canonical_company_id: "cc-cold-1",
    contact_intelligence: {
      contacts: [],
      engine_coverage: coverage,
      engine_intelligence: {
        qa_marker: "growth-prospect-search-engine-intelligence-7-ps-a-v1",
        has_canonical_company: true,
        canonical_company_id: "cc-cold-1",
        schema_ready: true,
        schema_health: null,
        verified_channels: {
          persons_with_verified_email: 0,
          persons_with_verified_phone: 0,
          persons_with_verified_profile: 0,
          by_person_id: {},
        },
        buying_committee: {
          verified_member_count: 0,
          coverage_score: 0,
          roles_present: [],
          roles_missing: ["economic_buyer"],
          single_thread_risk: false,
          members: [],
        },
        company_intelligence: {
          has_verified_intelligence: false,
          snapshot_count: 0,
          categories_present: [],
          discovery_status: "pending",
          snapshots: [],
        },
        source_labels: [],
      },
      engine_readiness: {
        qa_marker: GROWTH_PROSPECT_SEARCH_ENGINE_READINESS_QA_MARKER,
        has_canonical_company: true,
        schema_ready: true,
        prioritization_tier: "research_first",
        prioritization_rank: 2,
        research_completeness: "research_recommended",
        operator_summary: "Research first",
        missing_critical_committee_roles: ["economic buyer"],
        missing_intelligence_categories: [],
        contactability: { score: 0, level: "blocked", summary: "", reasons: [], evidence: [] },
        channel: { score: 0, level: "blocked", summary: "", reasons: [], evidence: [] },
        committee: { score: 0, level: "blocked", summary: "", reasons: [], evidence: [] },
        company_intelligence: { score: 0, level: "blocked", summary: "", reasons: [], evidence: [] },
        overall: { score: 10, level: "gap", summary: "", reasons: [], evidence: [] },
      },
    } as GrowthProspectSearchCompanyResult["contact_intelligence"],
  } as GrowthProspectSearchCompanyResult
}

const cold = mockColdCanonicalCompany()
const ref = prospectSearchWorkspaceCompanyRef(cold)
assert.equal(prospectSearchWorkspaceCompanyNeedsHumanAcquisition(ref), true)

const workspace = buildProspectSearchOperatorWorkspace([cold])
const acquireQueue = workspace.aggregates.research_queues.find(
  (q) => q.queue_id === "acquire_humans",
)
assert.equal(acquireQueue?.count, 1)

const emailQueue = workspace.aggregates.research_queues.find(
  (q) => q.queue_id === "missing_verified_email",
)
assert.equal(emailQueue?.count, 0, "email queue requires linked humans first")

const humanPlan = planProspectSearchWorkspaceBulkAction({
  companies: [cold],
  action_kind: "human_acquisition",
  company_keys: ["external_discovered:candidate-1"],
})
assert.equal(humanPlan.executable_count, 1)
assert.equal(humanPlan.lane, "legacy_contact_discovery")

const emailPlan = planProspectSearchWorkspaceBulkAction({
  companies: [cold],
  action_kind: "email_discovery",
  company_keys: ["external_discovered:candidate-1"],
})
assert.equal(emailPlan.executable_count, 0)

const namedContact: ProspectSearchContactOverlay = {
  id: "c1",
  name: "Jane Ops",
  title: "Operations Manager",
  email: null,
  phone: null,
  confidence: 0.8,
  verification_status: "discovered",
  discovery_sources: ["website_public_extract"],
  source_evidence: [{ claim: "name", evidence: "Jane Ops on team page", source: "website" }],
} as ProspectSearchContactOverlay

const reachable = scoreProspectSearchReachableHumanFromContacts([namedContact])
assert.equal(reachable.label, "role_only")
assert.equal(hasProspectSearchReachableHumans(reachable), true)

console.log("growth-prospect-search-human-acquisition-7-ps-ha-fix: PASS")
