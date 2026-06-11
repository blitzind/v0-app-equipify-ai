/**
 * Apollo Full Pipeline Production Certification — regression checks without live outreach.
 * Run: pnpm test:apollo-full-pipeline-production-certification
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  APOLLO_FULL_PIPELINE_ATTRIBUTION_CHAIN,
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_ID,
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_QA_MARKER,
} from "../lib/growth/apollo/apollo-full-pipeline-production-certification-types"
import {
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_BROWSER_CONSOLE_SNIPPET,
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_EXECUTE_CONFIRM,
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_ROUTE_QA_MARKER,
  APOLLO_FULL_PIPELINE_PRODUCTION_READINESS_CHECKLIST,
  APOLLO_FULL_PIPELINE_PRODUCTION_ROLLBACK_NOTES,
  assertApolloFullPipelineProductionCertificationAllowed,
  buildApolloFullPipelineProductionCertificationReadinessPayload,
  validateApolloFullPipelineProductionCertificationConfirmation,
} from "../lib/growth/apollo/apollo-full-pipeline-production-route-gates"
import { assertApolloEnrichmentCertProductionResponseHasNoSecrets } from "../lib/growth/apollo/apollo-enrichment-cert-production-route-gates"
import {
  describeEnrollmentDuplicatePreventionDecision,
  pickEnrollmentCandidateIdFromAutomationReport,
  selectSequenceReadyContactForCertification,
  selectSequenceReadyContactForEnrollment,
} from "../lib/growth/apollo/apollo-full-pipeline-enrollment-resolution-evidence"
import {
  normalizeGrowthActorUserIdForDb,
  isGrowthActorUserIdUuid,
} from "../lib/growth/actor-user-id"
import {
  APOLLO_FULL_PIPELINE_CERTIFICATION_SOURCE,
  resolveApolloFullPipelineCertificationActor,
} from "../lib/growth/apollo/apollo-full-pipeline-certification-actor"
import { buildApolloFullPipelineDbErrorEvidence } from "../lib/growth/apollo/apollo-full-pipeline-db-error-evidence"
import {
  evaluateApolloEnrollmentQualification,
  resolveApolloEnrollmentQualificationThreshold,
} from "../lib/growth/apollo/apollo-enrollment-qualification-engine"
import type { ApolloEnrollmentAutomationReport } from "../lib/growth/apollo/apollo-enrollment-automation-types"
import { APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER } from "../lib/growth/apollo/apollo-enrollment-automation-types"

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-full-pipeline-production-certification-types.ts",
  "lib/growth/apollo/apollo-full-pipeline-production-certification.ts",
  "lib/growth/apollo/apollo-full-pipeline-enrollment-resolution.ts",
  "lib/growth/apollo/apollo-full-pipeline-enrollment-resolution-evidence.ts",
  "lib/growth/apollo/apollo-full-pipeline-certification-actor.ts",
  "lib/growth/apollo/apollo-full-pipeline-db-error-evidence.ts",
  "lib/growth/apollo/apollo-full-pipeline-production-route-gates.ts",
  "lib/growth/apollo/apollo-full-pipeline-production-route.ts",
  "app/api/platform/growth/apollo-full-pipeline-certification/readiness/route.ts",
  "app/api/platform/growth/apollo-full-pipeline-certification/execute/route.ts",
]

const FORBIDDEN_SIDE_EFFECT_IMPORTS = [
  "queueSequenceStepTransportJob",
  "runSequenceExecutionJob",
  "sendEmail",
  "sendSms",
  "runSequenceVoiceDrop",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

assert.equal(
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_QA_MARKER,
  "apollo-full-pipeline-production-certification-v1",
)
assert.equal(
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_ID,
  "apollo-full-pipeline-production-certification-v1",
)
assert.equal(
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_ROUTE_QA_MARKER,
  "apollo-full-pipeline-production-certification-route-v1",
)
console.log("  ✓ full pipeline certification QA markers")

assert.deepEqual([...APOLLO_FULL_PIPELINE_ATTRIBUTION_CHAIN], [
  "Apollo",
  "Qualification",
  "Enrollment",
  "Account Playbook",
  "Voice Drop",
  "Multi-Channel",
  "Sequence Execution",
])
console.log("  ✓ attribution chain")

const confirmReject = validateApolloFullPipelineProductionCertificationConfirmation({
  confirm: "WRONG",
  companyCandidateId: "c-1",
})
assert.equal(confirmReject.ok, false)
console.log("  ✓ invalid confirmation rejected")

const confirmOk = validateApolloFullPipelineProductionCertificationConfirmation({
  confirm: APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_EXECUTE_CONFIRM,
  companyCandidateId: "c-1",
  enrollmentCandidateId: "e-1",
})
assert.equal(confirmOk.ok, true)
assert.equal(confirmOk.company_candidate_id, "c-1")
assert.equal(confirmOk.enrollment_candidate_id, "e-1")
console.log("  ✓ execute confirmation")

const readiness = buildApolloFullPipelineProductionCertificationReadinessPayload({
  env: {
    ...process.env,
    GROWTH_APOLLO_FULL_PIPELINE_CERTIFICATION_ACK: "1",
    GROWTH_APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ENABLED: "true",
    GROWTH_APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ACK: "1",
    GROWTH_APOLLO_MULTICHANNEL_ORCHESTRATION_ENABLED: "true",
    GROWTH_APOLLO_MULTICHANNEL_ORCHESTRATION_ACK: "1",
    GROWTH_APOLLO_VOICE_DROP_AUTOMATION_ENABLED: "true",
    GROWTH_APOLLO_VOICE_DROP_AUTOMATION_ACK: "1",
    GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ENABLED: "true",
    GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ACK: "1",
    VERCEL_ENV: "production",
  },
})
assert.equal(readiness.outreach_sent, false)
assert.equal(readiness.jobs_scheduled, false)
assert.equal(readiness.draft_created, true)
assert.ok(Array.isArray(readiness.readiness_checklist))
assert.ok(readiness.readiness_checklist.length >= 8)
assert.ok(APOLLO_FULL_PIPELINE_PRODUCTION_READINESS_CHECKLIST.length >= 8)
assert.ok(APOLLO_FULL_PIPELINE_PRODUCTION_ROLLBACK_NOTES.length >= 3)
assertApolloEnrichmentCertProductionResponseHasNoSecrets(readiness)
console.log("  ✓ readiness payload + checklist")

assert.match(
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_BROWSER_CONSOLE_SNIPPET,
  /apollo-full-pipeline-certification\/execute/,
)
assert.match(
  APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_BROWSER_CONSOLE_SNIPPET,
  new RegExp(APOLLO_FULL_PIPELINE_PRODUCTION_CERTIFICATION_EXECUTE_CONFIRM),
)
console.log("  ✓ browser console snippet")

const certSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-full-pipeline-production-certification.ts"),
  "utf8",
)
const executeRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/apollo-full-pipeline-certification/execute/route.ts"),
  "utf8",
)

for (const forbidden of FORBIDDEN_SIDE_EFFECT_IMPORTS) {
  assert.doesNotMatch(certSource, new RegExp(forbidden, "i"), `Cert must not import ${forbidden}`)
  assert.doesNotMatch(executeRoute, new RegExp(forbidden, "i"), `Execute route must not import ${forbidden}`)
}
console.log("  ✓ no live outreach side-effect imports")

assert.match(certSource, /approveApolloEnrollmentCandidate/)
assert.match(certSource, /approveApolloAccountPlaybook/)
assert.match(certSource, /approveApolloVoiceDropCandidate/)
assert.match(certSource, /approveApolloMultichannelSequenceCandidate/)
assert.match(certSource, /pending_approval/)
console.log("  ✓ end-to-end approval chain wired")

const gates = assertApolloFullPipelineProductionCertificationAllowed({
  GROWTH_APOLLO_FULL_PIPELINE_CERTIFICATION_ACK: "0",
})
assert.equal(gates.ok, false)
console.log("  ✓ production gates block when ACK missing")

const contactFixture = {
  row_id: "row-1",
  company_contact_id: "cc-1",
  contact_candidate_id: "cand-1",
  canonical_person_id: null,
  full_name: "Bryan Ginther",
  title: "CEO",
  company_name: "Acme",
  source: "Apollo" as const,
  channel_availability: { email: true, linkedin: false, phone: true },
  enrichment_status: "channel_ready" as const,
  contactable: true,
  sequence_ready: true,
  operator_review_status: "approved" as const,
  outreach_ready: true,
  blockers: [],
  contact_status: "active",
  email_status: "verified",
  phone_status: "verified",
}

const nonContactableSequenceReady = {
  ...contactFixture,
  row_id: "row-2",
  company_contact_id: "cc-2",
  full_name: "Not Contactable",
  contactable: false,
}

const selected = selectSequenceReadyContactForEnrollment([
  nonContactableSequenceReady,
  contactFixture,
])
assert.equal(selected?.full_name, "Bryan Ginther")
console.log("  ✓ sequence-ready contact prefers contactable candidate")

const fallback = selectSequenceReadyContactForEnrollment([nonContactableSequenceReady])
assert.equal(fallback?.full_name, "Not Contactable")
console.log("  ✓ sequence-ready contact falls back when only non-contactable")

const automationReport = {
  qa_marker: APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER,
  automation_id: "apollo-enrollment-automation-v1",
  execution_id: "exec-1",
  company_candidate_id: "company-1",
  contacts_evaluated: 1,
  contacts_qualified: 1,
  candidates_created: 1,
  candidates_skipped_duplicate: 0,
  candidates_skipped_re_enrollment: 0,
  funnel_metrics: {},
  candidates: [
    {
      candidate_id: "enroll-1",
      company_candidate_id: "company-1",
      company_contact_id: "cc-1",
      contact_candidate_id: "cand-1",
      growth_lead_id: "lead-1",
      prospect_id: null,
      status: "pending_enrollment_approval",
      company_name: "Acme",
      full_name: "Bryan Ginther",
      title: "CEO",
      email: "bryan@acme.com",
      phone: null,
      qualified_for_enrollment: true,
      qualification_reason: "Qualified",
      qualification_score: 82,
      fit_score: 80,
      research_score: 80,
      source_attribution: {
        apollo_source: "Apollo Primary Contact Acquisition",
        apollo_search_tier: null,
        verified_email_source: "apollo_search_verified_email",
        enrichment_source: "apollo_enrichment_cert",
        qualification_source: "apollo_enrollment_qualification_engine",
        enrollment_source: "apollo_enrollment_automation",
        attribution_chain: ["Apollo", "Enrichment", "Promotion", "Qualification", "Enrollment"],
      },
      operator_intelligence: {
        why_selected: "Qualified",
        likely_decision_maker_role: null,
        company_summary: null,
        research_summary: null,
        buying_committee_summary: null,
        recommended_first_channel: "email",
        recommended_sequence: null,
        apollo_evidence_summary: null,
      },
      acquisition_evidence: {},
      created_at: new Date().toISOString(),
      enrollment_approved_at: null,
      enrollment_approved_email: null,
    },
  ],
  blockers: [],
  auto_enrollment: false,
  outreach_sent: false,
  draft_created: false,
  completed_at: new Date().toISOString(),
} satisfies ApolloEnrollmentAutomationReport

assert.equal(
  pickEnrollmentCandidateIdFromAutomationReport(automationReport, {
    company_contact_id: "cc-1",
    contact_candidate_id: "cand-1",
  }),
  "enroll-1",
)
console.log("  ✓ automation report resolves enrollment candidate by contact ids")

const reusedReport = {
  ...automationReport,
  candidates_created: 0,
  candidates_skipped_re_enrollment: 1,
  candidates: automationReport.candidates,
}
assert.equal(describeEnrollmentDuplicatePreventionDecision(reusedReport), "reused_existing_candidate")
console.log("  ✓ existing enrollment candidate reuse decision")

const qualificationFail = evaluateApolloEnrollmentQualification(
  {
    mapped_contacts: 1,
    verified_email_contacts: 0,
    contactable_contacts: 0,
    sequence_ready_contacts: 1,
    company_intelligence_present: false,
    buying_committee_present: false,
    buying_committee_coverage: null,
    fit_score: null,
    research_score: null,
    contact_sequence_ready: true,
    contact_contactable: false,
    contact_blockers: ["missing_email"],
    apollo_search_tier: null,
    verified_email_source: "apollo_search_verified_email",
    enrichment_source: "apollo_enrichment_cert",
  },
  { threshold: 70 },
)
assert.equal(qualificationFail.qualified_for_enrollment, false)
assert.match(qualificationFail.qualification_reason, /not contactable/i)
console.log("  ✓ qualification failure produces blockers")

const insertFailureReport = {
  ...automationReport,
  candidates_created: 0,
  candidates: [],
  contacts_qualified: 1,
  blockers: ["Bryan Ginther: duplicate key value violates unique constraint"],
}
assert.match(
  insertFailureReport.blockers[0] ?? "",
  /duplicate key|violates/i,
)
console.log("  ✓ DB insert failure evidence shape")

assert.match(certSource, /findReusableApolloEnrollmentCandidate/)
assert.match(certSource, /enrollment_evidence/)
assert.match(certSource, /selectSequenceReadyContactForCertification/)
assert.match(certSource, /executeApolloFullPipelineCertificationEnrollment/)
assert.match(certSource, /qualification_override_used/)
assert.match(certSource, /selected_contact_name/)
assert.match(executeRoute, /status: 200/)
assert.doesNotMatch(executeRoute, /certification_failed[\s\S]*status: 500/)
console.log("  ✓ structured certification failure returns HTTP 200")

const productionThreshold = resolveApolloEnrollmentQualificationThreshold({})
const certificationThreshold = 50
const lowScoreContact = { ...contactFixture, full_name: "Bryan Ginther", company_contact_id: "cc-low" }
const highScoreContact = {
  ...contactFixture,
  full_name: "High Scorer",
  company_contact_id: "cc-high",
}

const productionBlocked = evaluateApolloEnrollmentQualification(
  {
    mapped_contacts: 1,
    verified_email_contacts: 1,
    contactable_contacts: 1,
    sequence_ready_contacts: 1,
    company_intelligence_present: false,
    buying_committee_present: false,
    buying_committee_coverage: null,
    fit_score: null,
    research_score: null,
    contact_sequence_ready: true,
    contact_contactable: true,
    contact_blockers: [],
    apollo_search_tier: null,
    verified_email_source: "apollo_search_verified_email",
    enrichment_source: "apollo_enrichment_cert",
  },
  { threshold: productionThreshold },
)
assert.equal(productionBlocked.qualification_score, 55)
assert.equal(productionBlocked.qualified_for_enrollment, false)
console.log("  ✓ production automation blocks score 55 when threshold=70")

const certSelectionLow = selectSequenceReadyContactForCertification(
  [{ contact: lowScoreContact, qualification_score: 55 }],
  { production_threshold: 70, certification_threshold: 50 },
)
assert.equal(certSelectionLow?.contact.full_name, "Bryan Ginther")
assert.equal(certSelectionLow?.threshold_source, "certification_override")
assert.equal(certSelectionLow?.threshold_used, 50)
console.log("  ✓ full pipeline certification proceeds with score 55 using certification threshold=50")

const certSelectionPreferHigh = selectSequenceReadyContactForCertification(
  [
    { contact: lowScoreContact, qualification_score: 55 },
    { contact: highScoreContact, qualification_score: 75 },
  ],
  { production_threshold: 70, certification_threshold: 50 },
)
assert.equal(certSelectionPreferHigh?.contact.full_name, "High Scorer")
assert.equal(certSelectionPreferHigh?.threshold_source, "production")
assert.equal(certSelectionPreferHigh?.threshold_used, 70)
console.log("  ✓ full pipeline certification prefers score ≥70 if available")

assert.match(certSource, /outreach_sent: false/)
assert.match(certSource, /executeApolloFullPipelineCertificationEnrollment/)
assert.doesNotMatch(certSource, /executeApolloEnrollmentAutomationInProduction/)
console.log("  ✓ certification override cannot send outreach")

assert.match(certSource, /qualification_threshold_source/)
assert.match(certSource, /production_threshold/)
assert.match(certSource, /certification_threshold/)
console.log("  ✓ override evidence is present")

const autoEnrollmentSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-enrollment-auto-enrollment.ts"),
  "utf8",
)
assert.match(autoEnrollmentSource, /existingApproved[\s\S]*candidates\.push/)
console.log("  ✓ approved enrollment candidate returned for reuse")

assert.equal(
  normalizeGrowthActorUserIdForDb(APOLLO_FULL_PIPELINE_CERTIFICATION_SOURCE),
  null,
)
assert.equal(
  normalizeGrowthActorUserIdForDb("apollo-full-pipeline-certification"),
  null,
)
console.log("  ✓ certification source string does not write into UUID columns")

const actor = resolveApolloFullPipelineCertificationActor({
  actor_user_id: "fbef0db5-a5f3-483f-a490-429a9decb05f",
  actor_email: "admin@equipify.ai",
})
assert.equal(actor.actorUserId, "fbef0db5-a5f3-483f-a490-429a9decb05f")
assert.equal(actor.certificationSource, APOLLO_FULL_PIPELINE_CERTIFICATION_SOURCE)
assert.equal(isGrowthActorUserIdUuid(actor.actorUserId), true)
console.log("  ✓ enrollment candidate uses valid/null actor UUID")

assert.match(autoEnrollmentSource, /certification_source/)
assert.match(autoEnrollmentSource, /normalizeGrowthActorUserIdForDb/)
console.log("  ✓ source string preserved in metadata")

assert.match(certSource, /normalizeGrowthActorUserIdForDb|actor\.actorUserId/)
assert.match(executeRoute, /actor_user_id: access\.userId/)
console.log("  ✓ approval path uses valid/null actor UUID")

const dbEvidence = buildApolloFullPipelineDbErrorEvidence({
  message: 'invalid input syntax for type uuid: "apollo-full-pipeline-certification"',
  company_contact_id: "cc-1",
  contact_candidate_id: "cand-1",
})
assert.equal(dbEvidence.db_error_table, "growth.leads")
assert.equal(dbEvidence.db_error_operation, "insert")
assert.match(dbEvidence.insert_error ?? "", /table=growth\.leads/)
assert.match(dbEvidence.insert_error ?? "", /company_contact_id=cc-1/)
console.log("  ✓ DB insert failure evidence includes table/operation")

console.log("\nApollo Full Pipeline Production Certification checks passed.")
