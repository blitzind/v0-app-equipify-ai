/**
 * Phase 7.PS-FC — Prospect Search workspace controlled bulk execution.
 * Run: pnpm test:growth-prospect-search-workspace-7-ps-fc
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
import { planProspectSearchWorkspaceBulkAction } from "../lib/growth/prospect-search/prospect-search-workspace"
import {
  validateProspectSearchWorkspaceBulkExecution,
} from "../lib/growth/prospect-search/prospect-search-workspace-bulk-execution"
import { buildProspectSearchWorkspaceExecutionPreview } from "../lib/growth/prospect-search/prospect-search-workspace-execution-preview"
import {
  GROWTH_PROSPECT_SEARCH_WORKSPACE_FC_QA_MARKER,
  PROSPECT_SEARCH_WORKSPACE_BULK_EXECUTION_MAX_ACCOUNTS,
} from "../lib/growth/prospect-search/prospect-search-workspace-types"
import { GROWTH_PROSPECT_SEARCH_WORKSPACE_FC_UX_QA_MARKER } from "../lib/growth/prospect-search/prospect-search-workspace-ux"
import type { GrowthProspectSearchCompanyResult } from "../lib/growth/prospect-search/prospect-search-types"

assert.equal(
  GROWTH_PROSPECT_SEARCH_WORKSPACE_FC_QA_MARKER,
  "growth-prospect-search-workspace-7-ps-fc-v1",
)
assert.equal(
  GROWTH_PROSPECT_SEARCH_WORKSPACE_FC_UX_QA_MARKER,
  "growth-prospect-search-workspace-ux-7-ps-fc-v1",
)

const bulkModule = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/prospect-search/prospect-search-workspace-bulk-execution.ts"),
  "utf8",
)
assert.match(bulkModule, /executeProspectSearchActionableResearch/)
assert.match(bulkModule, /validateProspectSearchWorkspaceBulkExecution/)
assert.match(bulkModule, /planProspectSearchWorkspaceBulkAction/)
assert.match(bulkModule, /prospectSearchWorkspaceBulkActionKindForQueue/)
assert.doesNotMatch(bulkModule, /\/run\b|orchestrator/i)
assert.match(bulkModule, /executeProspectSearchHumanAcquisition/)
assert.doesNotMatch(bulkModule, /enqueueProspectSearch/)

const bulkCard = fs.readFileSync(
  path.join(
    process.cwd(),
    "components/growth/prospect-search/prospect-search-workspace-bulk-execution-card.tsx",
  ),
  "utf8",
)
assert.match(bulkCard, /PROSPECT_SEARCH_WORKSPACE_BULK_QUEUE_RESEARCH_LABEL/)
assert.match(bulkCard, /PROSPECT_SEARCH_WORKSPACE_BULK_CONFIRM_LABEL/)
assert.match(bulkCard, /PROSPECT_SEARCH_WORKSPACE_BULK_CANCEL_LABEL/)
assert.doesNotMatch(bulkCard, /auto prospect|run automation/i)

const operatorPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/prospect-search/prospect-search-operator-workspace-panel.tsx"),
  "utf8",
)
assert.match(operatorPanel, /ProspectSearchWorkspaceBulkExecutionCard/)
assert.match(operatorPanel, /GROWTH_PROSPECT_SEARCH_WORKSPACE_FC_QA_MARKER/)

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
      persons_with_verified_email: 0,
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

function mockCompanyResolution(): ProspectSearchCompanyResolutionCoverage {
  return {
    canonical_company_id: "cc-1",
    resolved: true,
    confidence: 0.9,
    method: "lead_metadata_canonical",
    reasons: [],
    evidence: [],
    unresolved_company: false,
    normalized_domain: "acme.com",
  }
}

function buildCompany(input: {
  id: string
  engine: GrowthProspectSearchEngineIntelligence | null
}): GrowthProspectSearchCompanyResult {
  const coverage = input.engine
    ? buildProspectSearchIntelligenceCoverage({
        company: mockCompanyResolution(),
        contacts: [
          {
            contact_id: "ct1",
            linked: true,
            canonical_person_id: "p1",
            confidence: 0.9,
            method: "company_contacts_column",
            reasons: [],
            evidence: [],
            unresolved_contact: false,
          },
        ],
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

const preview = buildProspectSearchWorkspaceExecutionPreview({
  companies: [missingEmail],
  company_keys: ["growth_lead:no-email"],
  queue_id: "missing_verified_email",
})

assert.equal(preview.queue_id, "missing_verified_email")

const blockedNoSelection = validateProspectSearchWorkspaceBulkExecution({
  selected_company_keys: [],
  preview,
  queue_id: "missing_verified_email",
  companies: [missingEmail],
})
assert.equal(blockedNoSelection.allowed, false)

const blockedNoQueue = validateProspectSearchWorkspaceBulkExecution({
  selected_company_keys: ["growth_lead:no-email"],
  preview,
  queue_id: null,
  companies: [missingEmail],
})
assert.equal(blockedNoQueue.allowed, false)

const unresolvedQueue = validateProspectSearchWorkspaceBulkExecution({
  selected_company_keys: ["growth_lead:no-email"],
  preview,
  queue_id: "unresolved_company",
  companies: [missingEmail],
})
assert.equal(unresolvedQueue.allowed, false)

const allowed = validateProspectSearchWorkspaceBulkExecution({
  selected_company_keys: ["growth_lead:no-email"],
  preview,
  queue_id: "missing_verified_email",
  companies: [missingEmail],
})
assert.equal(allowed.allowed, true)
assert.ok(allowed.executable_count >= 1)

const bulkPlan = planProspectSearchWorkspaceBulkAction({
  companies: [missingEmail],
  action_kind: "email_discovery",
  company_keys: ["growth_lead:no-email"],
})
assert.ok(bulkPlan.executable_count >= 1)

assert.equal(PROSPECT_SEARCH_WORKSPACE_BULK_EXECUTION_MAX_ACCOUNTS, 25)

assert.equal(
  missingEmail.contact_intelligence?.engine_readiness?.qa_marker,
  GROWTH_PROSPECT_SEARCH_ENGINE_READINESS_QA_MARKER,
)
assert.equal(
  missingEmail.contact_intelligence?.engine_coverage?.qa_marker,
  GROWTH_PROSPECT_SEARCH_COVERAGE_QA_MARKER,
)

console.log("growth-prospect-search-workspace-7-ps-fc: PASS")
