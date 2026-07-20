/**
 * GE-AIOS-PRE-1M-EXTERNAL-DISCOVERY-ADMISSION-REPAIR-1O — Certification.
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  evaluateGrowthLeadAdmission,
} from "@/lib/growth/revenue-workflow/evaluate-growth-lead-admission"
import { buildGrowthLeadAdmissionIntakeFromLead } from "@/lib/growth/revenue-workflow/growth-lead-admission-lead-input"
import {
  evaluateGrowthOperationalKeywordValidation,
  isExternalDiscoveryLeadIntakeSource,
} from "@/lib/growth/revenue-workflow/growth-operational-keyword-validation-1a"
import { buildLive1bEquipifyCompanyProfileContent } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { buildProspectSearchFiltersFromBusinessProfile } from "@/lib/growth/business-profile/business-profile-prospect-search-projection-1b"
import {
  GE_AIOS_PRE_1M_EXTERNAL_DISCOVERY_ADMISSION_REPAIR_1O_QA_MARKER,
  classifyPre1mExternalDiscoveryRepairCandidate,
} from "@/lib/growth/revenue-workflow/growth-pre-1m-external-discovery-repair-1o"

const QA_MARKER = GE_AIOS_PRE_1M_EXTERNAL_DISCOVERY_ADMISSION_REPAIR_1O_QA_MARKER
const ROOT = process.cwd()
const CUTOFF = "2026-07-16T19:20:00.000Z"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function sampleLead(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000099",
    company_name: "Osterwalder Ag",
    contact_name: null,
    contact_email: null,
    website: "https://osterwalder.com",
    status: "new",
    source_kind: "acquisition",
    source_detail: "datamoon:lead_inbox:test",
    promoted_organization_id: "00757488-1026-44a5-aac4-269533ac21be",
    metadata: {
      intake_site_key: "prospect_search_external_discovery",
      unified_intake_source: "saved_search",
      admission_state: "accepted",
      admission_reasons: ["profile_aligned"],
      prospect_search: { source_type: "external_discovered" },
    },
    latest_prospect_research_run_id: "11111111-1111-4111-8111-111111111111",
    last_prospect_researched_at: "2026-07-16T18:50:00.000Z",
    created_at: "2026-07-16T18:45:58.865Z",
    ...overrides,
  }
}

function noOutbound() {
  return { email: 0, sequence: 0, call: 0, sms: 0, meeting: 0, total: 0 }
}

async function main() {
  console.log(`[${QA_MARKER}] certification\n`)

  const repairSource = readSource("scripts/repair-ge-aios-pre-1m-external-discovery-admission-1o.ts")
  assert.match(repairSource, /GE_AIOS_PRE_1M_EXTERNAL_DISCOVERY_ADMISSION_REPAIR_1O_QA_MARKER/)
  assert.match(repairSource, /dry-run by default|dry_run default|\(dry-run default\)/i)
  assert.match(repairSource, /GE_AIOS_PRE_1M_EXTERNAL_DISCOVERY_REPAIR_CONFIRM_TOKEN/)
  assert.match(repairSource, /discoverPre1mExternalDiscoveryRepairCandidates/)
  assert.match(repairSource, /reconcileExternalDiscoveryPostResearchAdmission/)
  assert.match(repairSource, /repair_qa_marker/)
  assert.doesNotMatch(repairSource, /executeBulkPushToLeadInbox|createLeadCandidate|runProspectSearchDatamoon/)
  assert.doesNotMatch(repairSource, /autonomy_outbound_enabled\s*=\s*true/)
  console.log("  ✓ I — Architecture guard — repair script boundaries")

  const bridgeSource = readSource("lib/growth/lead-inbox/lead-inbox-canonical-intake-bridge.ts")
  assert.match(
    bridgeSource,
    /siteKey === "prospect_search_external_discovery"\) return "datamoon"/,
  )
  console.log("  ✓ I — 1M classification unchanged in bridge")

  const profile = buildLive1bEquipifyCompanyProfileContent()
  const requiredKeywords = buildProspectSearchFiltersFromBusinessProfile(profile).keywords ?? []
  const admissionContext = { approvedProfile: profile, activeMissionTitle: null }

  // A — Research complete, keyword fail → rejected
  const keywordFail = evaluateGrowthOperationalKeywordValidation({
    companyName: "Osterwalder Ag",
    industry: "Machinery Manufacturing",
    requiredKeywords,
    websiteCrawlText: "powder compaction machinery manufacturing industrial presses",
  })
  assert.equal(keywordFail.pass, false)
  const intakeA = buildGrowthLeadAdmissionIntakeFromLead({
    id: "a",
    company_name: "Osterwalder Ag",
    website: "https://osterwalder.com",
    metadata: {
      unified_intake_source: "datamoon",
      admission_state: "accepted",
      admission_reasons: ["profile_aligned"],
      prospect_search_industry_gate_passed: true,
    },
  })
  const postResearchReject = evaluateGrowthLeadAdmission(intakeA, admissionContext, {
    operationalKeywordValidation: keywordFail,
    prospectSearchIndustryGatePassed: true,
  })
  assert.equal(postResearchReject.state, "rejected")
  assert.ok(postResearchReject.reasons.includes("operational_keyword_validation_failed"))
  console.log("  ✓ A — Research complete, keyword fail → rejected")

  // B — Research complete, keyword pass
  const keywordPass = evaluateGrowthOperationalKeywordValidation({
    companyName: "Field Service Co",
    industry: "Equipment service",
    requiredKeywords,
    websiteCrawlText:
      "field service technicians preventive maintenance equipment repair installation services dispatch operations",
  })
  const postResearchPass = evaluateGrowthLeadAdmission(intakeA, admissionContext, {
    operationalKeywordValidation: keywordPass,
    prospectSearchIndustryGatePassed: true,
  })
  assert.notEqual(postResearchPass.state, "rejected")
  console.log("  ✓ B — Research complete, keyword pass → not rejected")

  // C — Research missing → review + pending keyword
  const intakeC = buildGrowthLeadAdmissionIntakeFromLead({
    id: "c",
    company_name: "Example Co",
    website: "https://example.com",
    metadata: {
      unified_intake_source: "datamoon",
      intake_site_key: "prospect_search_external_discovery",
    },
  })
  assert.equal(isExternalDiscoveryLeadIntakeSource(intakeC.source), true)
  const preResearch = evaluateGrowthLeadAdmission(intakeC, admissionContext, {
    prospectSearchIndustryGatePassed: true,
  })
  assert.equal(preResearch.state, "review")
  assert.ok(preResearch.reasons.includes("pending_operational_keyword_validation"))
  assert.equal(preResearch.allowAutoResearch, true)
  console.log("  ✓ C — Research missing → review + pending keyword + research eligible")

  // D — Post-1M datamoon lead excluded
  assert.equal(
    classifyPre1mExternalDiscoveryRepairCandidate({
      lead: sampleLead({
        created_at: "2026-07-16T20:00:00.000Z",
        metadata: {
          intake_site_key: "prospect_search_external_discovery",
          unified_intake_source: "datamoon",
          admission_state: "review",
        },
      }),
      deploymentCutoffIso: CUTOFF,
      outboundCounts: noOutbound(),
      alreadyRepaired: false,
    }),
    "already_correct",
  )
  console.log("  ✓ D — Post-1M DataMoon lead excluded")

  // E — Operator saved_search excluded
  assert.equal(
    classifyPre1mExternalDiscoveryRepairCandidate({
      lead: sampleLead({
        metadata: {
          intake_site_key: "prospect_search",
          unified_intake_source: "saved_search",
        },
      }),
      deploymentCutoffIso: CUTOFF,
      outboundCounts: noOutbound(),
      alreadyRepaired: false,
    }),
    "exclude_not_external_discovery",
  )
  console.log("  ✓ E — Operator saved_search excluded")

  // F — Ambiguous provenance
  assert.equal(
    classifyPre1mExternalDiscoveryRepairCandidate({
      lead: sampleLead({
        metadata: {
          intake_site_key: "prospect_search_external_discovery",
          unified_intake_source: "manual",
        },
      }),
      deploymentCutoffIso: CUTOFF,
      outboundCounts: noOutbound(),
      alreadyRepaired: false,
    }),
    "manual_review_required_ambiguous_provenance",
  )
  console.log("  ✓ F — Ambiguous provenance excluded")

  // G — Outbound history
  assert.equal(
    classifyPre1mExternalDiscoveryRepairCandidate({
      lead: sampleLead(),
      deploymentCutoffIso: CUTOFF,
      outboundCounts: { email: 1, sequence: 0, call: 0, sms: 0, meeting: 0, total: 1 },
      alreadyRepaired: false,
    }),
    "manual_review_required_outbound_history",
  )
  console.log("  ✓ G — Outbound-history lead excluded from auto repair")

  // H — Idempotent classification
  assert.equal(
    classifyPre1mExternalDiscoveryRepairCandidate({
      lead: sampleLead({
        metadata: {
          intake_site_key: "prospect_search_external_discovery",
          unified_intake_source: "datamoon",
          repair_qa_marker: QA_MARKER,
        },
      }),
      deploymentCutoffIso: CUTOFF,
      outboundCounts: noOutbound(),
      alreadyRepaired: true,
    }),
    "already_correct",
  )
  console.log("  ✓ H — Idempotent rerun classification")

  // Repair candidate discovery criteria
  assert.equal(
    classifyPre1mExternalDiscoveryRepairCandidate({
      lead: sampleLead(),
      deploymentCutoffIso: CUTOFF,
      outboundCounts: noOutbound(),
      alreadyRepaired: false,
    }),
    "repair_required",
  )
  console.log("  ✓ Discovery — pre-1M misclassified external discovery → repair_required")

  console.log(`\nPASS — ${QA_MARKER} certified`)
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
