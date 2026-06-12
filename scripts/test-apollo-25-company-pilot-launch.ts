/**
 * Apollo 25-Company Pilot Launch Certification — Phase 14.
 * Run: pnpm test:apollo-25-company-pilot-launch
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"

import {
  assertApolloPilotCohortCompanyUnique,
  isApolloPilotCohortProcessingAllowed,
  resolveApolloPilotCohortStatusAfterAction,
} from "../lib/growth/apollo/apollo-pilot-cohort-state"
import { buildApollo25CompanyPilotEligibilityDiagnostic } from "../lib/growth/apollo/apollo-25-company-pilot-eligibility-diagnostic"
import {
  buildApollo25CompanyPilotLaunchChecklist,
  resolveApollo25CompanyPilotVerdict,
  validateApollo25CompanyPilotLifecycleControls,
} from "../lib/growth/apollo/apollo-25-company-pilot-launch-checklist"
import {
  buildApollo25CompanyPilotLaunchReport,
  buildApollo25CompanyPilotRootCauseSummary,
  resolveApollo25CompanyPilotEnvGatesOk,
} from "../lib/growth/apollo/apollo-25-company-pilot-launch-report"
import { runApollo25CompanyPilotPreflight } from "../lib/growth/apollo/apollo-25-company-pilot-preflight"
import { applyApollo25CompanyPilotCanonicalCohortDedupe } from "../lib/growth/apollo/apollo-25-company-pilot-canonical-cohort-dedupe"
import { buildApollo25CompanyPilotCanonicalDedupeAudit } from "../lib/growth/apollo/apollo-25-company-pilot-canonical-dedupe-audit"
import { buildApollo25CompanyPilotGreenfieldCohortSnapshot } from "../lib/growth/apollo/apollo-25-company-pilot-draft-cohort"
import { mergeApolloIntelligenceRecoveryQualificationContext } from "../lib/growth/apollo/apollo-intelligence-recovery-artifact-contract"
import { buildApolloIntelligenceRecoveryScoreDecompositionRow } from "../lib/growth/apollo/apollo-intelligence-recovery-qualification"
import {
  buildApollo25CompanyPilotCohortEnrollmentBridgeSelectionInput,
  buildApollo25CompanyPilotCohortSelfCohortExemptSelectionInput,
  evaluateApollo25CompanyPilotCohortEnrollmentReadiness,
} from "../lib/growth/apollo/apollo-25-company-pilot-cohort-enrollment-readiness"
import {
  applyApolloQualificationScoringContextToSelectionInput,
  buildApolloEnrollmentQualificationInputFromScoringContext,
  resolveApolloEnrollmentFitResearchFromScoringContext,
} from "../lib/growth/apollo/apollo-qualification-scoring-context-helpers"
import { evaluateApolloEnrollmentQualification } from "../lib/growth/apollo/apollo-enrollment-qualification-engine"
import {
  evaluateApollo25CompanyPilotCohortEnrollmentBridgeOutcome,
  snapshotCompanyQualificationPassesThreshold,
} from "../lib/growth/apollo/apollo-25-company-pilot-cohort-enrollment-bridge-evidence"
import { analyzeApollo25CompanyPilotCompanyEligibility } from "../lib/growth/apollo/apollo-25-company-pilot-selection"
import {
  evaluateApollo25CompanyPilotCohortPersonalization,
  evaluateApolloExecutionMaterializationChannelDrafts,
} from "../lib/growth/apollo/apollo-25-company-pilot-cohort-personalization-validation"
import {
  APOLLO_PILOT_COHORT_MATERIALIZATION_PREFERRED_SEQUENCE_KEYS,
  countMaterializableSequenceStepsFromSchedulingPlan,
  evaluateApolloCertificationTemplateSelection,
  inferApolloCertificationChannelAvailability,
  isApolloSequenceMaterializableSequenceKey,
  needsApolloCertificationMultichannelTemplateOverride,
} from "../lib/growth/apollo/apollo-certification-multichannel-template-override"
import { buildApolloMultichannelSchedulingPlan } from "../lib/growth/apollo/apollo-multichannel-scheduling-layer"
import { mapApolloMultichannelSequenceCandidateDbRow } from "../lib/growth/apollo/apollo-multichannel-orchestration-evidence"
import { buildApolloSequenceExecutionDraftRecords } from "../lib/growth/apollo/apollo-sequence-draft-generation"
import { buildApolloSequenceExecutionHandoffInput } from "../lib/growth/apollo/apollo-sequence-execution-handoff-input"
import { buildApolloSequenceExecutionMaterializationPlan } from "../lib/growth/apollo/apollo-sequence-materialization-engine"
import { buildApolloSequenceExecutionStepPlans } from "../lib/growth/apollo/apollo-sequence-step-generation"
import {
  buildApolloUnifiedPersonalizationContextFromPacket,
  APOLLO_UNIFIED_PERSONALIZATION_CONTEXT_QA_MARKER,
} from "../lib/growth/apollo/apollo-unified-personalization-context"
import { resolveUnsupportedSequenceMaterializationBlockers } from "../lib/growth/apollo/apollo-full-pipeline-materialization-evidence"
import { buildApollo25CompanyPilotCohortReview } from "../lib/growth/apollo/apollo-25-company-pilot-cohort-review"
import {
  describeEnrollmentDuplicatePreventionDecision,
} from "../lib/growth/apollo/apollo-full-pipeline-enrollment-resolution-evidence"
import {
  evaluateApollo25CompanyPilotEligibility,
  selectApollo25CompanyPilotCandidates,
} from "../lib/growth/apollo/apollo-25-company-pilot-selection"
import {
  APOLLO_25_COMPANY_PILOT_QA_MARKER,
  APOLLO_25_COMPANY_PILOT_TARGET_COUNT,
} from "../lib/growth/apollo/apollo-25-company-pilot-types"
import { estimateApollo25CompanyPilotWorkload } from "../lib/growth/apollo/apollo-25-company-pilot-workload"
import type { ApolloPrimaryContactOperatorReviewRow } from "../lib/growth/apollo/apollo-primary-contact-operator-review-types"

const ROOT = process.cwd()

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-25-company-pilot-types.ts",
  "lib/growth/apollo/apollo-25-company-pilot-skip-reasons.ts",
  "lib/growth/apollo/apollo-25-company-pilot-selection.ts",
  "lib/growth/apollo/apollo-25-company-pilot-eligibility-diagnostic.ts",
  "lib/growth/apollo/apollo-25-company-pilot-preflight.ts",
  "lib/growth/apollo/apollo-25-company-pilot-workload.ts",
  "lib/growth/apollo/apollo-25-company-pilot-launch-checklist.ts",
  "lib/growth/apollo/apollo-25-company-pilot-launch-report.ts",
  "lib/growth/apollo/apollo-25-company-pilot-draft-cohort.ts",
  "lib/growth/apollo/apollo-25-company-pilot-cohort-enrollment-readiness.ts",
  "lib/growth/apollo/apollo-25-company-pilot-cohort-personalization-validation.ts",
  "lib/growth/apollo/apollo-25-company-pilot-cohort-review.ts",
  "lib/growth/apollo/apollo-25-company-pilot-launch-recommendation.ts",
  "lib/growth/apollo/apollo-25-company-pilot-canonical-cohort-dedupe.ts",
  "lib/growth/apollo/apollo-25-company-pilot-canonical-dedupe-audit.ts",
  "lib/growth/apollo/apollo-25-company-pilot-launch-certification.ts",
  "lib/growth/apollo/apollo-25-company-pilot-asset-materialization.ts",
  "lib/growth/apollo/apollo-25-company-pilot-cohort-enrollment-bridge-types.ts",
  "lib/growth/apollo/apollo-25-company-pilot-cohort-enrollment-bridge-evidence.ts",
  "lib/growth/apollo/apollo-25-company-pilot-cohort-enrollment-bridge.ts",
  "lib/growth/apollo/apollo-25-company-pilot-route.ts",
  "app/api/platform/growth/apollo-25-company-pilot/report/route.ts",
  "app/api/platform/growth/apollo-25-company-pilot/diagnostic/route.ts",
  "app/api/platform/growth/apollo-25-company-pilot/cohort/route.ts",
  "app/api/platform/growth/apollo-25-company-pilot/cohort/materialize/route.ts",
  "app/api/platform/growth/apollo-25-company-pilot/cohort/enroll/route.ts",
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
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(ROOT, relativePath)), `missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

const routeSource = fs.readFileSync(
  path.join(ROOT, "lib/growth/apollo/apollo-25-company-pilot-route.ts"),
  "utf8",
)
for (const term of FORBIDDEN) {
  assert.equal(routeSource.includes(term), false, `forbidden in route: ${term}`)
}
console.log("  ✓ no outreach side-effect imports in pilot launch route")

assert.equal(APOLLO_25_COMPANY_PILOT_QA_MARKER, "apollo-25-company-pilot-launch-v14")
assert.equal(APOLLO_25_COMPANY_PILOT_TARGET_COUNT, 25)

function buildFixtureContact(index: number, companyName: string): ApolloPrimaryContactOperatorReviewRow {
  return {
    row_id: `row-${index}`,
    company_contact_id: `cc-${index}`,
    contact_candidate_id: null,
    canonical_person_id: null,
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

function buildFixtureCompany(index: number) {
  const companyName = `Pilot Company ${index}`
  const contact = buildFixtureContact(index, companyName)
  return {
    company_candidate_id: `company-${index}`,
    company_name: companyName,
    domain: `company${index}.example.com`,
    contacts: [contact],
    snapshot_summary: {
      mapped_contacts: 1,
      verified_email_contacts: 1,
      contactable_contacts: 1,
      sequence_ready_contacts: 1,
    },
    enrollment_status: null as const,
    has_active_sequence_enrollment: false,
    in_active_pilot_cohort: false,
    company_intelligence_present: true,
    buying_committee_present: true,
  }
}

const fixtureCompanies = Array.from({ length: 30 }, (_, i) => buildFixtureCompany(i + 1))

const selection = selectApollo25CompanyPilotCandidates(fixtureCompanies, { production_threshold: 70 })
assert.equal(selection.selected_count, 25)
assert.equal(selection.eligible_pool_count, 30)
assert.ok(selection.selected.every((row) => row.suppression_status === "clear"))
assert.ok(selection.selected.every((row) => row.selected_contact.verified_email_status !== "missing"))
assert.ok(selection.selected.every((row) => row.qualification_score >= 70))
console.log("  ✓ 25-company cohort selection under production rules")

const duplicatePool = [...fixtureCompanies.slice(0, 5), ...fixtureCompanies.slice(0, 5)]
const duplicateSelection = selectApollo25CompanyPilotCandidates(duplicatePool, { production_threshold: 70 })
assert.equal(duplicateSelection.selected_count, 5)
console.log("  ✓ duplicate company prevention in selection pool")

const suppressedContact = buildFixtureContact(99, "Suppressed Co")
suppressedContact.blockers = ["suppression_list_match"]
const suppressedEligibility = evaluateApollo25CompanyPilotEligibility(
  {
    company_candidate_id: "suppressed-co",
    company_name: "Suppressed Co",
    domain: "suppressed.example.com",
    contacts: [suppressedContact],
    snapshot_summary: {
      mapped_contacts: 1,
      verified_email_contacts: 1,
      contactable_contacts: 1,
      sequence_ready_contacts: 1,
    },
    enrollment_status: null,
    has_active_sequence_enrollment: false,
    in_active_pilot_cohort: false,
    buying_committee_present: true,
  },
  70,
)
assert.equal(suppressedEligibility.eligible, false)
assert.match(suppressedEligibility.reason, /suppression/)
console.log("  ✓ suppression check")

const approvedCompany = buildFixtureCompany(900)
approvedCompany.enrollment_status = "enrollment_approved"
approvedCompany.growth_lead_id = "lead-900"
const approvedGreenfield = selectApollo25CompanyPilotCandidates([approvedCompany], {
  production_threshold: 70,
  pilot_selection_mode: "greenfield",
})
assert.equal(approvedGreenfield.selected_count, 0)
assert.equal(approvedGreenfield.skipped[0]?.skip_reason, "already_enrollment_approved")
console.log("  ✓ already-approved excluded in greenfield mode")

const approvedRevalidation = selectApollo25CompanyPilotCandidates(
  [
    {
      ...approvedCompany,
      has_execution_ready_candidate: true,
      has_account_playbook: true,
    },
  ],
  {
    production_threshold: 70,
    pilot_selection_mode: "existing_pipeline_revalidation",
  },
)
assert.equal(approvedRevalidation.selected_count, 1)
console.log("  ✓ existing_pipeline_revalidation includes approved pipeline company")

const approvedNoMaterialization = selectApollo25CompanyPilotCandidates([approvedCompany], {
  production_threshold: 70,
  pilot_selection_mode: "existing_pipeline_revalidation",
})
assert.equal(approvedNoMaterialization.selected_count, 0)
assert.equal(approvedNoMaterialization.skipped[0]?.skip_reason, "materialization_not_ready")
console.log("  ✓ revalidation requires execution-ready or playbook materialization")

const emptyPoolDiagnostic = buildApollo25CompanyPilotEligibilityDiagnostic(
  [
    {
      ...approvedCompany,
      company_candidate_id: "stat-biomedical",
      company_name: "Stat Biomedical Technicians, Inc.",
    },
  ],
  { production_threshold: 70, pilot_selection_mode: "greenfield" },
)
assert.equal(emptyPoolDiagnostic.funnel_counts.companies_eligible_greenfield, 0)
assert.equal(emptyPoolDiagnostic.skipped_reason_counts.already_enrollment_approved, 1)
assert.ok(emptyPoolDiagnostic.remediation.length > 0)
assert.ok(
  emptyPoolDiagnostic.remediation.some((line) => line.includes("existing_pipeline_revalidation")),
)
const emptyRootCause = buildApollo25CompanyPilotRootCauseSummary(emptyPoolDiagnostic)
assert.match(emptyRootCause, /already_enrollment_approved|greenfield eligible 0/)
console.log("  ✓ empty eligible pool diagnostic counts and remediation")

const contactsByCompany: Record<string, ApolloPrimaryContactOperatorReviewRow> = {}
for (const company of fixtureCompanies.slice(0, 25)) {
  contactsByCompany[company.company_candidate_id] = company.contacts[0]
}

const preflight = runApollo25CompanyPilotPreflight({
  selected: selection.selected,
  contacts_by_company: contactsByCompany,
})
assert.equal(preflight.companies_evaluated, 25)
assert.equal(preflight.companies_passed, 25)
assert.equal(preflight.pilot_readiness_pct, 100)
assert.match(preflight.safety_summary, /no outreach_sent/)
console.log("  ✓ preflight materialization dry-run (no send side effects)")

const workload = estimateApollo25CompanyPilotWorkload(selection)
assert.equal(workload.enrollment_approvals_required, 25)
assert.equal(workload.draft_approvals_required, 50)
assert.equal(workload.job_approvals_required, 75)
assert.ok(workload.estimated_operator_hours > 0)
assert.ok(workload.primary_bottleneck.length > 0)
console.log("  ✓ operator workload estimate")

const lifecycle = validateApollo25CompanyPilotLifecycleControls()
assert.equal(lifecycle.valid, true)
assert.equal(isApolloPilotCohortProcessingAllowed("active"), true)
assert.equal(isApolloPilotCohortProcessingAllowed("paused"), false)
assert.equal(isApolloPilotCohortProcessingAllowed("cancelled"), false)
assert.equal(resolveApolloPilotCohortStatusAfterAction("draft", "activate"), "active")
assert.equal(resolveApolloPilotCohortStatusAfterAction("active", "pause"), "paused")
assert.equal(resolveApolloPilotCohortStatusAfterAction("paused", "resume"), "active")
assert.equal(resolveApolloPilotCohortStatusAfterAction("active", "complete"), "completed")
assert.equal(resolveApolloPilotCohortStatusAfterAction("draft", "cancel"), "cancelled")
console.log("  ✓ lifecycle controls (pause/cancel block processing)")

assert.equal(assertApolloPilotCohortCompanyUnique(["a"], "a").ok, false)
assert.equal(assertApolloPilotCohortCompanyUnique(["a"], "b").ok, true)
console.log("  ✓ cohort membership duplicate prevention")

const checklist = buildApollo25CompanyPilotLaunchChecklist({
  migration_present: true,
  cohort_status: "draft",
  selection,
  preflight,
  suppressions_checked: true,
  operator_assigned: true,
  env_gates_ok: resolveApollo25CompanyPilotEnvGatesOk({}),
})
assert.equal(checklist.all_automated_pass, true)
assert.ok(checklist.items.some((item) => item.key === "rollback"))
console.log("  ✓ launch checklist")

const report = buildApollo25CompanyPilotLaunchReport({
  selection_inputs: fixtureCompanies,
  contacts_by_company: contactsByCompany,
  migration_present: true,
  cohort_status: "draft",
  cohort_creation: {
    cohort_id: "cohort-fixture",
    cohort_name: "Fixture Pilot",
    status: "draft",
    company_count: 25,
    created: true,
  },
  suppressions_checked: true,
  operator_assigned: true,
  env_gates_ok: true,
  computed_at: "2026-06-11T12:00:00.000Z",
})

assert.equal(report.verdict, "READY TO LAUNCH 25-COMPANY PILOT")
assert.equal(report.no_outreach_side_effects, true)
assert.equal(report.lifecycle_controls_validated, true)
assert.ok(report.eligibility_diagnostic.funnel_counts.companies_eligible_greenfield >= 25)
assert.ok(report.root_cause_summary.length > 0)
assert.equal(resolveApollo25CompanyPilotVerdict(report), "READY TO LAUNCH 25-COMPANY PILOT")
console.log("  ✓ certification verdict READY TO LAUNCH 25-COMPANY PILOT")

console.log("\n--- Cohort Selection Report ---")
console.log(`Selected: ${report.selection.selected_count}/${report.selection.target_count}`)
console.log(`Eligible pool: ${report.selection.eligible_pool_count}`)
console.log(`Threshold: ${report.selection.production_qualification_threshold}`)

console.log("\n--- Preflight Certification Report ---")
console.log(`Pass rate: ${report.preflight.pilot_readiness_pct}%`)
console.log(`Passed: ${report.preflight.companies_passed}/${report.preflight.companies_evaluated}`)

console.log("\n--- Cohort Creation Summary ---")
console.log(
  `Cohort: ${report.cohort_creation.cohort_name} (${report.cohort_creation.status}) — ${report.cohort_creation.company_count} companies`,
)

console.log("\n--- Workload Estimate ---")
console.log(
  `Enrollment: ${report.workload.enrollment_approvals_required}, Voice: ${report.workload.voice_drop_approvals_required}, Multichannel: ${report.workload.multichannel_approvals_required}, Drafts: ${report.workload.draft_approvals_required}, Jobs: ${report.workload.job_approvals_required}`,
)
console.log(`Operator hours: ~${report.workload.estimated_operator_hours}h, bottleneck: ${report.workload.primary_bottleneck}`)

console.log("\n--- Launch Checklist ---")
for (const item of report.checklist.items) {
  console.log(`[${item.status}] ${item.label} — ${item.detail}`)
}

console.log("\n--- Final Verdict ---")
console.log(report.verdict)

const snapshotOnce = buildApollo25CompanyPilotGreenfieldCohortSnapshot({
  selection_inputs: fixtureCompanies,
  production_threshold: 70,
  generated_at: "2026-06-11T12:00:00.000Z",
})
const snapshotTwice = buildApollo25CompanyPilotGreenfieldCohortSnapshot({
  selection_inputs: fixtureCompanies,
  production_threshold: 70,
  generated_at: "2026-06-11T12:00:00.000Z",
})
assert.equal(snapshotOnce.snapshot_id, snapshotTwice.snapshot_id)
assert.equal(snapshotOnce.cohort_size, 30)
assert.equal(snapshotOnce.companies.length, 30)
assert.equal(snapshotOnce.immutable, true)
console.log("  ✓ greenfield cohort snapshot deterministic")

for (let i = 1; i < snapshotOnce.companies.length; i += 1) {
  const prev = snapshotOnce.companies[i - 1]!
  const next = snapshotOnce.companies[i]!
  assert.ok(prev.qualification_score >= next.qualification_score)
  assert.equal(next.cohort_rank, prev.cohort_rank + 1)
}
assert.ok(snapshotOnce.companies.every((row) => row.ranking_explanation.includes("Rank")))
console.log("  ✓ cohort ranking stable by qualification score")

const snapshotCompanyIds = snapshotOnce.companies.map((row) => row.company_candidate_id)
assert.equal(new Set(snapshotCompanyIds).size, snapshotCompanyIds.length)
console.log("  ✓ no duplicate companies in cohort snapshot")

const approvedSnapshot = buildApollo25CompanyPilotGreenfieldCohortSnapshot({
  selection_inputs: [approvedCompany],
  production_threshold: 70,
  generated_at: "2026-06-11T12:00:00.000Z",
})
assert.equal(approvedSnapshot.cohort_size, 0)
console.log("  ✓ greenfield exclusions respected in cohort snapshot")

const readinessFixtureCompanies = fixtureCompanies.map((company) => ({
  ...company,
  canonical_company_id: `canonical-${company.company_candidate_id}`,
  company_intelligence_present: true,
}))
const readinessSnapshot = buildApollo25CompanyPilotGreenfieldCohortSnapshot({
  selection_inputs: readinessFixtureCompanies,
  production_threshold: 70,
  generated_at: "2026-06-11T12:00:00.000Z",
})
const enrollmentReadiness = evaluateApollo25CompanyPilotCohortEnrollmentReadiness({
  snapshot_companies: readinessSnapshot.companies.slice(0, 5),
  selection_inputs: readinessFixtureCompanies,
  production_threshold: 70,
  readiness_mode: "preview_selection",
})
assert.equal(enrollmentReadiness.readiness_mode, "preview_selection")
assert.equal(enrollmentReadiness.companies_evaluated, 5)
assert.equal(enrollmentReadiness.companies_ready, 5)
console.log("  ✓ enrollment readiness validation accurate for eligible companies")

const personalization = evaluateApollo25CompanyPilotCohortPersonalization({
  snapshot_companies: snapshotOnce.companies.slice(0, 2),
  materialization_by_company: {},
})
assert.equal(personalization.companies_ready, 0)
assert.ok(
  personalization.companies.every((row) => row.missing_assets.includes("account_playbook")),
)
console.log("  ✓ personalization validation reports missing assets")

const smallPoolReview = buildApollo25CompanyPilotCohortReview({
  selection_inputs: fixtureCompanies.slice(0, 12),
  production_threshold: 70,
  target_size: 25,
  computed_at: "2026-06-11T12:00:00.000Z",
})
assert.equal(smallPoolReview.cohort_size, 12)
assert.equal(smallPoolReview.target_size, 25)
assert.equal(smallPoolReview.launch_recommendation.recommended_launch_size, 12)
assert.equal(smallPoolReview.launch_recommendation.ready_for_launch, false)
assert.ok(
  smallPoolReview.launch_recommendation.blocking_issues.some((issue) =>
    issue.includes("eligible_pool_below_target"),
  ),
)
console.log("  ✓ launch recommendation recommends actual launch size below target")

const cohortRouteSource = fs.readFileSync(
  path.join(ROOT, "app/api/platform/growth/apollo-25-company-pilot/cohort/route.ts"),
  "utf8",
)
assert.match(cohortRouteSource, /export async function GET/)
assert.match(cohortRouteSource, /cohort_size/)
console.log("  ✓ cohort review GET endpoint exposes cohort_size and companies")

const canonicalCohort = applyApollo25CompanyPilotCanonicalCohortDedupe([
  {
    company_candidate_id: "company-a",
    company_name: "Medical Equipment Solutions",
    qualification_score: 88,
    verified_email_count: 1,
    sequence_ready_count: 1,
    canonical_company_id: "de0b580a-c1d8-4dff-ae85-6adad57e7eff",
    enrollment_status: null,
    cohort_rank: 2,
    cohort_reason: "production_rules_passed",
    ranking_explanation: "rank 2",
  },
  {
    company_candidate_id: "company-b",
    company_name: "Medical Equipment Solutions LLC",
    qualification_score: 82,
    verified_email_count: 1,
    sequence_ready_count: 1,
    canonical_company_id: "de0b580a-c1d8-4dff-ae85-6adad57e7eff",
    enrollment_status: null,
    cohort_rank: 1,
    cohort_reason: "production_rules_passed",
    ranking_explanation: "rank 1",
  },
])
assert.equal(canonicalCohort.kept.length, 1)
assert.equal(canonicalCohort.kept[0]?.company_candidate_id, "company-a")
assert.equal(canonicalCohort.summary.duplicate_canonical_companies, 0)
assert.equal(canonicalCohort.summary.canonical_duplicates_removed, 1)
assert.equal(canonicalCohort.summary.dedupe_audit[0]?.kept_company_candidate_id, "company-a")
assert.deepEqual(canonicalCohort.summary.dedupe_audit[0]?.removed_company_candidate_ids, ["company-b"])
assert.equal(canonicalCohort.summary.excluded_companies[0]?.company_candidate_id, "company-b")
console.log("  ✓ duplicate canonical companies collapse — highest-ranked candidate retained")

const dedupeSnapshot = buildApollo25CompanyPilotGreenfieldCohortSnapshot({
  selection_inputs: [
    {
      ...buildFixtureCompany(901),
      company_candidate_id: "dup-a",
      company_name: "Medical Equipment Solutions",
      canonical_company_id: "de0b580a-c1d8-4dff-ae85-6adad57e7eff",
    },
    {
      ...buildFixtureCompany(902),
      company_candidate_id: "dup-b",
      company_name: "Medical Equipment Solutions Alt",
      canonical_company_id: "de0b580a-c1d8-4dff-ae85-6adad57e7eff",
    },
  ].map((row, index) => ({
    ...row,
    contacts: [buildFixtureContact(900 + index, row.company_name)],
    snapshot_summary: {
      mapped_contacts: 1,
      verified_email_contacts: 1,
      contactable_contacts: 1,
      sequence_ready_contacts: 1,
    },
    company_intelligence_present: true,
    buying_committee_present: true,
  })),
  production_threshold: 70,
  generated_at: "2026-06-11T12:00:00.000Z",
})
assert.equal(dedupeSnapshot.canonical_dedupe?.duplicate_canonical_companies, 0)
assert.equal(dedupeSnapshot.cohort_size, 1)
console.log("  ✓ greenfield snapshot generation applies canonical dedupe")

const certifiedReview = buildApollo25CompanyPilotCohortReview({
  selection_inputs: readinessFixtureCompanies.slice(0, 11),
  production_threshold: 70,
  target_size: 11,
  computed_at: "2026-06-11T12:00:00.000Z",
  materialization_by_company: Object.fromEntries(
    readinessFixtureCompanies.slice(0, 11).map((company) => [
      company.company_candidate_id,
      {
        has_account_playbook: true,
        has_personalization_generation: true,
        execution_drafts: [
          {
            draft_type: "email",
            channel: "email",
            body_placeholder: "Personalized email body for outreach.",
            step_number: 1,
            draft_id: "d1",
            approval_status: "draft_pending",
            subject_placeholder: "Subject",
            content_summary: "email",
            voice_drop_script_reference: null,
          },
          {
            draft_type: "sms",
            channel: "sms",
            body_placeholder: "Personalized SMS body.",
            step_number: 2,
            draft_id: "d2",
            approval_status: "draft_pending",
            subject_placeholder: null,
            content_summary: "sms",
            voice_drop_script_reference: null,
          },
          {
            draft_type: "voice_drop",
            channel: "voice_drop",
            body_placeholder: "Personalized voice script.",
            step_number: 3,
            draft_id: "d3",
            approval_status: "draft_pending",
            subject_placeholder: null,
            content_summary: "voice",
            voice_drop_script_reference: "script",
          },
        ],
        has_voice_drop_candidate: true,
      },
    ]),
  ),
})
assert.equal(certifiedReview.duplicate_canonical_companies, 0)
assert.equal(certifiedReview.enrollment_readiness.readiness_pct, 100)
assert.equal(certifiedReview.personalization.readiness_pct, 100)
assert.equal(certifiedReview.launch_recommendation.ready_for_launch, true)
assert.equal(certifiedReview.launch_certification.certified, true)
console.log("  ✓ launch certification passes on deduped cohort with full readiness")

const canonicalDedupe = buildApollo25CompanyPilotCanonicalDedupeAudit({
  snapshot_companies: canonicalCohort.kept,
})
assert.equal(canonicalDedupe.duplicate_canonical_groups.length, 0)
console.log("  ✓ outreach audit clean after canonical cohort dedupe")

const materializeRouteSource = fs.readFileSync(
  path.join(ROOT, "app/api/platform/growth/apollo-25-company-pilot/cohort/materialize/route.ts"),
  "utf8",
)
assert.match(materializeRouteSource, /materializeApollo25CompanyPilotCohortAssetReadiness/)
assert.doesNotMatch(materializeRouteSource, /runSequenceExecutionJob/)
const materializeSource = fs.readFileSync(
  path.join(ROOT, "lib/growth/apollo/apollo-25-company-pilot-asset-materialization.ts"),
  "utf8",
)
assert.match(materializeSource, /evaluateApolloExecutionMaterializationChannelDrafts/)
assert.match(materializeSource, /shouldPersistPersonalizedDrafts/)
assert.doesNotMatch(materializeSource, /runSequenceExecutionJob/)
assert.doesNotMatch(materializeSource, /queueSequenceStepTransportJob/)
console.log("  ✓ cohort materialize route present without sequence execution sends")

const placeholderHandoffDrafts = buildApolloSequenceExecutionDraftRecords({
  handoff: {
    company_name: "Summit Medical",
    full_name: "Alex Rivera",
    title: "VP Operations",
    voice_drop_script_reference: "Hi Alex, this is Equipify.",
    sequence_key: "multichannel_with_voice_drop",
    sequence_label: "Multichannel",
    scheduling_plan: { total_days: 7, touches: 4 },
    enrollment_candidate_id: "enroll-1",
    company_candidate_id: "company-1",
    company_contact_id: "contact-1",
    growth_lead_id: "lead-1",
    voice_drop_candidate_id: "voice-1",
    multichannel_sequence_candidate_id: "multi-1",
    email: "alex@example.com",
    phone: "+15551234567",
    qualification_score: 88,
    source_attribution: {},
    created_by_user_id: "user-1",
  },
  steps: [
    { step_number: 1, channel: "email", scheduled_offset_days: 1, generation_type: "follow_up_email" },
    { step_number: 2, channel: "sms", scheduled_offset_days: 2, generation_type: null },
    { step_number: 3, channel: "voice_drop", scheduled_offset_days: 3, generation_type: null },
  ],
})
const placeholderChannelDrafts = evaluateApolloExecutionMaterializationChannelDrafts(placeholderHandoffDrafts)
assert.equal(placeholderChannelDrafts.email_assets, false)
assert.equal(placeholderChannelDrafts.sms_assets, false)
const materializedChannelDrafts = evaluateApolloExecutionMaterializationChannelDrafts(
  placeholderHandoffDrafts.map((draft) => {
    if (draft.draft_type === "email") {
      return {
        ...draft,
        subject_placeholder: "Equipify idea for Summit Medical",
        body_placeholder: "Hi Alex, Equipify supports VP Operations leaders at Summit Medical.",
      }
    }
    if (draft.draft_type === "sms") {
      return { ...draft, body_placeholder: "Alex, quick Equipify follow-up re: Summit Medical. Reply STOP to opt out." }
    }
    if (draft.draft_type === "voice_drop") {
      return { ...draft, body_placeholder: "Hi Alex, this is Equipify calling about Summit Medical workflows." }
    }
    return draft
  }),
)
assert.equal(materializedChannelDrafts.email_assets, true)
assert.equal(materializedChannelDrafts.sms_assets, true)
assert.equal(materializedChannelDrafts.voice_drop_assets, true)
assert.equal(materializedChannelDrafts.content_quality_optimization, true)
console.log("  ✓ materialize channel draft readiness distinguishes placeholder vs personalized drafts")

assert.match(materializeSource, /applyApolloCertificationMultichannelTemplateOverride/)
assert.match(materializeSource, /APOLLO_PILOT_COHORT_MATERIALIZATION_PREFERRED_SEQUENCE_KEYS/)
assert.doesNotMatch(materializeSource, /runSequenceExecutionJob/)
console.log("  ✓ pilot materialize applies multichannel template override before sequence handoff")

const customFuturePlan = buildApolloMultichannelSchedulingPlan({ channel_order: ["future_channel"] })
assert.equal(
  needsApolloCertificationMultichannelTemplateOverride({
    sequence_key: "custom_future",
    scheduling_plan: customFuturePlan,
  }),
  true,
)
assert.ok(
  resolveUnsupportedSequenceMaterializationBlockers({
    sequence_key: "custom_future",
    sequence_label: "Custom Future Sequence",
    scheduling_touches: customFuturePlan.touches,
    materialized_step_count: 0,
  }).includes("unsupported_template:custom_future"),
)

const pilotChannelAvailability = inferApolloCertificationChannelAvailability({
  stored: {
    verified_email: false,
    phone: false,
    mobile_phone: false,
    voice_drop_capable: false,
    sms_capable: false,
    linkedin: false,
  },
  email: "contact@example.com",
  phone: "+15551234567",
  sequence_ready_contact: true,
})
const pilotTemplateSelection = evaluateApolloCertificationTemplateSelection({
  availability: pilotChannelAvailability,
  preferred_keys: APOLLO_PILOT_COHORT_MATERIALIZATION_PREFERRED_SEQUENCE_KEYS,
})
assert.equal(pilotTemplateSelection.template?.sequence_key, "email_voice_sms")
const pilotSchedulingPlan = buildApolloMultichannelSchedulingPlan({
  channel_order: pilotTemplateSelection.template!.channel_order,
})
assert.equal(countMaterializableSequenceStepsFromSchedulingPlan(pilotSchedulingPlan), 3)
const pilotHandoffInput = {
  company_name: "Summit Medical",
  full_name: "Alex Rivera",
  title: "VP Operations",
  voice_drop_script_reference: "Hi Alex, Equipify follow-up.",
  sequence_key: pilotTemplateSelection.template!.sequence_key,
  sequence_label: pilotTemplateSelection.template!.sequence_label,
  scheduling_plan: pilotSchedulingPlan,
  enrollment_candidate_id: "enroll-1",
  company_candidate_id: "company-1",
  company_contact_id: "contact-1",
  growth_lead_id: "lead-1",
  voice_drop_candidate_id: "voice-1",
  multichannel_sequence_candidate_id: "multi-1",
  email: "alex@example.com",
  phone: "+15551234567",
  qualification_score: 88,
  channel_order: pilotTemplateSelection.template!.channel_order,
  source_attribution: {},
}
const pilotExecutionSteps = buildApolloSequenceExecutionStepPlans(pilotHandoffInput)
assert.equal(pilotExecutionSteps.length, 3)
assert.deepEqual(
  pilotExecutionSteps.map((step) => step.channel),
  ["email", "voice_drop", "sms"],
)
const pilotPlaceholderDrafts = buildApolloSequenceExecutionDraftRecords({
  handoff: pilotHandoffInput,
  steps: pilotExecutionSteps,
})
assert.equal(pilotPlaceholderDrafts.filter((draft) => draft.draft_type === "email").length, 1)
assert.equal(pilotPlaceholderDrafts.filter((draft) => draft.draft_type === "sms").length, 1)
assert.equal(pilotPlaceholderDrafts.filter((draft) => draft.draft_type === "voice_drop").length, 1)
assert.equal(
  resolveUnsupportedSequenceMaterializationBlockers({
    sequence_key: pilotTemplateSelection.template!.sequence_key,
    sequence_label: pilotTemplateSelection.template!.sequence_label,
    scheduling_touches: pilotSchedulingPlan.touches,
    materialized_step_count: pilotExecutionSteps.length,
  }).length,
  0,
)

const unknownTemplateSelection = evaluateApolloCertificationTemplateSelection({
  availability: {
    ...pilotChannelAvailability,
    verified_email: false,
    phone: false,
    mobile_phone: false,
    voice_drop_capable: false,
    sms_capable: false,
    linkedin: false,
    contact_email_present: false,
    contact_phone_present: false,
  },
  preferred_keys: APOLLO_PILOT_COHORT_MATERIALIZATION_PREFERRED_SEQUENCE_KEYS,
})
assert.equal(unknownTemplateSelection.template, null)
console.log("  ✓ custom_future maps to materializable pilot template; unknown channels still fail safely")

assert.equal(isApolloSequenceMaterializableSequenceKey(null), false)
assert.equal(
  needsApolloCertificationMultichannelTemplateOverride({
    sequence_key: null,
    scheduling_plan: customFuturePlan,
  }),
  true,
)
const nullTemplateRow = mapApolloMultichannelSequenceCandidateDbRow({
  id: "multi-null-template",
  voice_drop_candidate_id: "voice-1",
  enrollment_candidate_id: "enroll-1",
  company_candidate_id: "company-1",
  status: "sequence_approved",
  contact_snapshot: {
    company_name: null,
    full_name: null,
    title: null,
    email: "contact@example.com",
    phone: "+15551234567",
  },
  sequence_template: {
    sequence_key: null,
    sequence_version: null,
    sequence_label: null,
    channel_order: ["future_channel"],
    recommendation_reason: null,
  },
  scheduling_plan: customFuturePlan,
  orchestration_result: {
    recommended_sequence: null,
    channel_order: ["future_channel"],
    confidence_score: 0,
    reasoning: null,
  },
  channel_availability: {
    verified_email: true,
    phone: true,
    mobile_phone: true,
    sms_capable: true,
    voice_drop_capable: true,
    linkedin: false,
  },
})
assert.equal(nullTemplateRow.sequence_template.sequence_key, "pending")
const nullTemplateHandoff = buildApolloSequenceExecutionHandoffInput({
  multichannel: nullTemplateRow,
  growth_lead_id: "lead-1",
})
assert.equal(nullTemplateHandoff.sequence_key, "pending")
assert.equal(nullTemplateHandoff.company_name, "Unknown")
assert.equal(nullTemplateHandoff.full_name, "Unknown")
const nullTemplateMaterialization = buildApolloSequenceExecutionMaterializationPlan(nullTemplateHandoff)
assert.ok(nullTemplateMaterialization.pattern_key)
const nullNameDrafts = buildApolloSequenceExecutionDraftRecords({
  handoff: {
    ...nullTemplateHandoff,
    company_name: null as unknown as string,
    full_name: null as unknown as string,
    title: null,
  },
  steps: pilotExecutionSteps.slice(0, 1),
})
assert.match(nullNameDrafts[0].body_placeholder, /Hi there/)
const nullContactUnifiedContext = buildApolloUnifiedPersonalizationContextFromPacket({
  packet: {
    companyName: "Summit Medical",
    industryLabel: null,
    website: null,
    employeeSize: null,
    location: null,
    decisionMakerName: null,
    decisionMakerTitle: null,
    fitScore: 70,
    engagementScore: 0,
    opportunityReadinessTier: "warm",
    buyingIntent: null,
    competitorPressure: null,
    capacitySignals: [],
    websiteSummary: null,
    websiteTextExcerpt: null,
    websiteFindings: [],
    hiringSignals: [],
    enrichmentFindings: [],
    researchRecommendedNextAction: null,
    priorTouchSummaries: [],
    priorReplySummaries: [],
    objectionSummaries: [],
    sequenceHistorySummaries: [],
    timelineEventSummaries: [],
    researchConfidence: 0.5,
    researchPainPoints: [],
    equipmentServiceIndicators: [],
    companySummary: null,
    outreachAngles: [],
    priorOutboundSubjects: [],
    priorTouchCount: 0,
    hasWebsiteResearch: false,
    hasDecisionMaker: false,
    memoryAvailable: false,
    memoryCoverageScore: null,
    relationshipStage: null,
    relationshipSummary: null,
    memoryPreferenceSummaries: [],
    memoryInteractionSummaries: [],
    memoryCommitmentSummaries: [],
    memoryAvoidRepeating: [],
    memoryRiskFlags: [],
    memoryCommitteeSummaries: [],
    memoryOpenLoopSummaries: [],
    memoryEngagementTrend: null,
    memoryProgressionScore: null,
    memoryUnresolvedObjectionCount: 0,
    leadEngineGuidance: null,
  },
  contact_full_name: null,
  contact_title: null,
  contact_company_name: null,
})
assert.equal(nullContactUnifiedContext.qa_marker, APOLLO_UNIFIED_PERSONALIZATION_CONTEXT_QA_MARKER)
assert.equal(nullContactUnifiedContext.contact_full_name, "there")
assert.equal(nullContactUnifiedContext.contact_company_name, "Summit Medical")
console.log("  ✓ null template/contact fields materialize without trim throws")

const enrollBridgeSource = fs.readFileSync(
  path.join(ROOT, "lib/growth/apollo/apollo-25-company-pilot-cohort-enrollment-bridge.ts"),
  "utf8",
)
assert.match(enrollBridgeSource, /buildApollo25CompanyPilotCohortEnrollmentBridgeSelectionInput/)
assert.match(enrollBridgeSource, /findApprovedEnrollmentCandidateForCompany/)
assert.match(enrollBridgeSource, /loadCompanyIdsInOtherActivePilotCohorts/)
assert.match(
  fs.readFileSync(path.join(ROOT, "lib/growth/apollo/apollo-enrollment-auto-enrollment.ts"), "utf8"),
  /loadApolloQualificationScoringContextForCompany/,
)
assert.match(
  fs.readFileSync(path.join(ROOT, "lib/growth/apollo/apollo-enrollment-auto-enrollment.ts"), "utf8"),
  /buildApolloEnrollmentQualificationInputFromScoringContext/,
)
assert.match(
  fs.readFileSync(path.join(ROOT, "lib/growth/apollo/apollo-enrollment-auto-enrollment.ts"), "utf8"),
  /resolveApolloEnrollmentFitResearchFromScoringContext/,
)
const enrollmentFitResearch = resolveApolloEnrollmentFitResearchFromScoringContext({
  company_intelligence_present: true,
  buying_committee_present: true,
  buying_committee_coverage: 0.6,
  fit_score: 90,
  research_score: 90,
})
assert.equal(enrollmentFitResearch.fit_score, 90)
assert.equal(enrollmentFitResearch.research_score, 90)
assert.equal(enrollmentFitResearch.research_summary, "Research confidence 90/100.")
const enrollmentFitResearchMissing = resolveApolloEnrollmentFitResearchFromScoringContext({
  company_intelligence_present: true,
  buying_committee_present: false,
  buying_committee_coverage: null,
  fit_score: null,
  research_score: null,
})
assert.equal(enrollmentFitResearchMissing.research_summary, null)
console.log("  ✓ enrollment fit/research scores derived from shared scoring context")
assert.match(enrollBridgeSource, /snapshotCompanyQualificationPassesThreshold/)
assert.match(enrollBridgeSource, /executeApolloFullPipelineCertificationEnrollment/)
assert.match(enrollBridgeSource, /findReusableApolloEnrollmentCandidate/)
assert.match(enrollBridgeSource, /approveApolloEnrollmentCandidate/)
assert.match(enrollBridgeSource, /handoffEnrollmentApprovedToAccountPlaybook/)
assert.match(enrollBridgeSource, /executed_at/)
assert.match(enrollBridgeSource, /failures,/)
assert.doesNotMatch(enrollBridgeSource, /runSequenceExecutionJob/)
assert.doesNotMatch(enrollBridgeSource, /queueSequenceStepTransportJob/)
console.log("  ✓ cohort enrollment bridge reuses enrollment automation + approval handoff")

const selfCohortExemptInput = buildApollo25CompanyPilotCohortSelfCohortExemptSelectionInput(
  { ...readinessFixtureCompanies[0]!, in_active_pilot_cohort: true },
  {
    company_candidate_id: readinessFixtureCompanies[0]!.company_candidate_id,
    company_ids_in_other_active_pilot_cohorts: new Set(),
  },
)
assert.equal(selfCohortExemptInput.in_active_pilot_cohort, false)
const otherCohortExemptInput = buildApollo25CompanyPilotCohortSelfCohortExemptSelectionInput(
  { ...readinessFixtureCompanies[0]!, in_active_pilot_cohort: true },
  {
    company_candidate_id: readinessFixtureCompanies[0]!.company_candidate_id,
    company_ids_in_other_active_pilot_cohorts: new Set([readinessFixtureCompanies[0]!.company_candidate_id]),
  },
)
assert.equal(otherCohortExemptInput.in_active_pilot_cohort, true)
const selfCohortEligibility = analyzeApollo25CompanyPilotCompanyEligibility(
  selfCohortExemptInput,
  70,
  "greenfield",
)
assert.equal(selfCohortEligibility.eligible, true)
assert.ok(selfCohortEligibility.contact)
console.log("  ✓ enrollment bridge self-cohort exemption allows draft cohort membership")

const otherCohortEligibility = analyzeApollo25CompanyPilotCompanyEligibility(
  otherCohortExemptInput,
  70,
  "greenfield",
)
assert.equal(otherCohortEligibility.eligible, false)
assert.equal(otherCohortEligibility.skip_reason, "active_pilot_conflict")
console.log("  ✓ enrollment bridge still blocks other active pilot cohort membership")

assert.equal(
  snapshotCompanyQualificationPassesThreshold(
    {
      company_candidate_id: readinessFixtureCompanies[0]!.company_candidate_id,
      company_name: readinessFixtureCompanies[0]!.company_name,
      qualification_score: 100,
      verified_email_count: 1,
      sequence_ready_count: 1,
      canonical_company_id: null,
      enrollment_status: null,
      cohort_rank: 1,
      cohort_reason: "production_rules_passed",
      ranking_explanation: "fixture",
    },
    70,
  ),
  true,
)
assert.equal(
  snapshotCompanyQualificationPassesThreshold(
    {
      company_candidate_id: readinessFixtureCompanies[0]!.company_candidate_id,
      company_name: readinessFixtureCompanies[0]!.company_name,
      qualification_score: 50,
      verified_email_count: 1,
      sequence_ready_count: 1,
      canonical_company_id: null,
      enrollment_status: null,
      cohort_rank: 1,
      cohort_reason: "production_rules_passed",
      ranking_explanation: "fixture",
    },
    70,
  ),
  false,
)
console.log("  ✓ enrollment bridge uses snapshot-anchored qualification threshold")

const noContactEligibility = analyzeApollo25CompanyPilotCompanyEligibility(
  buildApollo25CompanyPilotCohortSelfCohortExemptSelectionInput(
    {
      ...readinessFixtureCompanies[0]!,
      in_active_pilot_cohort: true,
      contacts: [],
      snapshot_summary: {
        mapped_contacts: 0,
        verified_email_contacts: 0,
        contactable_contacts: 0,
        sequence_ready_contacts: 0,
      },
    },
    {
      company_candidate_id: readinessFixtureCompanies[0]!.company_candidate_id,
      company_ids_in_other_active_pilot_cohorts: new Set(),
    },
  ),
  70,
  "greenfield",
)
assert.equal(noContactEligibility.eligible, false)
console.log("  ✓ enrollment bridge blocks when contact resolution fails")

const bridgeCompanyResult = (
  company_candidate_id: string,
  reused = false,
): {
  company_candidate_id: string
  company_name: string
  enrollment_candidate_id: string
  growth_lead_id: string
  created: boolean
  reused: boolean
  approved: boolean
  treated_as?: "created_approved" | "reused_approved"
} => ({
  company_candidate_id,
  company_name: `Co ${company_candidate_id}`,
  enrollment_candidate_id: `e-${company_candidate_id}`,
  growth_lead_id: `l-${company_candidate_id}`,
  created: !reused,
  reused,
  approved: true,
  treated_as: reused ? "reused_approved" : "created_approved",
})

const elevenApprovedCompanies = Array.from({ length: 11 }, (_, index) =>
  bridgeCompanyResult(`company-${index + 1}`, true),
)

assert.deepEqual(
  evaluateApollo25CompanyPilotCohortEnrollmentBridgeOutcome({
    companies_processed: 11,
    companies: elevenApprovedCompanies,
    failures: [],
    enrollment_candidates_approved: 11,
  }),
  { ok: true, partial_success: false },
)

const partialBridgeOutcome = evaluateApollo25CompanyPilotCohortEnrollmentBridgeOutcome({
  companies_processed: 11,
  companies: elevenApprovedCompanies.slice(0, 10),
  failures: [
    {
      company_candidate_id: "henry",
      company_name: "Henry Schein",
      code: "enrollment_candidate_not_created",
      message: "active_enrollment_exists:growth_lead_id=lead-henry",
    },
  ],
  enrollment_candidates_approved: 10,
})
assert.equal(partialBridgeOutcome.ok, false)
assert.equal(partialBridgeOutcome.partial_success, true)

assert.deepEqual(
  evaluateApollo25CompanyPilotCohortEnrollmentBridgeOutcome({
    companies_processed: 11,
    companies: [],
    failures: Array.from({ length: 11 }, (_, index) => ({
      company_candidate_id: `company-${index}`,
      company_name: `Co ${index}`,
      code: "already_enrollment_approved",
      message: "already_enrollment_approved",
    })),
    enrollment_candidates_approved: 0,
  }),
  { ok: false, partial_success: false },
)
console.log("  ✓ enrollment bridge partial success is not plain ok")

const approvedRerunInput = buildApollo25CompanyPilotCohortEnrollmentBridgeSelectionInput(
  {
    ...readinessFixtureCompanies[0]!,
    enrollment_status: "enrollment_approved",
    growth_lead_id: "lead-approved",
    in_active_pilot_cohort: true,
  },
  {
    company_candidate_id: readinessFixtureCompanies[0]!.company_candidate_id,
    company_ids_in_other_active_pilot_cohorts: new Set(),
  },
)
assert.equal(approvedRerunInput.enrollment_status, null)
assert.equal(approvedRerunInput.in_active_pilot_cohort, false)
const approvedRerunEligibility = analyzeApollo25CompanyPilotCompanyEligibility(
  approvedRerunInput,
  70,
  "greenfield",
)
assert.equal(approvedRerunEligibility.eligible, true)
assert.notEqual(approvedRerunEligibility.skip_reason, "already_enrollment_approved")
console.log("  ✓ enrollment bridge selection input allows approved cohort rerun without skip")

const activeEnrollmentOtherCohortInput = buildApollo25CompanyPilotCohortEnrollmentBridgeSelectionInput(
  {
    ...readinessFixtureCompanies[0]!,
    enrollment_status: null,
    has_active_sequence_enrollment: true,
    in_active_pilot_cohort: true,
  },
  {
    company_candidate_id: readinessFixtureCompanies[0]!.company_candidate_id,
    company_ids_in_other_active_pilot_cohorts: new Set([readinessFixtureCompanies[0]!.company_candidate_id]),
  },
)
const activeEnrollmentOtherCohortEligibility = analyzeApollo25CompanyPilotCompanyEligibility(
  activeEnrollmentOtherCohortInput,
  70,
  "greenfield",
)
assert.equal(activeEnrollmentOtherCohortEligibility.eligible, false)
assert.equal(activeEnrollmentOtherCohortEligibility.skip_reason, "active_pilot_conflict")
console.log("  ✓ unrelated active pilot cohort membership still blocks enrollment bridge")

const autoEnrollmentSource = fs.readFileSync(
  path.join(ROOT, "lib/growth/apollo/apollo-enrollment-auto-enrollment.ts"),
  "utf8",
)
assert.doesNotMatch(autoEnrollmentSource, /existing_status:\s*"enrollment_approved"/)
assert.match(autoEnrollmentSource, /active_enrollment_exists:growth_lead_id=/)
console.log("  ✓ enrollment automation only blocks growth_lead re-enrollment on active sequence enrollment")

const recoveredQualificationContext = mergeApolloIntelligenceRecoveryQualificationContext({
  engine: {
    qa_marker: "growth-prospect-search-engine-intelligence-v1",
    source_type: "external_discovered",
    source_id: "company-recovered",
    growth_lead_id: null,
    company_name: "Recovered Co",
    canonical_company_id: "canonical-recovered",
    has_canonical_company: true,
    company_intelligence: {
      has_verified_intelligence: true,
      snapshot_count: 2,
      categories_present: ["operations"],
      discovery_status: "verified",
      snapshots: [
        {
          intelligence_category: "operations",
          intelligence_key: "fleet",
          value_text: "verified ops",
          confidence: 0.9,
          verification_status: "verified",
        },
      ],
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
  },
})
const recoveredContact = buildFixtureContact(88, "Recovered Co")
const recoveredSnapshotSummary = {
  mapped_contacts: 3,
  verified_email_contacts: 3,
  contactable_contacts: 3,
  sequence_ready_contacts: 3,
}
const recoveryScoreRow = buildApolloIntelligenceRecoveryScoreDecompositionRow({
  company_candidate_id: "company-recovered",
  company_name: "Recovered Co",
  contacts: [recoveredContact],
  snapshot_summary: recoveredSnapshotSummary,
  qualificationContext: recoveredQualificationContext,
  production_threshold: 70,
})
const pilotRecoveredInput = applyApolloQualificationScoringContextToSelectionInput(
  {
    company_candidate_id: "company-recovered",
    company_name: "Recovered Co",
    domain: "recovered.example.com",
    contacts: [recoveredContact],
    snapshot_summary: recoveredSnapshotSummary,
    enrollment_status: null,
    has_active_sequence_enrollment: false,
    in_active_pilot_cohort: false,
    canonical_company_id: "canonical-recovered",
  },
  recoveredQualificationContext,
)
const pilotRecoveredAnalysis = analyzeApollo25CompanyPilotCompanyEligibility(
  pilotRecoveredInput,
  70,
  "greenfield",
)
const enrollmentRecoveredQualification = evaluateApolloEnrollmentQualification(
  buildApolloEnrollmentQualificationInputFromScoringContext({
    snapshot_summary: recoveredSnapshotSummary,
    contact: recoveredContact,
    context: recoveredQualificationContext,
    verified_email_source: "apollo_search_verified_email",
    enrichment_source: "apollo_enrollment_cert",
  }),
  { threshold: 70 },
)
assert.equal(recoveryScoreRow.current_score, 100)
assert.equal(pilotRecoveredAnalysis.score, 100)
assert.equal(enrollmentRecoveredQualification.qualification_score, 100)
console.log("  ✓ recovery, pilot, and enrollment qualification scores align for recovered companies")

assert.equal(describeEnrollmentDuplicatePreventionDecision({ candidates_created: 1, candidates: [{ candidate_id: "c1" }] }), "created_new_candidate")
assert.equal(
  describeEnrollmentDuplicatePreventionDecision({
    candidates_created: 0,
    candidates: [{ candidate_id: "c1" }],
    candidates_skipped_duplicate: 0,
  }),
  "reused_existing_candidate",
)
assert.equal(
  describeEnrollmentDuplicatePreventionDecision({
    candidates_created: 0,
    candidates: [],
    candidates_skipped_duplicate: 1,
  }),
  "reused_pending_duplicate",
)
console.log("  ✓ enrollment duplicate prevention decisions classify reuse vs create")

const enrolledFixtureCompanies = fixtureCompanies.slice(0, 11).map((company, index) => ({
  ...company,
  enrollment_status: "enrollment_approved" as const,
  growth_lead_id: `lead-${index + 1}`,
  company_candidate_id: `enrolled-company-${index + 1}`,
  canonical_company_id: `canonical-${index + 1}`,
}))
const enrolledEnrollmentReadiness = evaluateApollo25CompanyPilotCohortEnrollmentReadiness({
  snapshot_companies: enrolledFixtureCompanies.map((company, index) => ({
    company_candidate_id: company.company_candidate_id,
    company_name: company.company_name,
    qualification_score: 80,
    verified_email_count: 1,
    sequence_ready_count: 1,
    canonical_company_id: company.canonical_company_id,
    enrollment_status: "enrollment_approved",
    cohort_rank: index + 1,
    cohort_reason: "production_rules_passed",
    ranking_explanation: "fixture",
  })),
  selection_inputs: enrolledFixtureCompanies,
  production_threshold: 70,
  cohort_id: "fixture-cohort-id",
  readiness_mode: "persisted_cohort_review",
})
assert.equal(enrolledEnrollmentReadiness.readiness_mode, "persisted_cohort_review")
assert.equal(enrolledEnrollmentReadiness.readiness_pct, 100)
assert.equal(enrolledEnrollmentReadiness.companies_ready, 11)
console.log("  ✓ enrollment readiness passes after approved enrollments (materialization prerequisite)")

const persistedCohortFixtureCompanies = readinessFixtureCompanies.slice(0, 11).map((company) => ({
  ...company,
  in_active_pilot_cohort: true,
}))
const persistedCohortSnapshotCompanies = persistedCohortFixtureCompanies.map((company, index) => ({
  company_candidate_id: company.company_candidate_id,
  company_name: company.company_name,
  qualification_score: 100,
  verified_email_count: company.snapshot_summary.verified_email_contacts,
  sequence_ready_count: company.snapshot_summary.sequence_ready_contacts,
  canonical_company_id: company.canonical_company_id,
  enrollment_status: null,
  cohort_rank: index + 1,
  cohort_reason: "production_rules_passed",
  ranking_explanation: "immutable snapshot fixture",
}))
const persistedCohortEnrollmentReadiness = evaluateApollo25CompanyPilotCohortEnrollmentReadiness({
  snapshot_companies: persistedCohortSnapshotCompanies,
  selection_inputs: persistedCohortFixtureCompanies,
  production_threshold: 70,
  cohort_id: "persisted-draft-cohort",
  readiness_mode: "persisted_cohort_review",
})
assert.equal(persistedCohortEnrollmentReadiness.readiness_mode, "persisted_cohort_review")
assert.equal(persistedCohortEnrollmentReadiness.companies_evaluated, 11)
assert.ok(
  persistedCohortEnrollmentReadiness.companies.every(
    (row) => row.checks.qualification_gte_threshold && row.checks.no_active_enrollment_conflict,
  ),
)
console.log("  ✓ persisted cohort members pass snapshot-anchored qualification with self-cohort exemption")

const otherCohortConflictReadiness = evaluateApollo25CompanyPilotCohortEnrollmentReadiness({
  snapshot_companies: persistedCohortSnapshotCompanies.slice(0, 1),
  selection_inputs: persistedCohortFixtureCompanies.slice(0, 1).map((company) => ({
    ...company,
    in_active_pilot_cohort: true,
  })),
  production_threshold: 70,
  cohort_id: "persisted-draft-cohort",
  readiness_mode: "persisted_cohort_review",
  company_ids_in_other_active_pilot_cohorts: [persistedCohortFixtureCompanies[0]!.company_candidate_id],
})
assert.equal(otherCohortConflictReadiness.companies[0]?.checks.no_active_enrollment_conflict, false)
assert.ok(
  otherCohortConflictReadiness.companies[0]?.blockers.includes("no_active_enrollment_conflict"),
)
console.log("  ✓ membership in another active pilot cohort still blocks readiness")

const previewActivePilotReadiness = evaluateApollo25CompanyPilotCohortEnrollmentReadiness({
  snapshot_companies: persistedCohortSnapshotCompanies.slice(0, 1),
  selection_inputs: persistedCohortFixtureCompanies.slice(0, 1).map((company) => ({
    ...company,
    in_active_pilot_cohort: true,
  })),
  production_threshold: 70,
  readiness_mode: "preview_selection",
})
assert.equal(previewActivePilotReadiness.readiness_mode, "preview_selection")
assert.equal(previewActivePilotReadiness.companies[0]?.checks.no_active_enrollment_conflict, false)
console.log("  ✓ preview selection still blocks active pilot conflicts")

const enrollRouteSource = fs.readFileSync(
  path.join(ROOT, "app/api/platform/growth/apollo-25-company-pilot/cohort/enroll/route.ts"),
  "utf8",
)
assert.match(enrollRouteSource, /enrollApollo25CompanyPilotCohortEnrollmentBridge/)
assert.match(enrollRouteSource, /ok: report\.ok/)
assert.match(enrollRouteSource, /status: report\.ok \? 200 : 422/)
assert.doesNotMatch(enrollRouteSource, /runSequenceExecutionJob/)
console.log("  ✓ cohort enroll route returns strict ok status without sequence execution sends")

console.log("\nApollo 25-Company Pilot Launch Certification PASSED")
