/**
 * GE-AIOS-INVESTMENT-RECONCILIATION-1A — Local wiring test.
 *
 * Run: pnpm test:ge-aios-investment-reconciliation-1a-wiring
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  evaluateGrowthLeadAdmission,
  resolveReconciledLeadStatusFromAdmission,
} from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import {
  evaluateGrowthCanonicalStateConsistencyForLead,
  GROWTH_CANONICAL_STATE_CONSISTENCY_1A_QA_MARKER,
} from "@/lib/growth/revenue-workflow/growth-canonical-state-consistency-1a"
import {
  GROWTH_AIOS_INVESTMENT_RECONCILIATION_1A_QA_MARKER,
} from "@/lib/growth/training/investment-reconciliation-production-validation-1a"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

const reconciliationSource = readSource(
  "lib/growth/revenue-workflow/growth-operational-keyword-validation-server-1a.ts",
)
assert.match(reconciliationSource, /resolveReconciledLeadStatusFromAdmission/)
assert.doesNotMatch(
  reconciliationSource,
  /admission\.leadStatus === "disqualified" \? "disqualified" : input\.lead\.status/,
)
console.log("  ✓ reconciliation uses admission leadStatus authority")

const acceptedAdmission = evaluateGrowthLeadAdmission(
  {
    companyName: "MD Equipment Services",
    website: "https://mdequipment.example",
    source: "datamoon",
    metadata: { intake_site_key: "prospect_search_external_discovery" },
  },
  {
    approvedProfile: {
      company: { companyName: "Equipify", website: "https://equipify.example" },
      idealCustomers: { targetIndustries: ["medical equipment service"], disqualifiers: [] },
      problemsAndTriggers: { keywords: ["equipment service"], negativeKeywords: [] },
    } as never,
  },
  {
    operationalKeywordValidation: { pass: true, reason: "matched" },
    prospectSearchIndustryGatePassed: true,
  },
)
assert.equal(acceptedAdmission.state, "accepted")
assert.equal(resolveReconciledLeadStatusFromAdmission(acceptedAdmission), "new")

const staleLead = {
  id: "e7466319-9112-40a3-af46-d33c63f35823",
  companyName: "md equipment services",
  status: "disqualified",
  metadata: {
    admission_state: "accepted",
    admission_reasons: ["operational_keyword_validation_passed"],
  },
  prospectRecommendedNextAction: "prepare_outreach",
  nextBestAction: null,
  lastProspectResearchedAt: "2026-07-20T05:45:36.082Z",
  latestProspectResearchRunId: "5dd9422b-62b8-4fb2-883e-e75a4da5ec59",
  score: 95,
}

const inconsistencies = evaluateGrowthCanonicalStateConsistencyForLead({
  lead: staleLead,
  organizationId: "00757488-1026-44a5-aac4-269533ac21be",
})
assert.ok(
  inconsistencies.some((row) => row.kind === "admission_accepted_status_disqualified"),
  "stale disqualified status should be flagged",
)
assert.ok(
  inconsistencies.some((row) => row.kind === "admission_accepted_stop_investment_from_status"),
  "stop_investment from stale status should be flagged",
)

const repairedLead = { ...staleLead, status: "new" }
const repairedInconsistencies = evaluateGrowthCanonicalStateConsistencyForLead({
  lead: repairedLead,
  organizationId: "00757488-1026-44a5-aac4-269533ac21be",
})
assert.equal(
  repairedInconsistencies.filter((row) => row.kind === "admission_accepted_status_disqualified")
    .length,
  0,
)

assert.equal(GROWTH_CANONICAL_STATE_CONSISTENCY_1A_QA_MARKER, "ge-aios-investment-reconciliation-1a-v1")
assert.equal(
  GROWTH_AIOS_INVESTMENT_RECONCILIATION_1A_QA_MARKER,
  "ge-aios-investment-reconciliation-1a-v1",
)

console.log(`[${GROWTH_AIOS_INVESTMENT_RECONCILIATION_1A_QA_MARKER}] wiring PASS`)
