/**
 * Apollo Enrollment Automation certification — regression checks without live DB/Apollo HTTP in CI.
 * Run: pnpm test:apollo-enrollment-automation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  APOLLO_ENROLLMENT_AUTOMATION_EXECUTE_CONFIRM,
  APOLLO_ENROLLMENT_AUTOMATION_ROUTE_QA_MARKER,
  APOLLO_ENROLLMENT_CERTIFICATION_EXECUTE_CONFIRM,
  assertApolloEnrollmentAutomationExecuteAllowed,
  buildApolloEnrollmentAutomationReadinessPayload,
  validateApolloEnrollmentAutomationConfirmation,
} from "../lib/growth/apollo/apollo-enrollment-automation-route-gates"
import {
  APOLLO_ENROLLMENT_AUTOMATION_ID,
  APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER,
} from "../lib/growth/apollo/apollo-enrollment-automation-types"
import {
  assertApolloEnrollmentAttributionPreserved,
  buildApolloEnrollmentAttributionRecord,
  evaluateApolloEnrollmentApprovalGate,
  evaluateApolloEnrollmentReEnrollmentBlock,
} from "../lib/growth/apollo/apollo-enrollment-automation-evidence"
import {
  APOLLO_ENROLLMENT_DEFAULT_QUALIFICATION_THRESHOLD,
  APOLLO_ENROLLMENT_QUALIFICATION_ENGINE_QA_MARKER,
  evaluateApolloEnrollmentQualification,
  resolveApolloEnrollmentQualificationThreshold,
} from "../lib/growth/apollo/apollo-enrollment-qualification-engine"
import { buildApolloEnrollmentOperatorIntelligence } from "../lib/growth/apollo/apollo-enrollment-operator-intelligence"
import type { ApolloPrimaryContactOperatorReviewRow } from "../lib/growth/apollo/apollo-primary-contact-operator-review-types"
import { assertApolloEnrichmentCertProductionResponseHasNoSecrets } from "../lib/growth/apollo/apollo-enrichment-cert-production-route-gates"

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-enrollment-automation-types.ts",
  "lib/growth/apollo/apollo-enrollment-qualification-engine.ts",
  "lib/growth/apollo/apollo-enrollment-automation-evidence.ts",
  "lib/growth/apollo/apollo-enrollment-operator-intelligence.ts",
  "lib/growth/apollo/apollo-enrollment-auto-enrollment.ts",
  "lib/growth/apollo/apollo-enrollment-candidate-queue.ts",
  "lib/growth/apollo/apollo-enrollment-funnel-metrics.ts",
  "lib/growth/apollo/apollo-enrollment-automation-route-gates.ts",
  "lib/growth/apollo/apollo-enrollment-automation-route.ts",
  "lib/growth/apollo/apollo-enrollment-certification.ts",
  "app/api/platform/growth/apollo-enrollment-automation/readiness/route.ts",
  "app/api/platform/growth/apollo-enrollment-automation/execute/route.ts",
  "app/api/platform/growth/apollo-enrollment-automation/enrollment-queue/route.ts",
  "app/api/platform/growth/apollo-enrollment-automation/enrollment-queue/actions/route.ts",
  "app/api/platform/growth/apollo-enrollment-automation/funnel-metrics/route.ts",
  "components/growth/apollo-enrollment-automation-panel.tsx",
  "supabase/migrations/20270813120000_growth_engine_apollo_enrollment_automation.sql",
]

const FORBIDDEN_SIDE_EFFECT_IMPORTS = [
  "createGrowthSequenceEnrollmentDraft",
  "confirmGrowthSequenceEnrollment",
  "bulkEnrollLeadsInGrowthSequence",
  "enrollLeadInSequence",
  "queueSequenceStepTransportJob",
  "runSequenceExecutionJob",
  "insertGrowthOutreachQueueItem",
  "sendEmail",
  "sendSms",
  "voice-drop",
  "executeSequence",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

assert.equal(APOLLO_ENROLLMENT_AUTOMATION_QA_MARKER, "apollo-enrollment-automation-v1")
assert.equal(APOLLO_ENROLLMENT_AUTOMATION_ID, "apollo-enrollment-automation-v1")
assert.equal(APOLLO_ENROLLMENT_AUTOMATION_ROUTE_QA_MARKER, "apollo-enrollment-automation-route-v1")
assert.equal(
  APOLLO_ENROLLMENT_QUALIFICATION_ENGINE_QA_MARKER,
  "apollo-enrollment-qualification-engine-v1",
)
console.log("  ✓ enrollment automation QA markers")

const confirmReject = validateApolloEnrollmentAutomationConfirmation({
  confirm: "WRONG_CONFIRM",
  companyCandidateId: "company-1",
})
assert.equal(confirmReject.ok, false)
console.log("  ✓ invalid confirmation rejected")

const confirmOk = validateApolloEnrollmentAutomationConfirmation({
  confirm: APOLLO_ENROLLMENT_AUTOMATION_EXECUTE_CONFIRM,
  companyCandidateId: "company-1",
})
assert.equal(confirmOk.ok, true)
assert.equal(confirmOk.company_candidate_id, "company-1")
assert.equal(confirmOk.certification_mode, false)
console.log("  ✓ automation execute confirmation")

const certConfirm = validateApolloEnrollmentAutomationConfirmation({
  confirm: APOLLO_ENROLLMENT_CERTIFICATION_EXECUTE_CONFIRM,
  company_candidate_id: "company-1",
})
assert.equal(certConfirm.ok, true)
assert.equal(certConfirm.certification_mode, true)
console.log("  ✓ certification execute confirmation")

const readiness = buildApolloEnrollmentAutomationReadinessPayload({
  company_candidate_id: "company-1",
  env: {
    ...process.env,
    GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ENABLED: "true",
    GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ACK: "1",
    VERCEL_ENV: "production",
  },
})
assert.equal(readiness.auto_enrollment, false)
assert.equal(readiness.outreach_sent, false)
assert.equal(readiness.draft_creation_allowed, false)
assertApolloEnrichmentCertProductionResponseHasNoSecrets(readiness)
console.log("  ✓ readiness payload safety flags + secret redaction")

const attribution = buildApolloEnrollmentAttributionRecord({
  apollo_search_tier: "A",
  verified_email_source: "apollo_search_verified_email",
  enrichment_source: "apollo_enrichment_cert",
})
assert.equal(assertApolloEnrollmentAttributionPreserved(attribution), true)
assert.deepEqual(attribution.attribution_chain, [
  "Apollo",
  "Enrichment",
  "Promotion",
  "Qualification",
  "Enrollment",
])
console.log("  ✓ attribution chain preserved")

const qualified = evaluateApolloEnrollmentQualification(
  {
    mapped_contacts: 3,
    verified_email_contacts: 2,
    contactable_contacts: 2,
    sequence_ready_contacts: 1,
    company_intelligence_present: true,
    buying_committee_present: true,
    buying_committee_coverage: 0.6,
    fit_score: 82,
    research_score: 75,
    contact_sequence_ready: true,
    contact_contactable: true,
    contact_blockers: [],
    apollo_search_tier: "A",
    verified_email_source: "apollo_search_verified_email",
    enrichment_source: "apollo_enrichment_cert",
  },
  { threshold: APOLLO_ENROLLMENT_DEFAULT_QUALIFICATION_THRESHOLD },
)
assert.equal(qualified.qualified_for_enrollment, true)
assert.ok(qualified.qualification_score >= APOLLO_ENROLLMENT_DEFAULT_QUALIFICATION_THRESHOLD)
console.log("  ✓ qualification scoring passes threshold")

const blocked = evaluateApolloEnrollmentQualification({
  mapped_contacts: 1,
  verified_email_contacts: 0,
  contactable_contacts: 0,
  sequence_ready_contacts: 0,
  company_intelligence_present: false,
  buying_committee_present: false,
  buying_committee_coverage: null,
  fit_score: null,
  research_score: null,
  contact_sequence_ready: false,
  contact_contactable: false,
  contact_blockers: ["missing_canonical_person_id"],
  apollo_search_tier: null,
  verified_email_source: null,
  enrichment_source: null,
})
assert.equal(blocked.qualified_for_enrollment, false)
console.log("  ✓ non-sequence-ready contact blocked")

const sampleContact: ApolloPrimaryContactOperatorReviewRow = {
  row_id: "row-1",
  company_contact_id: "contact-1",
  contact_candidate_id: "candidate-1",
  canonical_person_id: "person-1",
  full_name: "Alex Rivera",
  title: "VP Operations",
  company_name: "Summit Medical",
  source: "Apollo",
  channel_availability: { email: true, linkedin: true, phone: false },
  enrichment_status: "channel_ready",
  contactable: true,
  sequence_ready: true,
  operator_review_status: "approved",
  outreach_ready: true,
  blockers: [],
  contact_status: "candidate",
  email_status: "verified",
  phone_status: null,
}

const intelligence = buildApolloEnrollmentOperatorIntelligence({
  contact: sampleContact,
  qualification: qualified,
  qualification_input: {
    mapped_contacts: 3,
    verified_email_contacts: 2,
    contactable_contacts: 2,
    sequence_ready_contacts: 1,
    company_intelligence_present: true,
    buying_committee_present: true,
    buying_committee_coverage: 0.6,
    fit_score: 82,
    research_score: 75,
    contact_sequence_ready: true,
    contact_contactable: true,
    contact_blockers: [],
    apollo_search_tier: "A",
    verified_email_source: "apollo_search_verified_email",
    enrichment_source: "apollo_enrichment_cert",
  },
})
assert.match(intelligence.why_selected, /Qualification score/)
assert.equal(intelligence.recommended_first_channel, "email")
assert.ok(intelligence.recommended_sequence)
console.log("  ✓ operator intelligence generated")

const approvalGate = evaluateApolloEnrollmentApprovalGate({
  candidate: {
    candidate_id: "c-1",
    company_candidate_id: "company-1",
    company_contact_id: "contact-1",
    contact_candidate_id: "candidate-1",
    growth_lead_id: "lead-1",
    prospect_id: null,
    status: "pending_enrollment_approval",
    company_name: "Summit Medical",
    full_name: "Alex Rivera",
    title: "VP Operations",
    email: "alex@example.com",
    phone: null,
    qualified_for_enrollment: true,
    qualification_reason: qualified.qualification_reason,
    qualification_score: qualified.qualification_score,
    fit_score: 82,
    research_score: 75,
    source_attribution: attribution,
    operator_intelligence: intelligence,
    acquisition_evidence: {},
    created_at: new Date().toISOString(),
    enrollment_approved_at: null,
    enrollment_approved_email: null,
  },
})
assert.equal(approvalGate.allowed, true)
console.log("  ✓ enrollment approval gate")

const reEnrollment = evaluateApolloEnrollmentReEnrollmentBlock({
  existing_status: "enrollment_approved",
  growth_lead_id: "lead-1",
  has_active_enrollment: true,
})
assert.equal(reEnrollment.blocked, true)
console.log("  ✓ re-enrollment prevention")

const serverSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-enrollment-auto-enrollment.ts"),
  "utf8",
)
const actionsRoute = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/platform/growth/apollo-enrollment-automation/enrollment-queue/actions/route.ts",
  ),
  "utf8",
)
const executeRoute = fs.readFileSync(
  path.join(process.cwd(), "app/api/platform/growth/apollo-enrollment-automation/execute/route.ts"),
  "utf8",
)

for (const forbidden of FORBIDDEN_SIDE_EFFECT_IMPORTS) {
  assert.doesNotMatch(serverSource, new RegExp(forbidden, "i"), `Auto-enrollment must not import ${forbidden}`)
  assert.doesNotMatch(actionsRoute, new RegExp(forbidden, "i"), `Actions route must not import ${forbidden}`)
  assert.doesNotMatch(executeRoute, new RegExp(forbidden, "i"), `Execute route must not import ${forbidden}`)
}
console.log("  ✓ no draft/outreach side-effect imports")

assert.match(serverSource, /auto_enrollment:\s*false/)
assert.match(serverSource, /outreach_sent:\s*false/)
assert.match(executeRoute, /draft_created:\s*false/)
console.log("  ✓ safety flags hard-coded")

const migrationSource = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20270813120000_growth_engine_apollo_enrollment_automation.sql",
  ),
  "utf8",
)
assert.match(migrationSource, /apollo_enrollment_candidates/)
assert.match(migrationSource, /auto_enrollment_attempted boolean not null default false/)
assert.match(migrationSource, /outreach_sent boolean not null default false/)
console.log("  ✓ migration safety defaults")

const panelSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/apollo-enrollment-automation-panel.tsx"),
  "utf8",
)
assert.match(panelSource, /Apollo Ready For Enrollment/)
assert.match(panelSource, /Approve Enrollment/)
assert.match(panelSource, /Re-run Research/)
assert.match(panelSource, /Apollo Funnel/)
console.log("  ✓ UI queue + funnel dashboard")

const threshold = resolveApolloEnrollmentQualificationThreshold({
  GROWTH_APOLLO_ENROLLMENT_QUALIFICATION_THRESHOLD: "75",
})
assert.equal(threshold, 75)
console.log("  ✓ configurable qualification threshold")

const gates = assertApolloEnrollmentAutomationExecuteAllowed({
  ...process.env,
  GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ENABLED: "false",
  GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ACK: "0",
})
assert.equal(gates.ok, false)
console.log("  ✓ production gates block when disabled")

console.log("\nApollo Enrollment Automation certification checks passed.")
