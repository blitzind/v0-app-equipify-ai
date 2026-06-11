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
import { buildApollo25CompanyPilotEligibilityDiagnostic } from "../lib/growth/apollo/apollo-25-company-pilot-eligibility-diagnostic"
import { buildApolloIntelligenceRecoveryCanonicalAuditRow } from "../lib/growth/apollo/apollo-intelligence-recovery-audit"
import {
  buildApolloIntelligenceRecoveryCompanyEvidence,
  aggregateApolloIntelligenceRecoveryWriteEvidence,
  evaluateApolloIntelligenceRecoveryNoOp,
} from "../lib/growth/apollo/apollo-intelligence-recovery-evidence"
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
  "lib/growth/apollo/apollo-intelligence-recovery-evidence.ts",
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
console.log("  ✓ score decomposition shows 65 cap with company intelligence")

const noIntelRow = buildApolloIntelligenceRecoveryScoreDecompositionRow({
  company_candidate_id: "co-0",
  company_name: "No Intel Co",
  contacts: [buildContact(0, "No Intel Co")],
  snapshot_summary: {
    mapped_contacts: 1,
    verified_email_contacts: 1,
    contactable_contacts: 1,
    sequence_ready_contacts: 1,
  },
  qualificationContext: {
    company_intelligence_present: false,
    buying_committee_present: false,
    buying_committee_coverage: null,
    fit_score: null,
    research_score: null,
  },
  production_threshold: threshold,
})
assert.equal(noIntelRow.current_score, 55)
console.log("  ✓ scorer default without company intelligence is 55 not inflated")

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

const unresolvedEvidence = buildApolloIntelligenceRecoveryCompanyEvidence({
  company_candidate_id: "co-unresolved",
  company_name: "Unresolved Co",
  canonical_company_id_before: null,
  canonical_company_id_after: null,
  canonical_resolution_attempted: true,
  canonical_resolution_result: "unresolved",
  canonical_resolution_blocker: "no_active_canonical_company_for_domain",
  company_intelligence_before: false,
  company_intelligence_after: false,
  company_intelligence_attempted: false,
  company_intelligence_outcome: "skipped",
  company_intelligence_error: null,
  buying_committee_before: false,
  buying_committee_after: false,
  buying_committee_attempted: false,
  buying_committee_outcome: "skipped",
  buying_committee_error: null,
  fit_score_before: null,
  fit_score_after: null,
  research_score_before: null,
  research_score_after: null,
  qualification_score_before: 55,
  qualification_score_after: 55,
  remaining_blockers: ["qualification_below_threshold"],
  production_threshold: threshold,
})
assert.equal(unresolvedEvidence.no_op_reason, "canonical_unresolved")
console.log("  ✓ canonical unresolved evidence")

const ciFailedEvidence = buildApolloIntelligenceRecoveryCompanyEvidence({
  company_candidate_id: "co-ci-fail",
  company_name: "CI Fail Co",
  canonical_company_id_before: "canonical-ci",
  canonical_company_id_after: "canonical-ci",
  canonical_resolution_attempted: true,
  canonical_resolution_result: "resolved",
  canonical_resolution_blocker: null,
  company_intelligence_before: false,
  company_intelligence_after: false,
  company_intelligence_attempted: true,
  company_intelligence_outcome: "failed",
  company_intelligence_error: "preflight_failed",
  buying_committee_before: false,
  buying_committee_after: false,
  buying_committee_attempted: false,
  buying_committee_outcome: "skipped",
  buying_committee_error: null,
  fit_score_before: null,
  fit_score_after: null,
  research_score_before: null,
  research_score_after: null,
  qualification_score_before: 55,
  qualification_score_after: 55,
  remaining_blockers: ["qualification_below_threshold"],
  production_threshold: threshold,
})
assert.equal(ciFailedEvidence.no_op_reason, "company_intelligence_write_failed")
console.log("  ✓ company intelligence write failure evidence")

const bcFailedEvidence = buildApolloIntelligenceRecoveryCompanyEvidence({
  company_candidate_id: "co-bc-fail",
  company_name: "BC Fail Co",
  canonical_company_id_before: "canonical-bc",
  canonical_company_id_after: "canonical-bc",
  canonical_resolution_attempted: true,
  canonical_resolution_result: "resolved",
  canonical_resolution_blocker: null,
  company_intelligence_before: true,
  company_intelligence_after: true,
  company_intelligence_attempted: false,
  company_intelligence_outcome: "reused",
  company_intelligence_error: null,
  buying_committee_before: false,
  buying_committee_after: false,
  buying_committee_attempted: true,
  buying_committee_outcome: "failed",
  buying_committee_error: "buying_committee_run_completed_without_members",
  fit_score_before: 80,
  fit_score_after: 80,
  research_score_before: 80,
  research_score_after: 80,
  qualification_score_before: 65,
  qualification_score_after: 65,
  remaining_blockers: ["qualification_below_threshold"],
  production_threshold: threshold,
})
assert.equal(bcFailedEvidence.no_op_reason, "buying_committee_write_failed")
console.log("  ✓ buying committee write failure evidence")

const recoveredEvidence = buildApolloIntelligenceRecoveryCompanyEvidence({
  company_candidate_id: "co-recovered",
  company_name: "Recovered Co",
  canonical_company_id_before: "canonical-recovered",
  canonical_company_id_after: "canonical-recovered",
  canonical_resolution_attempted: true,
  canonical_resolution_result: "resolved",
  canonical_resolution_blocker: null,
  company_intelligence_before: true,
  company_intelligence_after: true,
  company_intelligence_attempted: false,
  company_intelligence_outcome: "reused",
  company_intelligence_error: null,
  buying_committee_before: false,
  buying_committee_after: true,
  buying_committee_attempted: true,
  buying_committee_outcome: "created",
  buying_committee_error: null,
  fit_score_before: 80,
  fit_score_after: 80,
  research_score_before: 80,
  research_score_after: 80,
  qualification_score_before: 65,
  qualification_score_after: qualifiedRow.current_score,
  remaining_blockers: [],
  production_threshold: threshold,
})
assert.ok(recoveredEvidence.score_delta > 0)
assert.equal(recoveredEvidence.crossed_threshold, true)
console.log("  ✓ successful recovery increases score and crosses threshold")

const writeEvidence = aggregateApolloIntelligenceRecoveryWriteEvidence([
  unresolvedEvidence,
  ciFailedEvidence,
  bcFailedEvidence,
  recoveredEvidence,
])
assert.equal(writeEvidence.canonical_unresolved_count, 1)
assert.equal(writeEvidence.company_intelligence_failed_count, 1)
assert.equal(writeEvidence.buying_committee_failed_count, 1)
assert.equal(writeEvidence.companies_with_score_increase, 1)
assert.equal(writeEvidence.companies_crossed_threshold, 1)
console.log("  ✓ aggregate write evidence")

const noOpEval = evaluateApolloIntelligenceRecoveryNoOp({
  mode: "recover_missing_intelligence",
  writes_performed: true,
  write_evidence: {
    canonical_resolution_attempted_count: 4,
    canonical_resolved_count: 3,
    canonical_unresolved_count: 1,
    company_intelligence_attempted_count: 1,
    company_intelligence_created_count: 0,
    company_intelligence_reused_count: 0,
    company_intelligence_failed_count: 1,
    buying_committee_attempted_count: 2,
    buying_committee_created_count: 1,
    buying_committee_reused_count: 0,
    buying_committee_failed_count: 1,
    companies_with_score_increase: 0,
    companies_crossed_threshold: 0,
    no_op_reason_counts: { canonical_unresolved: 2, no_score_change: 1 },
  },
})
assert.equal(noOpEval.recovery_ok, false)
assert.equal(noOpEval.severity, "critical")
assert.ok(noOpEval.no_op_root_cause)
console.log("  ✓ recovery no-op reports blocker")

const recoveredPilotInput = buildFixtureCompany(3, {
  company_intelligence_present: true,
  buying_committee_present: true,
  buying_committee_coverage: 0.6,
  fit_score: 80,
  research_score: 80,
})
const pilotDiagnostic = buildApollo25CompanyPilotEligibilityDiagnostic(
  [recoveredPilotInput],
  { production_threshold: threshold, pilot_selection_mode: "greenfield" },
)
assert.equal(pilotDiagnostic.funnel_counts.companies_with_qualification_score_gte_threshold, 1)
assert.equal(pilotDiagnostic.funnel_counts.companies_eligible_greenfield, 1)
console.log("  ✓ pilot diagnostic reflects recovered intelligence")

const scorerConsumesEngine = buildApolloIntelligenceRecoveryQualificationContext(engineWithCommittee)
const pilotFromEngine = buildFixtureCompany(4, {
  company_intelligence_present: scorerConsumesEngine.company_intelligence_present,
  buying_committee_present: scorerConsumesEngine.buying_committee_present,
  buying_committee_coverage: scorerConsumesEngine.buying_committee_coverage,
  fit_score: scorerConsumesEngine.fit_score,
  research_score: scorerConsumesEngine.research_score,
})
const funnelFromEngine = buildApolloIntelligenceRecoveryFunnelFromSelectionInputs(
  [pilotFromEngine],
  threshold,
)
assert.equal(funnelFromEngine.score_gte_threshold_companies, 1)
console.log("  ✓ scorer consumes recovered engine artifacts in funnel")

console.log("\nApollo Intelligence Recovery Certification PASSED")
