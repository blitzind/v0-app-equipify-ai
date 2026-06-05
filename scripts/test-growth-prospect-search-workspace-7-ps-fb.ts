/**
 * Phase 7.PS-FB — Prospect Search workspace worklists & execution preview.
 * Run: pnpm test:growth-prospect-search-workspace-7-ps-fb
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
  filterProspectSearchCompaniesByWorkspaceView,
  filterProspectSearchDiscoverResultsToVisibleCompanies,
  prospectSearchWorkspaceCompanyInQueue,
} from "../lib/growth/prospect-search/prospect-search-workspace"
import { buildProspectSearchWorkspaceExecutionPreview } from "../lib/growth/prospect-search/prospect-search-workspace-execution-preview"
import { buildProspectSearchWorkspaceWorklistMetrics } from "../lib/growth/prospect-search/prospect-search-workspace-metrics"
import {
  clearProspectSearchWorkspaceSelection,
  selectAllProspectSearchWorkspaceVisible,
  toggleProspectSearchWorkspaceSelection,
} from "../lib/growth/prospect-search/prospect-search-workspace-selection"
import {
  buildProspectSearchWorkspaceWorklist,
  buildProspectSearchWorkspaceWorklistForView,
  prospectSearchWorkspaceViewToWorklistKind,
} from "../lib/growth/prospect-search/prospect-search-workspace-worklists"
import {
  GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_QA_MARKER,
  PROSPECT_SEARCH_WORKSPACE_WORKLIST_KINDS,
} from "../lib/growth/prospect-search/prospect-search-workspace-types"
import { GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_UX_QA_MARKER } from "../lib/growth/prospect-search/prospect-search-workspace-ux"
import type { GrowthProspectSearchCompanyResult } from "../lib/growth/prospect-search/prospect-search-types"

assert.equal(
  GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_QA_MARKER,
  "growth-prospect-search-workspace-7-ps-fb-v1",
)
assert.equal(
  GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_UX_QA_MARKER,
  "growth-prospect-search-workspace-ux-7-ps-fb-v1",
)

const fbModules = [
  "prospect-search-workspace-worklists.ts",
  "prospect-search-workspace-selection.ts",
  "prospect-search-workspace-metrics.ts",
]
for (const file of fbModules) {
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/prospect-search", file),
    "utf8",
  )
  assert.doesNotMatch(source, /\bfetch\s*\(/)
  assert.doesNotMatch(source, /enqueue|executeProspectSearchActionableResearch/i)
}

const previewModule = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-workspace-execution-preview.ts"),
  "utf8",
)
assert.match(previewModule, /buildProspectSearchActionableResearchPlan/)
assert.match(previewModule, /planProspectSearchWorkspaceBulkAction/)
assert.doesNotMatch(previewModule, /executeProspectSearchActionableResearch|enqueueProspectSearch/i)

const shell = fs.readFileSync(
  path.join(process.cwd(), "components/growth/prospect-search/prospect-search-shell.tsx"),
  "utf8",
)
assert.match(shell, /filterProspectSearchCompaniesByWorkspaceView/)
assert.match(shell, /filterProspectSearchDiscoverResultsToVisibleCompanies/)
assert.match(shell, /displayDiscoverResults/)
assert.match(shell, /displayCompanies\.length/)
assert.match(shell, /visibleCompanies=\{displayCompanies\}/)
assert.match(shell, /workspaceViewId/)
assert.match(shell, /ProspectSearchOperatorWorkspacePanel/)

for (const component of [
  "prospect-search-workspace-worklist-card.tsx",
  "prospect-search-workspace-execution-preview-card.tsx",
  "prospect-search-workspace-selection-bar.tsx",
]) {
  const source = fs.readFileSync(
    path.join(process.cwd(), "components/growth/prospect-search", component),
    "utf8",
  )
  assert.match(source, /GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_QA_MARKER/)
  assert.doesNotMatch(source, /executeProspectSearchActionableResearch|enqueueProspectSearch/i)
}

const operatorPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/prospect-search/prospect-search-operator-workspace-panel.tsx"),
  "utf8",
)
assert.match(operatorPanel, /ProspectSearchWorkspaceWorklistCard/)
assert.match(operatorPanel, /ProspectSearchWorkspaceExecutionPreviewCard/)
assert.match(operatorPanel, /ProspectSearchWorkspaceSelectionBar/)
assert.match(operatorPanel, /visibleCompanies/)
assert.doesNotMatch(operatorPanel, /filterProspectSearchCompaniesByWorkspaceView/)
assert.doesNotMatch(operatorPanel, /executeProspectSearchActionableResearch|enqueueProspectSearch/i)

assert.equal(PROSPECT_SEARCH_WORKSPACE_WORKLIST_KINDS.length, 7)

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
}): GrowthProspectSearchCompanyResult {
  const coverage = input.engine
    ? buildProspectSearchIntelligenceCoverage({
        company: mockCompanyResolution({}),
        contacts: [{ contact_id: "ct1", linked: true, canonical_person_id: "p1", confidence: 0.9, method: "company_contacts_column", reasons: [], evidence: [], unresolved_contact: false }],
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

const filtered = filterProspectSearchCompaniesByWorkspaceView(
  [ready, missingEmail],
  "missing_emails",
)
assert.equal(filtered.length, 1)
assert.equal(filtered[0]?.id, "no-email")
assert.equal(filtered[0]?.company_name, missingEmail.company_name)

const discoverRows = filterProspectSearchDiscoverResultsToVisibleCompanies(
  [
    {
      company_id: ready.id,
      company_name: ready.company_name,
      company: ready,
    },
    {
      company_id: missingEmail.id,
      company_name: missingEmail.company_name,
      company: missingEmail,
    },
  ] as never,
  filtered,
)
assert.equal(discoverRows.length, 1)
assert.equal(discoverRows[0]?.company_id, "no-email")

const worklist = buildProspectSearchWorkspaceWorklist({
  companies: [ready, missingEmail],
  kind: "missing_email",
})
assert.equal(worklist.qa_marker, GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_QA_MARKER)
assert.ok(worklist.rows.some((row) => row.company_key.includes("no-email")))

const viewWorklist = buildProspectSearchWorkspaceWorklistForView({
  companies: [ready, missingEmail],
  viewId: "outreach_ready",
})
assert.equal(
  prospectSearchWorkspaceViewToWorklistKind("research_queue"),
  "research_first",
)
assert.ok(viewWorklist.kind === "outreach_ready")

let selection = clearProspectSearchWorkspaceSelection()
selection = toggleProspectSearchWorkspaceSelection(selection, "growth_lead:ready", true)
selection = selectAllProspectSearchWorkspaceVisible(selection, [
  "growth_lead:ready",
  "growth_lead:no-email",
])
assert.equal(selection.selectedKeys.size, 2)

const preview = buildProspectSearchWorkspaceExecutionPreview({
  companies: [ready, missingEmail],
  company_keys: ["growth_lead:no-email"],
  queue_id: "missing_verified_email",
})
assert.equal(preview.qa_marker, GROWTH_PROSPECT_SEARCH_WORKSPACE_FB_QA_MARKER)
assert.equal(preview.selected_account_count, 1)
assert.ok(preview.planner_note.length > 0)
assert.ok(preview.recommended_action_kinds.length >= 0)

const metrics = buildProspectSearchWorkspaceWorklistMetrics({
  visible_company_keys: ["growth_lead:ready", "growth_lead:no-email"],
  selected_company_keys: ["growth_lead:no-email"],
  preview,
})
assert.equal(metrics.visible_accounts, 2)
assert.equal(metrics.selected_accounts, 1)

assert.ok(
  prospectSearchWorkspaceCompanyInQueue(
    { company_key: "k", company_id: "no-email", source_type: "growth_lead", company_name: "X", canonical_company_id: "cc-1", growth_lead_id: null, readiness: ready.contact_intelligence?.engine_readiness ?? null, coverage: ready.contact_intelligence?.engine_coverage ?? null, engine: missingEmail.contact_intelligence?.engine_intelligence ?? null },
    "missing_verified_email",
  ),
)

assert.equal(ready.contact_intelligence?.engine_readiness?.qa_marker, GROWTH_PROSPECT_SEARCH_ENGINE_READINESS_QA_MARKER)
assert.equal(ready.contact_intelligence?.engine_coverage?.qa_marker, GROWTH_PROSPECT_SEARCH_COVERAGE_QA_MARKER)

console.log("growth-prospect-search-workspace-7-ps-fb: PASS")
