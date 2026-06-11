/**
 * Apollo Sequence Execution Automation certification — regression checks without live outreach.
 * Run: pnpm test:apollo-sequence-execution-automation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  APOLLO_SEQUENCE_EXECUTION_AUTOMATION_EXECUTE_CONFIRM,
  APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ROUTE_QA_MARKER,
  APOLLO_SEQUENCE_EXECUTION_CERTIFICATION_EXECUTE_CONFIRM,
  assertApolloSequenceExecutionAutomationExecuteAllowed,
  buildApolloSequenceExecutionAutomationReadinessPayload,
  validateApolloSequenceExecutionAutomationConfirmation,
} from "../lib/growth/apollo/apollo-sequence-execution-automation-route-gates"
import {
  APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ID,
  APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER,
} from "../lib/growth/apollo/apollo-sequence-execution-automation-types"
import {
  assertApolloSequenceExecutionAttributionPreserved,
  buildApolloSequenceExecutionAttributionRecord,
  evaluateApolloSequenceExecutionDraftApprovalGate,
  evaluateApolloSequenceExecutionDuplicateBlock,
} from "../lib/growth/apollo/apollo-sequence-execution-automation-evidence"
import {
  buildApolloSequenceExecutionDraftRecords,
} from "../lib/growth/apollo/apollo-sequence-draft-generation"
import {
  buildApolloSequenceExecutionMaterializationPlan,
} from "../lib/growth/apollo/apollo-sequence-materialization-engine"
import { buildSequenceExecutionPipelineFromMultichannelHandoff } from "../lib/growth/apollo/apollo-sequence-execution-pipeline-builder"
import {
  buildApolloSequenceExecutionStepPlans,
  mapOrchestrationChannelToSequenceChannel,
} from "../lib/growth/apollo/apollo-sequence-step-generation"
import { assertApolloEnrichmentCertProductionResponseHasNoSecrets } from "../lib/growth/apollo/apollo-enrichment-cert-production-route-gates"

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-sequence-execution-automation-types.ts",
  "lib/growth/apollo/apollo-sequence-step-generation.ts",
  "lib/growth/apollo/apollo-sequence-draft-generation.ts",
  "lib/growth/apollo/apollo-sequence-materialization-engine.ts",
  "lib/growth/apollo/apollo-sequence-execution-automation-evidence.ts",
  "lib/growth/apollo/apollo-sequence-execution-pipeline-builder.ts",
  "lib/growth/apollo/apollo-sequence-execution-bridge.ts",
  "lib/growth/apollo/apollo-sequence-execution-queue.ts",
  "lib/growth/apollo/apollo-sequence-execution-funnel-metrics.ts",
  "lib/growth/apollo/apollo-sequence-execution-certification.ts",
  "lib/growth/apollo/apollo-sequence-execution-automation-route-gates.ts",
  "lib/growth/apollo/apollo-sequence-execution-automation-route.ts",
  "app/api/platform/growth/apollo-sequence-execution-automation/readiness/route.ts",
  "app/api/platform/growth/apollo-sequence-execution-automation/execute/route.ts",
  "app/api/platform/growth/apollo-sequence-execution-automation/execution-queue/route.ts",
  "app/api/platform/growth/apollo-sequence-execution-automation/execution-queue/actions/route.ts",
  "app/api/platform/growth/apollo-sequence-execution-automation/funnel-metrics/route.ts",
  "components/growth/apollo-sequence-execution-automation-panel.tsx",
  "supabase/migrations/20270816120000_growth_engine_apollo_sequence_execution_automation.sql",
]

const FORBIDDEN_SIDE_EFFECT_IMPORTS = [
  "queueSequenceStepTransportJob",
  "runSequenceExecutionJob",
  "voice-drop-service",
  "twilio-voice-drop-provider",
  "sendEmail",
  "sendSms",
  "runSequenceVoiceDrop",
]

const SAMPLE_HANDOFF = {
  multichannel_sequence_candidate_id: "mc-1",
  voice_drop_candidate_id: "vd-1",
  enrollment_candidate_id: "e-1",
  company_candidate_id: "c-1",
  company_contact_id: "cc-1",
  growth_lead_id: "l-1",
  company_name: "Summit Medical",
  full_name: "Alex Rivera",
  title: "VP Operations",
  email: "alex@example.com",
  phone: "+15551234567",
  qualification_score: 85,
  sequence_key: "email_voice_sms",
  sequence_label: "Email → Voice Drop → SMS",
  channel_order: ["email", "voice_drop", "sms"] as const,
  scheduling_plan: {
    total_days: 5,
    touches: [
      { day_offset: 1, channel: "email" as const, spacing_days_from_prior: 0, cadence_label: "async_inbox", reason: "Day 1 email" },
      { day_offset: 3, channel: "voice_drop" as const, spacing_days_from_prior: 2, cadence_label: "mobile_voicemail", reason: "Day 3 voice drop" },
      { day_offset: 5, channel: "sms" as const, spacing_days_from_prior: 2, cadence_label: "mobile_text", reason: "Day 5 SMS" },
    ],
  },
  voice_drop_script_reference: "Hi Alex, this is a voice drop placeholder.",
  source_attribution: {
    attribution_chain: [
      "Apollo",
      "Qualification",
      "Enrollment",
      "Account Playbook",
      "Voice Drop",
      "Multi-Channel Sequence",
    ],
  },
}

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

assert.equal(APOLLO_SEQUENCE_EXECUTION_AUTOMATION_QA_MARKER, "apollo-sequence-execution-automation-v1")
assert.equal(APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ID, "apollo-sequence-execution-automation-v1")
assert.equal(
  APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ROUTE_QA_MARKER,
  "apollo-sequence-execution-automation-route-v1",
)
console.log("  ✓ sequence execution automation QA markers")

const confirmReject = validateApolloSequenceExecutionAutomationConfirmation({
  confirm: "WRONG",
  multichannelSequenceCandidateId: "mc-1",
})
assert.equal(confirmReject.ok, false)
console.log("  ✓ invalid confirmation rejected")

const confirmOk = validateApolloSequenceExecutionAutomationConfirmation({
  confirm: APOLLO_SEQUENCE_EXECUTION_AUTOMATION_EXECUTE_CONFIRM,
  multichannelSequenceCandidateId: "mc-1",
})
assert.equal(confirmOk.ok, true)
assert.equal(confirmOk.multichannel_sequence_candidate_id, "mc-1")
console.log("  ✓ execute confirmation")

const certConfirm = validateApolloSequenceExecutionAutomationConfirmation({
  confirm: APOLLO_SEQUENCE_EXECUTION_CERTIFICATION_EXECUTE_CONFIRM,
  multichannel_sequence_candidate_id: "mc-1",
})
assert.equal(certConfirm.certification_mode, true)
console.log("  ✓ certification confirmation")

const readiness = buildApolloSequenceExecutionAutomationReadinessPayload({
  env: {
    ...process.env,
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
assertApolloEnrichmentCertProductionResponseHasNoSecrets(readiness)
console.log("  ✓ readiness safety flags")

const attribution = buildApolloSequenceExecutionAttributionRecord(SAMPLE_HANDOFF.source_attribution)
assert.equal(assertApolloSequenceExecutionAttributionPreserved(attribution), true)
assert.deepEqual(attribution.attribution_chain, [
  "Apollo",
  "Qualification",
  "Enrollment",
  "Account Playbook",
  "Voice Drop",
  "Multi-Channel",
  "Sequence Execution",
])
console.log("  ✓ attribution chain preserved")

assert.equal(mapOrchestrationChannelToSequenceChannel("email"), "email")
assert.equal(mapOrchestrationChannelToSequenceChannel("calling"), "call")
console.log("  ✓ channel mapping")

const steps = buildApolloSequenceExecutionStepPlans(SAMPLE_HANDOFF)
assert.equal(steps.length, 3)
assert.equal(steps[0]?.channel, "email")
console.log("  ✓ sequence step generation")

const drafts = buildApolloSequenceExecutionDraftRecords({ handoff: SAMPLE_HANDOFF, steps })
assert.equal(drafts.length, 3)
assert.ok(drafts.some((d) => d.draft_type === "email"))
assert.ok(drafts.some((d) => d.draft_type === "voice_drop"))
console.log("  ✓ draft generation")

const materialization = buildApolloSequenceExecutionMaterializationPlan(SAMPLE_HANDOFF)
assert.equal(materialization.total_steps, 3)
console.log("  ✓ materialization plan")

const pipeline = buildSequenceExecutionPipelineFromMultichannelHandoff(SAMPLE_HANDOFF)
assert.equal(assertApolloSequenceExecutionAttributionPreserved(pipeline.source_attribution), true)
console.log("  ✓ multichannel handoff pipeline")

const approvalGate = evaluateApolloSequenceExecutionDraftApprovalGate({
  candidate: {
    candidate_id: "se-1",
    multichannel_sequence_candidate_id: "mc-1",
    voice_drop_candidate_id: "vd-1",
    enrollment_candidate_id: "e-1",
    company_candidate_id: "c-1",
    company_contact_id: "cc-1",
    growth_lead_id: "l-1",
    sequence_enrollment_id: "enroll-1",
    status: "pending_draft_approval",
    company_name: "Summit Medical",
    full_name: "Alex Rivera",
    title: "VP Operations",
    email: "alex@example.com",
    phone: "+15551234567",
    qualification_score: 85,
    materialization,
    execution_jobs: [{ step_number: 1, sequence_step_id: "s1", execution_job_id: "j1", channel: "email", job_status: "pending_approval", scheduled_for: null }],
    source_attribution: attribution,
    operator_summary: pipeline.operator_summary,
    created_at: new Date().toISOString(),
    drafts_approved_at: null,
    drafts_approved_email: null,
  },
})
assert.equal(approvalGate.allowed, true)
console.log("  ✓ approval gate")

const duplicate = evaluateApolloSequenceExecutionDuplicateBlock({ existing_status: "pending_draft_approval" })
assert.equal(duplicate.blocked, true)
console.log("  ✓ duplicate prevention")

const multichannelQueue = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-multichannel-orchestration-queue.ts"),
  "utf8",
)
assert.match(multichannelQueue, /handoffMultichannelApprovedToSequenceExecution/)
assert.match(multichannelQueue, /materialization_error/)
assert.match(multichannelQueue, /buildApolloSequenceExecutionHandoffInput/)
console.log("  ✓ multichannel approval triggers sequence execution handoff")

const bridgeSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-sequence-execution-bridge.ts"),
  "utf8",
)
const actionsRoute = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/platform/growth/apollo-sequence-execution-automation/execution-queue/actions/route.ts",
  ),
  "utf8",
)

for (const forbidden of FORBIDDEN_SIDE_EFFECT_IMPORTS) {
  assert.doesNotMatch(bridgeSource, new RegExp(forbidden, "i"), `Bridge must not import ${forbidden}`)
  assert.doesNotMatch(actionsRoute, new RegExp(forbidden, "i"), `Actions route must not import ${forbidden}`)
}
console.log("  ✓ no live outreach side-effect imports")

assert.match(bridgeSource, /outreach_sent:\s*false/)
assert.match(bridgeSource, /jobs_scheduled:\s*false/)
assert.match(bridgeSource, /status:\s*"pending_approval"/)
assert.match(bridgeSource, /normalizeGrowthActorUserIdForDb/)
assert.doesNotMatch(bridgeSource, /createdBy:\s*"apollo-sequence-execution-automation"/)
console.log("  ✓ bridge safety flags")

const panelSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/apollo-sequence-execution-automation-panel.tsx"),
  "utf8",
)
assert.match(panelSource, /Sequence Execution Queue/)
assert.match(panelSource, /Approve Draft/)
assert.match(panelSource, /Execution Funnel/)
console.log("  ✓ UI queue + funnel")

const gates = assertApolloSequenceExecutionAutomationExecuteAllowed({
  GROWTH_APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ENABLED: "false",
  GROWTH_APOLLO_SEQUENCE_EXECUTION_AUTOMATION_ACK: "0",
})
assert.equal(gates.ok, false)
console.log("  ✓ production gates block when disabled")

console.log("\nApollo Sequence Execution Automation certification checks passed.")
