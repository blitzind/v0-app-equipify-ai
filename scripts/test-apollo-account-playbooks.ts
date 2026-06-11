/**
 * Apollo Account Playbooks (ABP-1) — regression checks without live outreach.
 * Run: pnpm test:apollo-account-playbooks
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  classifyCommitteeRoleFromTitle,
  runAccountPlaybookEngine,
  APOLLO_ACCOUNT_PLAYBOOK_ENGINE_QA_MARKER,
} from "../lib/growth/apollo/apollo-account-playbook-engine"
import {
  assertApolloAccountPlaybookAttributionPreserved,
  buildApolloAccountPlaybookAttributionRecord,
  evaluateApolloAccountPlaybookApprovalGate,
  evaluateApolloAccountPlaybookDuplicateBlock,
} from "../lib/growth/apollo/apollo-account-playbooks-evidence"
import {
  APOLLO_ACCOUNT_PLAYBOOKS_CERTIFICATION_EXECUTE_CONFIRM,
  APOLLO_ACCOUNT_PLAYBOOKS_EXECUTE_CONFIRM,
  APOLLO_ACCOUNT_PLAYBOOKS_ROUTE_QA_MARKER,
  assertApolloAccountPlaybooksExecuteAllowed,
  buildApolloAccountPlaybooksReadinessPayload,
  validateApolloAccountPlaybooksConfirmation,
} from "../lib/growth/apollo/apollo-account-playbooks-route-gates"
import {
  APOLLO_ACCOUNT_PLAYBOOKS_ID,
  APOLLO_ACCOUNT_PLAYBOOKS_MIGRATION,
  APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER,
  APOLLO_ACCOUNT_PLAYBOOK_SOURCE_ATTRIBUTION,
} from "../lib/growth/apollo/apollo-account-playbooks-types"
import { assertApolloEnrichmentCertProductionResponseHasNoSecrets } from "../lib/growth/apollo/apollo-enrichment-cert-production-route-gates"

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-account-playbooks-types.ts",
  "lib/growth/apollo/apollo-account-playbook-engine.ts",
  "lib/growth/apollo/apollo-account-playbooks-evidence.ts",
  "lib/growth/apollo/apollo-account-playbooks-bridge.ts",
  "lib/growth/apollo/apollo-account-playbooks-queue.ts",
  "lib/growth/apollo/apollo-account-playbooks-funnel-metrics.ts",
  "lib/growth/apollo/apollo-account-playbooks-certification.ts",
  "lib/growth/apollo/apollo-account-playbooks-route-gates.ts",
  "lib/growth/apollo/apollo-account-playbooks-route.ts",
  "app/api/platform/growth/apollo-account-playbooks/readiness/route.ts",
  "app/api/platform/growth/apollo-account-playbooks/execute/route.ts",
  "app/api/platform/growth/apollo-account-playbooks/playbook-queue/route.ts",
  "app/api/platform/growth/apollo-account-playbooks/playbook-queue/actions/route.ts",
  "app/api/platform/growth/apollo-account-playbooks/funnel-metrics/route.ts",
  `supabase/migrations/${APOLLO_ACCOUNT_PLAYBOOKS_MIGRATION}`,
]

const FORBIDDEN_SIDE_EFFECT_IMPORTS = [
  "queueSequenceStepTransportJob",
  "runSequenceExecutionJob",
  "sendEmail",
  "sendSms",
  "runSequenceVoiceDrop",
  "createGrowthSequenceEnrollmentDraft",
  "confirmGrowthSequenceEnrollment",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

assert.equal(APOLLO_ACCOUNT_PLAYBOOKS_QA_MARKER, "apollo-account-playbooks-abp-1-v1")
assert.equal(APOLLO_ACCOUNT_PLAYBOOKS_ID, "apollo-account-playbooks-abp-1-v1")
assert.equal(APOLLO_ACCOUNT_PLAYBOOKS_ROUTE_QA_MARKER, "apollo-account-playbooks-route-abp-1-v1")
assert.equal(APOLLO_ACCOUNT_PLAYBOOK_ENGINE_QA_MARKER, "apollo-account-playbook-engine-v1")
console.log("  ✓ account playbooks QA markers")

assert.deepEqual([...APOLLO_ACCOUNT_PLAYBOOK_SOURCE_ATTRIBUTION], [
  "Apollo",
  "Qualification",
  "Enrollment",
  "Account Playbook",
])
console.log("  ✓ attribution chain")

const confirmReject = validateApolloAccountPlaybooksConfirmation({ confirm: "WRONG" })
assert.equal(confirmReject.ok, false)
console.log("  ✓ invalid confirmation rejected")

const confirmOk = validateApolloAccountPlaybooksConfirmation({
  confirm: APOLLO_ACCOUNT_PLAYBOOKS_EXECUTE_CONFIRM,
  enrollmentCandidateId: "e-1",
})
assert.equal(confirmOk.ok, true)
assert.equal(confirmOk.enrollment_candidate_id, "e-1")
console.log("  ✓ execute confirmation")

const certConfirm = validateApolloAccountPlaybooksConfirmation({
  confirm: APOLLO_ACCOUNT_PLAYBOOKS_CERTIFICATION_EXECUTE_CONFIRM,
  enrollment_candidate_id: "e-1",
})
assert.equal(certConfirm.certification_mode, true)
console.log("  ✓ certification confirmation")

assert.equal(classifyCommitteeRoleFromTitle("CEO"), "Executive")
assert.equal(classifyCommitteeRoleFromTitle("Operations Manager"), "Operations")
assert.equal(classifyCommitteeRoleFromTitle("Service Manager"), "End User")
assert.equal(classifyCommitteeRoleFromTitle("Biomedical Engineer"), "Technical")
console.log("  ✓ role classification")

const engineResult = runAccountPlaybookEngine({
  canonical_company_id: "company-1",
  company_profile: { company_name: "Summit Medical" },
  buying_committee_members: [
    { full_name: "Jane CEO", title: "CEO", email: "ceo@example.com", contactable: true },
    { full_name: "Ops Lead", title: "Operations Manager", email: "ops@example.com" },
    { full_name: "Bio Eng", title: "Biomedical Engineer", email: "eng@example.com" },
  ],
  qualification_data: { qualification_score: 85, buying_committee_coverage: 0.7 },
  channel_availability: { email: true, phone: true, sms: true, linkedin: true, voice_drop: true },
})

assert.ok(engineResult.playbook_key.length > 0)
assert.ok(engineResult.committee_coverage_score > 0)
assert.ok(["Weak", "Partial", "Strong"].includes(engineResult.coverage_status))
assert.ok(engineResult.recommended_messaging_theme.Executive.includes("ROI"))
assert.equal(engineResult.recommended_channel_mix.Operations.join("+"), "Email+Call")
assert.equal(engineResult.recommended_channel_mix["End User"].join("+"), "SMS+Email")
assert.ok(engineResult.confidence_score > 0)
assert.ok(engineResult.reasoning.includes("Summit Medical"))
console.log("  ✓ account playbook engine")

const attribution = buildApolloAccountPlaybookAttributionRecord({
  apollo_source: "apollo_primary_contact",
  qualification_source: "apollo_enrollment_qualification_engine",
  enrollment_source: "apollo_enrollment_automation",
})
assert.equal(assertApolloAccountPlaybookAttributionPreserved(attribution), true)
console.log("  ✓ attribution preserved")

const duplicateBlock = evaluateApolloAccountPlaybookDuplicateBlock({
  existing_status: "pending_playbook_approval",
})
assert.equal(duplicateBlock.blocked, true)
console.log("  ✓ duplicate prevention")

const approvalGate = evaluateApolloAccountPlaybookApprovalGate({
  playbook: {
    playbook_id: "p-1",
    enrollment_candidate_id: "e-1",
    company_candidate_id: "c-1",
    canonical_company_id: "cc-1",
    company_contact_id: null,
    contact_candidate_id: null,
    growth_lead_id: null,
    status: "pending_playbook_approval",
    company_name: "Summit Medical",
    playbook_key: "balanced_committee_orchestration",
    committee_strategy: "Multi-threaded",
    recommended_roles: ["Executive", "Operations"],
    recommended_channels: ["Email", "Call"],
    committee_role_summary: [
      {
        full_name: "Jane CEO",
        title: "CEO",
        role_category: "Executive",
        recommended_messaging_theme: ["ROI"],
        recommended_channel_mix: ["Email", "LinkedIn"],
        contactable: true,
      },
    ],
    committee_coverage_score: 72,
    coverage_status: "Strong",
    recommended_messaging_theme: { Executive: ["ROI"] },
    recommended_channel_mix: { Executive: ["Email", "LinkedIn"] },
    confidence_score: 0.82,
    reasoning: "Test playbook.",
    source_attribution: attribution,
    created_at: new Date().toISOString(),
    playbook_approved_at: null,
    playbook_approved_email: null,
  },
})
assert.equal(approvalGate.allowed, true)
console.log("  ✓ playbook approval gate")

const readiness = buildApolloAccountPlaybooksReadinessPayload({
  env: {
    ...process.env,
    GROWTH_APOLLO_ACCOUNT_PLAYBOOKS_ENABLED: "true",
    GROWTH_APOLLO_ACCOUNT_PLAYBOOKS_ACK: "1",
  },
})
assert.equal(readiness.funnel_stage, "Account Playbook Ready")
assert.equal(readiness.safety.outreach_sent, false)
assertApolloEnrichmentCertProductionResponseHasNoSecrets(readiness)
console.log("  ✓ readiness payload")

const bridgeSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-account-playbooks-bridge.ts"),
  "utf8",
)
const queueSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-account-playbooks-queue.ts"),
  "utf8",
)
const enrollmentQueueSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-enrollment-candidate-queue.ts"),
  "utf8",
)
const certSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-account-playbooks-certification.ts"),
  "utf8",
)

for (const forbidden of FORBIDDEN_SIDE_EFFECT_IMPORTS) {
  assert.doesNotMatch(bridgeSource, new RegExp(forbidden, "i"), `Bridge must not import ${forbidden}`)
  assert.doesNotMatch(queueSource, new RegExp(forbidden, "i"), `Queue must not import ${forbidden}`)
  assert.doesNotMatch(certSource, new RegExp(forbidden, "i"), `Certification must not import ${forbidden}`)
}
console.log("  ✓ no outreach side-effect imports")

assert.match(enrollmentQueueSource, /handoffEnrollmentApprovedToAccountPlaybook/)
assert.match(queueSource, /handoffAccountPlaybookApprovedToVoiceDropPipeline/)
assert.match(queueSource, /approveApolloAccountPlaybook/)
assert.match(certSource, /runAccountPlaybookEngine/)
console.log("  ✓ funnel integration wired")

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), `supabase/migrations/${APOLLO_ACCOUNT_PLAYBOOKS_MIGRATION}`),
  "utf8",
)
assert.match(migrationSource, /account_playbooks/)
assert.match(migrationSource, /account_playbook_members/)
assert.match(migrationSource, /account_playbook_runs/)
assert.match(migrationSource, /outreach_sent boolean not null default false/)
console.log("  ✓ migration schema")

const gates = assertApolloAccountPlaybooksExecuteAllowed({
  ...process.env,
  GROWTH_APOLLO_ACCOUNT_PLAYBOOKS_ENABLED: "false",
  GROWTH_APOLLO_ACCOUNT_PLAYBOOKS_ACK: "0",
})
assert.equal(gates.ok, false)
console.log("  ✓ production gates block when disabled")

console.log("\nApollo Account Playbooks (ABP-1) certification checks passed.")
