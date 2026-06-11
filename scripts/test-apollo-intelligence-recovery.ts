/**
 * Apollo Intelligence Recovery — Phase 14.2 certification.
 * Run: pnpm test:apollo-intelligence-recovery
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import {
  selectApollo25CompanyPilotCandidates,
  type Apollo25CompanyPilotSelectionInput,
} from "../lib/growth/apollo/apollo-25-company-pilot-selection"
import { buildApolloIntelligenceRecoveryCanonicalAuditRow } from "../lib/growth/apollo/apollo-intelligence-recovery-audit"
import { buildApolloIntelligenceRecoveryFunnelFromSelectionInputs } from "../lib/growth/apollo/apollo-intelligence-recovery-funnel"
import {
  APOLLO_INTELLIGENCE_RECOVERY_EXECUTE_CONFIRM,
  validateApolloIntelligenceRecoveryConfirmation,
} from "../lib/growth/apollo/apollo-intelligence-recovery-gates"
import {
  buildApolloIntelligenceRecoveryQualificationContext,
  buildApolloIntelligenceRecoveryScoreDecompositionRow,
  summarizeApolloIntelligenceRecoveryScoreDecomposition,
} from "../lib/growth/apollo/apollo-intelligence-recovery-qualification"
import {
  APOLLO_INTELLIGENCE_RECOVERY_QA_MARKER,
  APOLLO_INTELLIGENCE_RECOVERY_MODES,
} from "../lib/growth/apollo/apollo-intelligence-recovery-types"
import { resolveApolloEnrollmentQualificationThreshold } from "../lib/growth/apollo/apollo-enrollment-qualification-engine"
import type { ApolloPrimaryContactOperatorReviewRow } from "../lib/growth/apollo/apollo-primary-contact-operator-review-types"
import type { GrowthProspectSearchEngineIntelligence } from "../lib/growth/prospect-search/prospect-search-engine-intelligence-types"

const ROOT = process.cwd()

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-intelligence-recovery-types.ts",
  "lib/growth/apollo/apollo-intelligence-recovery-gates.ts",
  "lib/growth/apollo/apollo-intelligence-recovery-qualification.ts",
  "lib/growth/apollo/apollo-intelligence-recovery-audit.ts",
  "lib/growth/apollo/apollo-intelligence-recovery-funnel.ts",
  "lib/growth/apollo/apollo-intelligence-recovery-enrichment.ts",
  "lib/growth/apollo/apollo-intelligence-recovery-route.ts",
  "app/api/platform/growth/apollo-intelligence-recovery/readiness/route.ts",
  "app/api/platform/growth/apollo-intelligence-recovery/execute/route.ts",
]

const FORBIDDEN = [
  "autoApprove",
  "auto_approve",
  "queueSequenceStepTransportJob",
  "runSequenceExecutionJob",
  "sendEmail",
  "sendSms",
  "bulkEnrollLeadsInGrowthSequence",
  "enrollLeadInSequence",
  "insertGrowthOutreachQueueItem",
  "runApolloEnrollmentAutoEnrollmentForCompany",
  "createApolloEnrollmentCandidate",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(ROOT, relativePath)), `missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

const routeSource = fs.readFileSync(
  path.join(ROOT, "lib/growth/apollo/apollo-intelligence-recovery-route.ts"),
  "utf8",
)
for (const term of FORBIDDEN) {
  assert.equal(routeSource.includes(term), false, `forbidden in recovery route: ${term}`)
}
console.log("  ✓ no enrollment/draft/job/send side effects in recovery route")

assert.equal(APOLLO_INTELLIGENCE_RECOVERY_QA_MARKER, "apollo-intelligence-recovery-v14-2")
assert.deepEqual(APOLLO_INTELLIGENCE_RECOVERY_MODES, [
  "diagnostic_only",
  "recover_missing_intelligence",
  "recompute_scores",
])

const badConfirm = validateApolloIntelligenceRecoveryConfirmation({ confirm_token: "wrong" })
assert.equal(badConfirm.ok, false)
const goodConfirm = validateApolloIntelligenceRecoveryConfirmation({
  confirm_token: APOLLO_INTELLIGENCE_RECOVERY_EXECUTE_CONFIRM,
  mode: "diagnostic_only",
})
assert.equal(goodConfirm.ok, true)
console.log("  ✓ confirmation token gate")

function buildContact(index: number, companyName: string): ApolloPrimaryContactOperatorReviewRow {
  return {
    row_id: `row-${index}`,
    company_contact_id: `cc-${index}`,
    contact_candidate_id: null,
    canonical_person_id: `person-${index}`,
    full_name: `Contact ${index}`,
    title: "CEO",
    company_name: companyName,
    source: "Apollo",
    channel_availability: { email: true, phone: true, linkedin: false },
    enrichment_status: "channel_ready",
    contactable: true,
    sequence_ready: true,
    operator_review_status: "approved",
    outreach_ready: true,
    blockers: [],
    contact_status: null,
    email_status: "verified",
    phone_status: "verified",
  }
}

const threshold = resolveApolloEnrollmentQualificationThreshold({})
const baseContext = {
  company_intelligence_present: true,
  buying_committee_present: false,
  buying_committee_coverage: null,
  fit_score: null,
  research_score: null,
}

const cappedRow = buildApolloIntelligenceRecoveryScoreDecompositionRow({
  company_candidate_id: "co-1",
  company_name: "Capped Co",
  contacts: [buildContact(1, "Capped Co")],
  snapshot_summary: {
    mapped_contacts: 1,
    verified_email_contacts: 1,
    contactable_contacts: 1,
    sequence_ready_contacts: 1,
  },
  qualificationContext: baseContext,
  production_threshold: threshold,
})
assert.equal(cappedRow.current_score, 65)
assert.equal(cappedRow.missing_points_to_threshold, 5)
console.log("  ✓ score decomposition shows 65 cap without intelligence")

const engineWithCommittee: GrowthProspectSearchEngineIntelligence = {
  qa_marker: "growth-prospect-search-engine-intelligence-7-ps-a-v1",
  schema_ready: true,
  schema_health: {
    ready: true,
    verified: true,
    uncertain: false,
    missing_objects: [],
    warning_message: null,
    env_hint: null,
  },
  canonical_company_id: "canonical-1",
  has_canonical_company: true,
  company_intelligence: {
    has_verified_intelligence: true,
    snapshot_count: 2,
    categories_present: ["operations"],
    discovery_status: "verified",
    snapshots: [{ intelligence_category: "operations", intelligence_key: "fleet", value_text: "x", confidence: 0.8, verification_status: "verified" }],
  },
  buying_committee: {
    member_count: 2,
    verified_member_count: 2,
    coverage_score: 0.6,
    single_thread_risk: false,
    roles_present: ["decision_maker"],
    roles_missing: [],
    members: [],
  },
  verified_channels: null,
  source_labels: [],
}

const enrichedContext = buildApolloIntelligenceRecoveryQualificationContext(engineWithCommittee)
const qualifiedRow = buildApolloIntelligenceRecoveryScoreDecompositionRow({
  company_candidate_id: "co-2",
  company_name: "Qualified Co",
  contacts: [buildContact(2, "Qualified Co")],
  snapshot_summary: {
    mapped_contacts: 1,
    verified_email_contacts: 1,
    contactable_contacts: 1,
    sequence_ready_contacts: 1,
  },
  qualificationContext: enrichedContext,
  production_threshold: threshold,
})
assert.ok(qualifiedRow.current_score >= threshold)
console.log("  ✓ buying committee intelligence raises score above threshold")

const zeroContact = buildContact(3, "Blocked Co")
zeroContact.sequence_ready = false
const zeroRow = buildApolloIntelligenceRecoveryScoreDecompositionRow({
  company_candidate_id: "co-3",
  company_name: "Blocked Co",
  contacts: [zeroContact],
  snapshot_summary: {
    mapped_contacts: 1,
    verified_email_contacts: 1,
    contactable_contacts: 1,
    sequence_ready_contacts: 0,
  },
  qualificationContext: baseContext,
  production_threshold: threshold,
})
assert.equal(zeroRow.current_score, 0)
assert.ok(zeroRow.score_zero_reason)
console.log("  ✓ score zero decomposition with reason")

const summary = summarizeApolloIntelligenceRecoveryScoreDecomposition([
  cappedRow,
  qualifiedRow,
  zeroRow,
])
assert.equal(summary.companies_at_65, 1)
assert.equal(summary.companies_with_score_zero, 1)
console.log("  ✓ score decomposition summary buckets")

const canonicalAudit = buildApolloIntelligenceRecoveryCanonicalAuditRow({
  company_candidate_id: "co-1",
  company_name: "Capped Co",
  canonical_company_id: null,
  evidence: {
    qa_marker: "apollo-enrichment-cert-canonical-company-resolution-en-3-v1",
    lookup_key: "co-1",
    staging_table_detected: "discovery_candidates",
    staging_row_id: "staging-1",
    candidate_domain_raw: "capped.example.com",
    candidate_domain_normalized: "capped.example.com",
    candidate_company_name: "Capped Co",
    staging_linkage_method: null,
    staging_linkage_canonical_company_id: null,
    domain_lookup_attempted: true,
    domain_lookup_company_id: null,
    name_lookup_attempted: true,
    name_lookup_company_id: null,
    name_lookup_method: null,
    promote_backfill_ran: true,
    promote_backfill_ok: false,
    promote_backfill_company_ids: [],
    promote_backfill_errors: ["duplicate"],
    final_canonical_company_id: null,
    blocker_reason: "canonical_company_id_unresolved",
  },
  resolution_blockers: ["no_active_canonical_company_for_domain:capped.example.com"],
})
assert.equal(canonicalAudit.unresolved, true)
assert.equal(canonicalAudit.can_safely_link_or_create, true)
console.log("  ✓ canonical resolution audit")

function buildFixtureCompany(
  index: number,
  intel?: Partial<Apollo25CompanyPilotSelectionInput>,
): Apollo25CompanyPilotSelectionInput {
  const companyName = `Pilot Company ${index}`
  return {
    company_candidate_id: `company-${index}`,
    company_name: companyName,
    domain: `company${index}.example.com`,
    contacts: [buildContact(index, companyName)],
    snapshot_summary: {
      mapped_contacts: 1,
      verified_email_contacts: 1,
      contactable_contacts: 1,
      sequence_ready_contacts: 1,
    },
    enrollment_status: null,
    has_active_sequence_enrollment: false,
    in_active_pilot_cohort: false,
    company_intelligence_present: true,
    buying_committee_present: false,
    ...intel,
  }
}

const withoutIntel = buildFixtureCompany(1)
const withIntel = buildFixtureCompany(2, {
  buying_committee_present: true,
  buying_committee_coverage: 0.6,
  fit_score: 80,
  research_score: 80,
})

const funnelBefore = buildApolloIntelligenceRecoveryFunnelFromSelectionInputs(
  [withoutIntel, withIntel],
  threshold,
)
assert.equal(funnelBefore.discovered_companies, 2)
assert.equal(funnelBefore.score_gte_threshold_companies, 1)
assert.equal(funnelBefore.eligible_greenfield_companies, 1)
console.log("  ✓ funnel snapshot with intelligence wiring")

const greenfield = selectApollo25CompanyPilotCandidates([withIntel], {
  production_threshold: threshold,
  pilot_selection_mode: "greenfield",
})
assert.equal(greenfield.selected_count, 1)
console.log("  ✓ greenfield eligible with intelligence context")

assert.equal(routeSource.includes("writes_performed = input.mode === \"recover_missing_intelligence\""), true)
console.log("  ✓ recover mode is sole write path")

console.log("\nApollo Intelligence Recovery Certification PASSED")
