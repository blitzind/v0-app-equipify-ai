/**
 * Apollo-Primary-5 enrollment confirmation certification — CI structure + evidence helpers.
 * Run: pnpm test:apollo-primary-contact-acquisition-5
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  APOLLO_PRIMARY_5_QA_MARKER,
  type ApolloPrimary5CertificationReport,
} from "../lib/growth/apollo/apollo-primary-contact-enrollment-confirmation-certification-types"
import { buildApolloEnrollmentSourceAttributionChain } from "../lib/growth/apollo/apollo-primary-contact-enrollment-draft-evidence"
import { APOLLO_PRIMARY_CONTACT_ENROLLMENT_SOURCE_ATTRIBUTION } from "../lib/growth/apollo/apollo-primary-contact-enrollment-draft-types"

const CONFIRM_ROUTE =
  "app/api/platform/growth/leads/[leadId]/sequence-enrollments/[enrollmentId]/confirm/route.ts"
const ORCHESTRATOR_PATH = "lib/growth/sequence-enrollment/sequence-enrollment-orchestrator.ts"
const CERT_TYPES_PATH = "lib/growth/apollo/apollo-primary-contact-enrollment-confirmation-certification-types.ts"
const PRODUCTION_RUNNER = "scripts/certify-apollo-primary-contact-acquisition-5-production.ts"
const CRM_DRAWER_TEST = "scripts/test-growth-crm-lead-drawer-apollo-draft.ts"

const HENRY_SCHEIN_LOOKUP_KEY = "d2e669d5-e912-4fb7-992a-b4f9a92ff56a"
const HENRY_SCHEIN_GROWTH_LEAD_ID = "7bf7a767-ef0f-4441-af6e-d0f3ffa81d56"
const HENRY_SCHEIN_ENROLLMENT_DRAFT_ID = "d5fa5558-08ff-4504-ab55-a925e26e6c29"

for (const relativePath of [CONFIRM_ROUTE, ORCHESTRATOR_PATH, CERT_TYPES_PATH, PRODUCTION_RUNNER, CRM_DRAWER_TEST]) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

const confirmRoute = fs.readFileSync(path.join(process.cwd(), CONFIRM_ROUTE), "utf8")
const orchestrator = fs.readFileSync(path.join(process.cwd(), ORCHESTRATOR_PATH), "utf8")
const certSource = fs.readFileSync(path.join(process.cwd(), "lib/growth/apollo/apollo-primary-contact-enrollment-confirmation-certification.ts"), "utf8")
const productionRunner = fs.readFileSync(path.join(process.cwd(), PRODUCTION_RUNNER), "utf8")

assert.match(confirmRoute, /confirmGrowthSequenceEnrollment/)
assert.match(confirmRoute, /requireGrowthEnginePlatformAccess/)
console.log("  ✓ confirm route — platform admin + confirmGrowthSequenceEnrollment")

assert.match(orchestrator, /export async function confirmGrowthSequenceEnrollment/)
assert.match(orchestrator, /runSequenceEnrollmentPreflight/)
assert.match(orchestrator, /status: "active"/)
assert.match(orchestrator, /materializeGrowthSequenceEnrollmentStep/)
console.log("  ✓ orchestrator — preflight, activate, materialize step 1")

assert.match(certSource, /export async function certifyApolloPrimaryContactEnrollmentConfirmation/)
assert.match(certSource, /APOLLO_PRIMARY_5_QA_MARKER/)
assert.match(certSource, /confirmGrowthSequenceEnrollment/)
assert.doesNotMatch(certSource, /runSequenceScheduler|runSequenceExecutionJob/)
console.log("  ✓ certification module — confirm path without scheduler/execution runner")

assert.match(productionRunner, new RegExp(HENRY_SCHEIN_LOOKUP_KEY))
assert.match(productionRunner, new RegExp(HENRY_SCHEIN_GROWTH_LEAD_ID))
assert.match(productionRunner, new RegExp(HENRY_SCHEIN_ENROLLMENT_DRAFT_ID))
assert.match(productionRunner, /GROWTH_APOLLO_PRIMARY_5_CONFIRM_ENABLED/)
console.log("  ✓ production runner — Henry Schein fixtures + confirm gate")

const attribution = buildApolloEnrollmentSourceAttributionChain()
assert.deepEqual(attribution, [...APOLLO_PRIMARY_CONTACT_ENROLLMENT_SOURCE_ATTRIBUTION])
assert.deepEqual(attribution, ["Apollo", "Operator Approved", "Enrollment Queue", "Draft"])
console.log("  ✓ attribution chain — Apollo through Draft preserved")

function sampleReport(status: "draft" | "active"): ApolloPrimary5CertificationReport {
  return {
    qa_marker: APOLLO_PRIMARY_5_QA_MARKER,
    certification: status === "active" ? "PASS" : "PASS_PARTIAL",
    blockers: status === "draft" ? ["confirm_not_executed"] : [],
    draft_verification: {
      draft_exists: true,
      draft_status: status,
      enrollment_status_before_confirm: status,
      pattern_attached: true,
      sequence_recommendation_attached: true,
      lead_ownership_valid: true,
      preflight_passed: true,
      preflight_code: null,
      suppression_blocked: false,
      active_enrollment_conflict: false,
      fatigue_blocked: false,
      blockers: [],
    },
    enrollment_confirmation: {
      lead_id: HENRY_SCHEIN_GROWTH_LEAD_ID,
      draft_id: HENRY_SCHEIN_ENROLLMENT_DRAFT_ID,
      enrollment_id: HENRY_SCHEIN_ENROLLMENT_DRAFT_ID,
      sequence_pattern_id: "pattern-1",
      pattern_id: "pattern-1",
      pattern_key: "email_then_call",
      enrollment_status: status,
      step_count: 3,
      approval_state: status === "active" ? "draft_created_awaiting_approval" : "unknown",
      confirmation_executed: status === "active",
      confirmation_skipped_reason: status === "draft" ? "confirm_disabled" : null,
    },
    sequence_generation: {
      step_count: 3,
      step_orders: [1, 2, 3],
      channels: ["email", "call", "email"],
      step_statuses: ["draft_created", "pending", "pending"],
      orphaned_steps: 0,
      missing_channels: [],
      invalid_ordering: false,
    },
    execution_readiness: {
      visible_in_execution_dashboard: status === "active",
      visible_in_scheduler: status === "active",
      execution_jobs_for_enrollment: status === "active" ? 1 : 0,
      pending_approval_jobs: status === "active" ? 1 : 0,
      execution_blockers: [],
      approval_requirements: status === "active" ? ["step_1:email:draft_created"] : [],
    },
    apollo_attribution: {
      source_chain: [...attribution, "Enrollment Confirmed"],
      queue_status: "enrollment_approved",
      draft_audit_status: "draft_created",
      draft_source_attribution: attribution,
      queue_metadata_attribution: attribution,
      timeline_events: ["sequence_enrollment_created"],
      lead_active_enrollment_id: status === "active" ? HENRY_SCHEIN_ENROLLMENT_DRAFT_ID : null,
    },
    safety: {
      auto_enrollment: false,
      outreach_sent: false,
      apollo_draft_auto_enrollment: false,
      apollo_draft_outreach_sent: false,
      outreach_queue_sent_count: 0,
      execution_jobs_sent_count: 0,
      scheduler_runs_triggered: false,
    },
  }
}

const activeSample = sampleReport("active")
assert.equal(activeSample.certification, "PASS")
assert.equal(activeSample.safety.auto_enrollment, false)
assert.equal(activeSample.safety.outreach_sent, false)
console.log("  ✓ evidence shape — active enrollment PASS sample")

console.log("\nApollo-Primary-5 enrollment confirmation certification structure passed.")
