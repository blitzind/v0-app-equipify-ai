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
import {
  buildApolloFullPipelineMaterializationEvidence,
  evaluateApolloFullPipelineExecutionJobSafety,
  evaluateApolloFullPipelineStageSafety,
  resolveUnsupportedSequenceMaterializationBlockers,
  summarizeApolloFullPipelineSafetyViolations,
} from "../lib/growth/apollo/apollo-full-pipeline-materialization-evidence"
import { buildApolloSequenceExecutionHandoffInput } from "../lib/growth/apollo/apollo-sequence-execution-handoff-input"
import { buildSequenceExecutionPipelineFromMultichannelHandoff } from "../lib/growth/apollo/apollo-sequence-execution-pipeline-builder"
import {
  resolveApolloPipelineGrowthLeadIdFromChain,
  buildApolloPipelineGrowthLeadResolutionEvidence,
} from "../lib/growth/apollo/apollo-pipeline-growth-lead-resolution-evidence"
import {
  APOLLO_CERTIFICATION_PREFERRED_MATERIALIZABLE_SEQUENCE_KEYS,
  CERTIFICATION_MINIMAL_EMAIL_TEMPLATE,
  CERTIFICATION_MINIMAL_EMAIL_VOICE_DROP_TEMPLATE,
  buildApolloCertificationMultichannelTemplateOverrideEvidence,
  countMaterializableSequenceStepsFromChannelOrder,
  evaluateApolloCertificationTemplateSelection,
  inferApolloCertificationChannelAvailability,
  needsApolloCertificationMultichannelTemplateOverride,
  selectApolloCertificationMaterializableSequenceTemplate,
} from "../lib/growth/apollo/apollo-certification-multichannel-template-override"
import { buildApolloMultichannelSchedulingPlan } from "../lib/growth/apollo/apollo-multichannel-scheduling-layer"

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-full-pipeline-production-certification-types.ts",
  "lib/growth/apollo/apollo-full-pipeline-production-certification.ts",
  "lib/growth/apollo/apollo-full-pipeline-enrollment-resolution.ts",
  "lib/growth/apollo/apollo-full-pipeline-enrollment-resolution-evidence.ts",
  "lib/growth/apollo/apollo-full-pipeline-certification-actor.ts",
  "lib/growth/apollo/apollo-full-pipeline-db-error-evidence.ts",
  "lib/growth/apollo/apollo-full-pipeline-materialization-evidence.ts",
  "lib/growth/apollo/apollo-pipeline-growth-lead-resolution-evidence.ts",
  "lib/growth/apollo/apollo-pipeline-growth-lead-resolution.ts",
  "lib/growth/apollo/apollo-enrollment-growth-lead-resolution.ts",
  "lib/growth/apollo/apollo-certification-multichannel-template-override.ts",
  "lib/growth/apollo/apollo-certification-multichannel-template-override-bridge.ts",
  "lib/growth/apollo/apollo-sequence-execution-handoff-input.ts",
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

const multichannelQueueSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-multichannel-orchestration-queue.ts"),
  "utf8",
)
const bridgeSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-sequence-execution-bridge.ts"),
  "utf8",
)

assert.match(multichannelQueueSource, /handoffMultichannelApprovedToSequenceExecution/)
assert.match(multichannelQueueSource, /materializationEvidence/)
assert.match(multichannelQueueSource, /materialization_error/)
assert.match(multichannelQueueSource, /buildApolloSequenceExecutionHandoffInput/)
console.log("  ✓ multichannel approval captures sequence execution handoff evidence")

assert.match(bridgeSource, /normalizeGrowthActorUserIdForDb/)
assert.doesNotMatch(bridgeSource, /createdBy:\s*"apollo-sequence-execution-automation"/)
assert.match(bridgeSource, /resolveAndBackfillApolloPipelineGrowthLeadForSequenceExecution/)
assert.match(bridgeSource, /unsupported_template:custom_future|resolveUnsupportedSequenceMaterializationBlockers/)
assert.match(bridgeSource, /status:\s*"pending_approval"/)
console.log("  ✓ sequence execution bridge uses valid actor UUID and pending_approval jobs")

assert.match(certSource, /handoffMultichannelApprovedToSequenceExecution/)
assert.match(certSource, /materialization_evidence/)
assert.match(certSource, /resolveAndBackfillApolloPipelineGrowthLeadForSequenceExecution/)
assert.match(certSource, /applyApolloCertificationMultichannelTemplateOverride/)
assert.match(certSource, /sequence_ready_contact/)
assert.match(certSource, /enrollment\?\.email/)
assert.match(certSource, /certification_sequence_template_override_used|template_override/)
assert.match(certSource, /growth_lead_resolution/)
assert.match(certSource, /multichannel_sequence_candidate_id/)
assert.match(certSource, /materialization_reused/)
assert.match(certSource, /safety_violations/)
assert.match(certSource, /evaluateApolloFullPipelineStageSafety/)
console.log("  ✓ certification retries materialization and reports safety violations")

const fromEnrollment = resolveApolloPipelineGrowthLeadIdFromChain({
  enrollment_growth_lead_id: "lead-enrollment",
})
assert.equal(fromEnrollment.growth_lead_id, "lead-enrollment")
assert.equal(fromEnrollment.source, "enrollment_candidate")

const fromPlaybook = resolveApolloPipelineGrowthLeadIdFromChain({
  account_playbook_growth_lead_id: "lead-playbook",
})
assert.equal(fromPlaybook.source, "account_playbook")

const fromVoiceDrop = resolveApolloPipelineGrowthLeadIdFromChain({
  voice_drop_growth_lead_id: "lead-voice-drop",
})
assert.equal(fromVoiceDrop.source, "voice_drop_candidate")

const fromMultichannel = resolveApolloPipelineGrowthLeadIdFromChain({
  multichannel_growth_lead_id: "lead-multichannel",
})
assert.equal(fromMultichannel.source, "multichannel_candidate")

const fromMetadata = resolveApolloPipelineGrowthLeadIdFromChain({
  multichannel_metadata: { growth_lead_id: "lead-metadata" },
})
assert.equal(fromMetadata.source, "multichannel_metadata")

const fromCompanyContact = resolveApolloPipelineGrowthLeadIdFromChain({
  company_contact_growth_lead_id: "lead-company-contact",
})
assert.equal(fromCompanyContact.source, "company_contact")
console.log("  ✓ growth_lead_id chain resolver prefers enrollment then downstream fallbacks")

const growthLeadEvidence = buildApolloPipelineGrowthLeadResolutionEvidence({
  attempted: true,
  source: "created_for_sequence_execution",
  growth_lead_id_before: null,
  growth_lead_id_after: "lead-new",
  backfilled_rows: [
    "apollo_enrollment_candidates",
    "apollo_account_playbooks",
    "apollo_voice_drop_candidates",
    "apollo_multichannel_sequence_candidates",
  ],
  blockers: [],
})
assert.equal(growthLeadEvidence.growth_lead_id_after, "lead-new")
assert.equal(growthLeadEvidence.growth_lead_backfilled_rows.length, 4)
console.log("  ✓ growth lead backfill evidence includes source and backfilled rows")

const customFutureBlockers = resolveUnsupportedSequenceMaterializationBlockers({
  sequence_key: "custom_future",
  sequence_label: "Custom Future Sequence",
  scheduling_touches: [{ channel: "future_channel" }],
  materialized_step_count: 0,
})
assert.ok(customFutureBlockers.includes("unsupported_template:custom_future"))
console.log("  ✓ Custom Future Sequence returns explicit unsupported_template blocker")

assert.equal(
  needsApolloCertificationMultichannelTemplateOverride({
    sequence_key: "custom_future",
    scheduling_plan: buildApolloMultichannelSchedulingPlan({
      channel_order: ["future_channel"],
    }),
  }),
  true,
)

const emptyStoredAvailability = {
  verified_email: false,
  phone: false,
  mobile_phone: false,
  voice_drop_capable: false,
  sms_capable: false,
  linkedin: false,
}

const sequenceReadyOnlyAvailability = inferApolloCertificationChannelAvailability({
  stored: emptyStoredAvailability,
  sequence_ready_contact: true,
})
const sequenceReadySelection = evaluateApolloCertificationTemplateSelection({
  availability: sequenceReadyOnlyAvailability,
})
assert.equal(sequenceReadySelection.template?.sequence_key, CERTIFICATION_MINIMAL_EMAIL_TEMPLATE.sequence_key)
assert.equal(sequenceReadySelection.contact_email_present, true)
assert.ok(sequenceReadySelection.templates_considered.includes("email_voice_drop"))
assert.ok(sequenceReadySelection.template_rejection_reasons.length > 0)
console.log("  ✓ custom_future + sequence-ready contact => certification_minimal_email")

const emailOnlyAvailability = inferApolloCertificationChannelAvailability({
  stored: emptyStoredAvailability,
  email: "bryan@example.com",
})
const emailOnlySelection = evaluateApolloCertificationTemplateSelection({
  availability: emailOnlyAvailability,
})
assert.equal(emailOnlySelection.template?.sequence_key, CERTIFICATION_MINIMAL_EMAIL_TEMPLATE.sequence_key)
assert.equal(emailOnlySelection.fallback_template_used, true)
assert.ok(emailOnlySelection.available_channels.includes("email"))
console.log("  ✓ custom_future + verified email => certification_minimal_email")

const emailVoiceAvailability = inferApolloCertificationChannelAvailability({
  stored: emptyStoredAvailability,
  email: "bryan@example.com",
  phone: "+15551234567",
})
const emailVoiceSelection = evaluateApolloCertificationTemplateSelection({
  availability: emailVoiceAvailability,
})
assert.ok(
  emailVoiceSelection.template?.sequence_key === "email_voice_drop" ||
    emailVoiceSelection.template?.sequence_key ===
      CERTIFICATION_MINIMAL_EMAIL_VOICE_DROP_TEMPLATE.sequence_key,
)
assert.ok(countMaterializableSequenceStepsFromChannelOrder(emailVoiceSelection.template!.channel_order) > 0)
console.log("  ✓ custom_future + email + phone => email_voice_drop or certification_minimal_email_voice_drop")

const emailNoVoiceAvailability = inferApolloCertificationChannelAvailability({
  stored: {
    ...emptyStoredAvailability,
    voice_drop_capable: false,
  },
  email: "bryan@example.com",
  verified_email_contact: true,
})
const emailNoVoiceSelection = evaluateApolloCertificationTemplateSelection({
  availability: emailNoVoiceAvailability,
})
assert.equal(emailNoVoiceSelection.template?.sequence_key, CERTIFICATION_MINIMAL_EMAIL_TEMPLATE.sequence_key)
assert.equal(emailNoVoiceSelection.voice_drop_capable, false)
console.log("  ✓ no voice capability does not block email materialization")

const certAvailability = emailVoiceAvailability
const overrideTemplate = selectApolloCertificationMaterializableSequenceTemplate({
  availability: certAvailability,
  preferred_keys: APOLLO_CERTIFICATION_PREFERRED_MATERIALIZABLE_SEQUENCE_KEYS,
})
assert.ok(overrideTemplate)
assert.notEqual(overrideTemplate?.sequence_key, "custom_future")
assert.ok(countMaterializableSequenceStepsFromChannelOrder(overrideTemplate!.channel_order) > 0)

const overrideScheduling = buildApolloMultichannelSchedulingPlan({
  channel_order: overrideTemplate!.channel_order,
})
const templateOverrideEvidence = buildApolloCertificationMultichannelTemplateOverrideEvidence({
  override_used: true,
  original_sequence_key: "custom_future",
  materialized_sequence_key: overrideTemplate!.sequence_key,
  original_sequence_label: "Custom Future Sequence",
  materialized_sequence_label: overrideTemplate!.sequence_label,
  materializable_steps_before: 0,
  materializable_steps_after: overrideScheduling.touches.filter(
    (touch) => touch.channel !== "future_channel",
  ).length,
  selection: emailVoiceSelection,
})
assert.equal(templateOverrideEvidence.certification_sequence_template_override_used, true)
assert.equal(templateOverrideEvidence.original_sequence_key, "custom_future")
assert.ok(templateOverrideEvidence.materializable_steps_after > 0)
assert.ok(templateOverrideEvidence.templates_considered.length > 0)
assert.ok(templateOverrideEvidence.template_rejection_reasons.length > 0)
console.log("  ✓ certification overrides Custom Future Sequence to materializable template")

const supportedPipeline = buildSequenceExecutionPipelineFromMultichannelHandoff({
  multichannel_sequence_candidate_id: "mc-1",
  voice_drop_candidate_id: "vd-1",
  enrollment_candidate_id: "en-1",
  company_candidate_id: "co-1",
  company_contact_id: "cc-1",
  growth_lead_id: "lead-1",
  company_name: "Summit Medical",
  full_name: "Bryan Ginther",
  title: "Director",
  email: "bryan@example.com",
  phone: "+15551234567",
  qualification_score: 75,
  sequence_key: "email_voice_drop",
  sequence_label: "Email → Voice Drop",
  channel_order: ["email", "voice_drop"],
  scheduling_plan: {
    total_days: 3,
    touches: [
      { day_offset: 1, channel: "email", spacing_days_from_prior: 0, cadence_label: "async_inbox", reason: "Day 1" },
      { day_offset: 3, channel: "voice_drop", spacing_days_from_prior: 2, cadence_label: "mobile_voicemail", reason: "Day 3" },
    ],
  },
  source_attribution: { attribution_chain: ["Apollo", "Qualification", "Enrollment", "Voice Drop", "Multi-Channel"] },
})
assert.equal(supportedPipeline.materialization.total_steps, 2)
assert.equal(supportedPipeline.materialization.drafts.length, 2)
console.log("  ✓ supported multichannel sequence materializes steps and draft placeholders")

const draftCreatedRow = {
  outreach_sent: false,
  jobs_scheduled: false,
  voice_drop_sent: false,
  email_sent: false,
  sms_sent: false,
  call_placed: false,
  draft_created: true,
}
assert.deepEqual(evaluateApolloFullPipelineStageSafety(draftCreatedRow, "apollo_sequence_execution_candidates"), [])
console.log("  ✓ safety check allows draft_created=true on execution candidate")

const pendingApprovalJobs = evaluateApolloFullPipelineExecutionJobSafety({
  jobs: [{ status: "pending_approval" }, { status: "pending_approval" }],
})
assert.deepEqual(pendingApprovalJobs, [])
const scheduledJobViolation = evaluateApolloFullPipelineExecutionJobSafety({
  jobs: [{ status: "scheduled" }],
})
assert.equal(scheduledJobViolation.length, 1)
assert.equal(scheduledJobViolation[0]?.field, "jobs_scheduled")
console.log("  ✓ safety check allows pending_approval jobs and flags scheduled jobs")

const outreachViolation = evaluateApolloFullPipelineStageSafety(
  { outreach_sent: true, jobs_scheduled: false },
  "apollo_voice_drop_candidates",
)
assert.equal(outreachViolation.length, 1)
assert.equal(outreachViolation[0]?.stage, "apollo_voice_drop_candidates")
assert.equal(outreachViolation[0]?.field, "outreach_sent")
assert.match(
  summarizeApolloFullPipelineSafetyViolations(outreachViolation),
  /apollo_voice_drop_candidates\.outreach_sent=true/,
)
console.log("  ✓ safety check reports exact violating stage and field")

const materializationEvidence = buildApolloFullPipelineMaterializationEvidence({
  attempted: true,
  reused: true,
  handoff: {
    ok: true,
    action: "create_from_multichannel",
    candidate_id: "exec-1",
    candidate_ids: ["exec-1"],
    status: "pending_draft_approval",
    sequence_enrollment_id: "enroll-1",
    steps_created: 2,
    draft_placeholders_created: 2,
    pending_approval_jobs_created: 2,
    materialization_reused: true,
    outreach_sent: false,
    voice_drop_sent: false,
    email_sent: false,
    sms_sent: false,
    call_placed: false,
    draft_created: true,
    jobs_scheduled: false,
  },
  growth_lead_resolution: growthLeadEvidence,
  template_override: templateOverrideEvidence,
  multichannel: {
    candidate_id: "mc-1",
    voice_drop_candidate_id: "vd-1",
    enrollment_candidate_id: "en-1",
    company_candidate_id: "co-1",
    company_contact_id: "cc-1",
    growth_lead_id: "lead-1",
    status: "sequence_approved",
    company_name: "Summit Medical",
    full_name: "Bryan Ginther",
    title: "Director",
    email: "bryan@example.com",
    phone: "+15551234567",
    qualification_score: 75,
    fit_score: null,
    sequence_template: {
      sequence_key: "email_voice_drop",
      sequence_version: "v1",
      sequence_label: "Email → Voice Drop",
      channel_order: ["email", "voice_drop"],
      recommendation_reason: "test",
    },
    channel_availability: {
      verified_email: true,
      phone: true,
      sms_capable: false,
      voice_drop_capable: true,
    },
    orchestration_result: {
      channel_order: ["email", "voice_drop"],
      orchestration_confidence: 80,
      rationale: "test",
    },
    orchestration_confidence: 80,
    scheduling_plan: {
      total_days: 3,
      touches: [
        { day_offset: 1, channel: "email", spacing_days_from_prior: 0, cadence_label: "async_inbox", reason: "Day 1" },
        { day_offset: 3, channel: "voice_drop", spacing_days_from_prior: 2, cadence_label: "mobile_voicemail", reason: "Day 3" },
      ],
    },
    operator_summary: { headline: "test", detail: "test" },
    source_attribution: { attribution_chain: [] },
    created_at: new Date().toISOString(),
    sequence_approved_at: null,
    sequence_approved_by: null,
    sequence_approved_email: null,
  },
})
assert.equal(materializationEvidence.materialization_reused, true)
assert.equal(materializationEvidence.sequence_execution_candidate_id, "exec-1")
assert.equal(materializationEvidence.sequence_enrollment_id, "enroll-1")
assert.equal(materializationEvidence.steps_created, 2)
assert.equal(
  materializationEvidence.growth_lead_resolution_source,
  growthLeadEvidence.growth_lead_resolution_source,
)
assert.equal(materializationEvidence.certification_sequence_template_override_used, true)
assert.equal(materializationEvidence.original_sequence_key, "custom_future")
console.log("  ✓ existing materialization reuse evidence")

const multichannelFixture = {
  candidate_id: "mc-1",
  voice_drop_candidate_id: "vd-1",
  enrollment_candidate_id: "en-1",
  company_candidate_id: "co-1",
  company_contact_id: "cc-1",
  growth_lead_id: null,
  status: "sequence_approved" as const,
  company_name: "Summit Medical",
  full_name: "Bryan Ginther",
  title: "Director",
  email: "bryan@example.com",
  phone: "+15551234567",
  qualification_score: 75,
  fit_score: null,
  sequence_template: {
    sequence_key: "email_voice_drop",
    sequence_version: "v1",
    sequence_label: "Email → Voice Drop",
    channel_order: ["email", "voice_drop"] as const,
    recommendation_reason: "test",
  },
  channel_availability: {
    verified_email: true,
    phone: true,
    sms_capable: false,
    voice_drop_capable: true,
  },
  orchestration_result: {
    channel_order: ["email", "voice_drop"] as const,
    orchestration_confidence: 80,
    rationale: "test",
  },
  orchestration_confidence: 80,
  scheduling_plan: { total_days: 3, touches: [] },
  operator_summary: { headline: "test", detail: "test" },
  source_attribution: { attribution_chain: [] },
  created_at: new Date().toISOString(),
  sequence_approved_at: null,
  sequence_approved_by: null,
  sequence_approved_email: null,
}

const handoffInput = buildApolloSequenceExecutionHandoffInput({
  multichannel: multichannelFixture,
  growth_lead_id: "lead-from-enrollment",
})
assert.equal(handoffInput.growth_lead_id, "lead-from-enrollment")
console.log("  ✓ handoff input backfills growth_lead_id from enrollment")

console.log("\nApollo Full Pipeline Production Certification checks passed.")
