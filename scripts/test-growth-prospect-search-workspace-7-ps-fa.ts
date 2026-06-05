/**
 * Phase 7.PS-FA — Prospect Search operator workspace foundations.
 * Run: pnpm test:growth-prospect-search-workspace-7-ps-fa
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_PROSPECT_SEARCH_COVERAGE_QA_MARKER } from "../lib/growth/prospect-search/prospect-search-coverage-types"
import { mergeProspectSearchCoverageIntoContactIntelligence } from "../lib/growth/prospect-search/prospect-search-coverage-merge"
import { buildProspectSearchIntelligenceCoverage } from "../lib/growth/prospect-search/prospect-search-coverage-metrics"
import type { ProspectSearchCompanyResolutionCoverage } from "../lib/growth/prospect-search/prospect-search-coverage-types"
import { GROWTH_PROSPECT_SEARCH_ENGINE_READINESS_QA_MARKER } from "../lib/growth/prospect-search/prospect-search-engine-readiness-types"
import type { GrowthProspectSearchEngineIntelligence } from "../lib/growth/prospect-search/prospect-search-engine-intelligence-types"
import { mergeEngineReadinessIntoContactIntelligence } from "../lib/growth/prospect-search/prospect-search-engine-readiness"
import {
  buildProspectSearchOperatorWorkspace,
  filterProspectSearchCompaniesByWorkspaceView,
  planProspectSearchWorkspaceBulkAction,
} from "../lib/growth/prospect-search/prospect-search-workspace"
import {
  GROWTH_PROSPECT_SEARCH_WORKSPACE_QA_MARKER,
  PROSPECT_SEARCH_WORKSPACE_BULK_ACTION_KINDS,
  PROSPECT_SEARCH_WORKSPACE_COVERAGE_QUEUE_IDS,
  PROSPECT_SEARCH_WORKSPACE_PRIORITIZATION_AGGREGATES,
  PROSPECT_SEARCH_WORKSPACE_RESEARCH_QUEUE_IDS,
  PROSPECT_SEARCH_WORKSPACE_VIEW_IDS,
} from "../lib/growth/prospect-search/prospect-search-workspace-types"
import { GROWTH_PROSPECT_SEARCH_WORKSPACE_UX_QA_MARKER } from "../lib/growth/prospect-search/prospect-search-workspace-ux"
import { PROSPECT_SEARCH_WORKSPACE_VIEW_DEFINITIONS } from "../lib/growth/prospect-search/prospect-search-workspace-views"
import type { GrowthProspectSearchCompanyResult } from "../lib/growth/prospect-search/prospect-search-types"

assert.equal(
  GROWTH_PROSPECT_SEARCH_WORKSPACE_QA_MARKER,
  "growth-prospect-search-workspace-7-ps-fa-v1",
)
assert.equal(
  GROWTH_PROSPECT_SEARCH_WORKSPACE_UX_QA_MARKER,
  "growth-prospect-search-workspace-ux-7-ps-fa-v1",
)

const workspaceModule = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-workspace.ts"),
  "utf8",
)
assert.doesNotMatch(workspaceModule, /openai|intent_score|lead_score|fit_score|opportunity_score/i)
assert.doesNotMatch(workspaceModule, /\bfetch\s*\(/)
assert.doesNotMatch(workspaceModule, /enqueue|executeProspectSearchActionableResearch/i)
assert.match(workspaceModule, /buildProspectSearchActionableResearchPlan/)
assert.match(workspaceModule, /buildProspectSearchWorkspaceHealth/)
assert.match(workspaceModule, /planProspectSearchWorkspaceBulkAction/)

const shell = fs.readFileSync(
  path.join(process.cwd(), "components/growth/prospect-search/prospect-search-shell.tsx"),
  "utf8",
)
assert.match(shell, /ProspectSearchOperatorWorkspacePanel/)

for (const component of [
  "prospect-search-workspace-summary-card.tsx",
  "prospect-search-workspace-queues-card.tsx",
  "prospect-search-workspace-health-card.tsx",
  "prospect-search-workspace-view-selector.tsx",
]) {
  const source = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search", component),
    "utf8",
  )
  assert.doesNotMatch(source, /executeProspectSearchActionableResearch|enqueueProspectSearch/i)
  assert.match(source, /GROWTH_PROSPECT_SEARCH_WORKSPACE_QA_MARKER/)
}

const operatorPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/prospect-search/prospect-search-operator-workspace-panel.tsx"),
  "utf8",
)
assert.doesNotMatch(operatorPanel, /executeProspectSearchActionableResearch|enqueueProspectSearch/i)
assert.match(operatorPanel, /buildProspectSearchOperatorWorkspace/)
assert.match(operatorPanel, /data-qa-marker=\{workspace\.qa_marker\}/)

assert.equal(PROSPECT_SEARCH_WORKSPACE_VIEW_DEFINITIONS.length, PROSPECT_SEARCH_WORKSPACE_VIEW_IDS.length)
assert.equal(PROSPECT_SEARCH_WORKSPACE_PRIORITIZATION_AGGREGATES.length, 4)
assert.equal(PROSPECT_SEARCH_WORKSPACE_RESEARCH_QUEUE_IDS.length, 8)
assert.equal(PROSPECT_SEARCH_WORKSPACE_RESEARCH_QUEUE_IDS[0], "acquire_humans")
assert.equal(PROSPECT_SEARCH_WORKSPACE_COVERAGE_QUEUE_IDS.length, 5)
assert.equal(PROSPECT_SEARCH_WORKSPACE_BULK_ACTION_KINDS.length, 6)

function mockEngine(
  partial: Partial<GrowthProspectSearchEngineIntelligence>,
): GrowthProspectSearchEngineIntelligence {
  return {
    qa_marker: "growth-prospect-search-engine-intelligence-7-ps-a-v1",
    has_canonical_company: true,
    canonical_company_id: "cc-1",
    schema_ready: true,
    schema_health: null,
    verified_channels: {
      persons_with_verified_email: 1,
      persons_with_verified_phone: 1,
      persons_with_verified_profile: 0,
      by_person_id: {},
    },
    buying_committee: {
      verified_member_count: 1,
      coverage_score: 0.5,
      roles_present: ["champion"],
      roles_missing: ["economic_buyer"],
      single_thread_risk: true,
      members: [],
    },
    company_intelligence: {
      has_verified_intelligence: true,
      snapshot_count: 1,
      categories_present: ["description"],
      discovery_status: "complete",
      snapshots: [],
    },
    source_labels: [],
    ...partial,
  } as GrowthProspectSearchEngineIntelligence
}

function mockCompanyResolution(
  partial: Partial<ProspectSearchCompanyResolutionCoverage>,
): ProspectSearchCompanyResolutionCoverage {
  return {
    canonical_company_id: "cc-1",
    resolved: true,
    confidence: 0.9,
    method: "lead_metadata_canonical",
    reasons: [],
    evidence: [],
    unresolved_company: false,
    normalized_domain: "acme.com",
    ...partial,
  }
}

function buildCompany(input: {
  id: string
  engine: GrowthProspectSearchEngineIntelligence | null
  company?: Partial<ProspectSearchCompanyResolutionCoverage>
  contacts?: { contact_id: string; linked: boolean }[]
}): GrowthProspectSearchCompanyResult {
  const coverage = input.engine
    ? buildProspectSearchIntelligenceCoverage({
        company: mockCompanyResolution(input.company ?? {}),
        contacts: (input.contacts ?? [{ contact_id: "ct1", linked: true }]).map((row) => ({
          contact_id: row.contact_id,
          canonical_person_id: row.linked ? "p1" : null,
          linked: row.linked,
          confidence: row.linked ? 0.9 : 0,
          method: row.linked ? "company_contacts_column" : "unresolved",
          reasons: row.linked ? [] : ["unresolved"],
          evidence: [],
          unresolved_contact: !row.linked,
        })),
      })
    : null

  let contact_intelligence = {
    contacts: [{ id: "ct1", canonical_person_id: "p1" } as never],
    account_contact_strategy: { primary_contact: { contact_id: "ct1" } } as never,
    engine_intelligence: input.engine,
  } as NonNullable<GrowthProspectSearchCompanyResult["contact_intelligence"]>

  if (input.engine) {
    contact_intelligence = mergeEngineReadinessIntoContactIntelligence(contact_intelligence, {
      contact_intelligence,
      canonical_company_id: input.engine.canonical_company_id,
      is_suppressed: false,
    })
  }
  if (coverage) {
    contact_intelligence = mergeProspectSearchCoverageIntoContactIntelligence(
      contact_intelligence,
      coverage,
    )
  }

  return {
    id: input.id,
    source_type: "growth_lead",
    company_name: `Company ${input.id}`,
    canonical_company_id: input.engine?.canonical_company_id ?? null,
    contact_intelligence,
  } as GrowthProspectSearchCompanyResult
}

const ready = buildCompany({ id: "ready", engine: mockEngine({}) })
const missingEmail = buildCompany({
  id: "no-email",
  engine: mockEngine({
    verified_channels: {
      persons_with_verified_email: 0,
      persons_with_verified_phone: 1,
      persons_with_verified_profile: 0,
      by_person_id: {},
    },
  }),
})
const unresolved = buildCompany({
  id: "unresolved",
  engine: mockEngine({ canonical_company_id: null, has_canonical_company: false }),
  company: {
    canonical_company_id: null,
    resolved: false,
    unresolved_company: true,
    method: "unresolved",
    confidence: 0,
  },
})

const workspace = buildProspectSearchOperatorWorkspace([ready, missingEmail, unresolved])
assert.equal(workspace.qa_marker, GROWTH_PROSPECT_SEARCH_WORKSPACE_QA_MARKER)
assert.equal(workspace.account_count, 3)
assert.equal(workspace.aggregates.prioritization.length, 4)
assert.equal(workspace.aggregates.research_queues.length, 8)
assert.equal(workspace.aggregates.coverage_queues.length, 5)
assert.equal(workspace.views.length, PROSPECT_SEARCH_WORKSPACE_VIEW_IDS.length)

const missingEmailQueue = workspace.aggregates.research_queues.find(
  (row) => row.queue_id === "missing_verified_email",
)
assert.ok(missingEmailQueue && missingEmailQueue.count >= 1)
assert.ok(missingEmailQueue.company_keys.some((key) => key.includes("no-email")))

const unresolvedQueue = workspace.aggregates.research_queues.find(
  (row) => row.queue_id === "unresolved_company",
)
assert.ok(unresolvedQueue && unresolvedQueue.count >= 1)

const readyTier = workspace.aggregates.prioritization.find(
  (row) => row.key === "accounts_ready_for_outreach",
)
assert.ok(readyTier)
assert.ok(ready.contact_intelligence?.engine_readiness?.qa_marker)
assert.equal(
  ready.contact_intelligence?.engine_readiness?.qa_marker,
  GROWTH_PROSPECT_SEARCH_ENGINE_READINESS_QA_MARKER,
)
assert.equal(ready.contact_intelligence?.engine_coverage?.qa_marker, GROWTH_PROSPECT_SEARCH_COVERAGE_QA_MARKER)
assert.ok(workspace.health.account_count === 3)
assert.ok(workspace.health.canonical_company_coverage_pct >= 0)

const outreachView = workspace.views.find((row) => row.view_id === "outreach_ready")
assert.ok(outreachView)

const filtered = filterProspectSearchCompaniesByWorkspaceView(
  [ready, missingEmail, unresolved],
  "missing_emails",
)
assert.ok(filtered.some((row) => row.id === "no-email"))

const bulkPlan = planProspectSearchWorkspaceBulkAction({
  companies: [ready, missingEmail],
  action_kind: "email_discovery",
})
assert.equal(bulkPlan.qa_marker, GROWTH_PROSPECT_SEARCH_WORKSPACE_QA_MARKER)
assert.equal(bulkPlan.action_kind, "email_discovery")
assert.equal(bulkPlan.action_count, 2)
assert.ok(bulkPlan.planner_note.length > 0)
assert.ok(bulkPlan.executable_count + bulkPlan.blocked_count === bulkPlan.action_count)

console.log("growth-prospect-search-workspace-7-ps-fa: PASS")
