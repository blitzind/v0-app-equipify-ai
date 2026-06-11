/**
 * Apollo Voice Drop Automation certification — regression checks without live outreach.
 * Run: pnpm test:apollo-voice-drop-automation
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  APOLLO_VOICE_DROP_AUTOMATION_EXECUTE_CONFIRM,
  APOLLO_VOICE_DROP_AUTOMATION_ROUTE_QA_MARKER,
  APOLLO_VOICE_DROP_CERTIFICATION_EXECUTE_CONFIRM,
  assertApolloVoiceDropAutomationExecuteAllowed,
  buildApolloVoiceDropAutomationReadinessPayload,
  validateApolloVoiceDropAutomationConfirmation,
} from "../lib/growth/apollo/apollo-voice-drop-automation-route-gates"
import {
  APOLLO_VOICE_DROP_AUTOMATION_ID,
  APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER,
} from "../lib/growth/apollo/apollo-voice-drop-automation-types"
import {
  assertApolloVoiceDropAttributionPreserved,
  buildApolloVoiceDropAttributionRecord,
  evaluateApolloVoiceDropApprovalGate,
  evaluateApolloVoiceDropDuplicateBlock,
} from "../lib/growth/apollo/apollo-voice-drop-automation-evidence"
import {
  buildApolloChannelRecommendation,
  computeApolloVoiceDropScore,
  evaluateApolloVoiceDropChannelAvailability,
} from "../lib/growth/apollo/apollo-voice-drop-channel-evaluation"
import { buildApolloVoiceDropIntelligence } from "../lib/growth/apollo/apollo-voice-drop-intelligence-engine"
import { generateApolloVoiceDropScript } from "../lib/growth/apollo/apollo-voice-drop-script-generation"
import { recommendApolloMultichannelStrategy } from "../lib/growth/apollo/apollo-multichannel-recommendation-engine"
import { buildVoiceDropPipelineFromEnrollmentHandoff } from "../lib/growth/apollo/apollo-voice-drop-pipeline-builder"
import { assertApolloEnrichmentCertProductionResponseHasNoSecrets } from "../lib/growth/apollo/apollo-enrichment-cert-production-route-gates"

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-voice-drop-automation-types.ts",
  "lib/growth/apollo/apollo-voice-drop-channel-evaluation.ts",
  "lib/growth/apollo/apollo-voice-drop-intelligence-engine.ts",
  "lib/growth/apollo/apollo-voice-drop-script-generation.ts",
  "lib/growth/apollo/apollo-multichannel-recommendation-engine.ts",
  "lib/growth/apollo/apollo-voice-drop-automation-evidence.ts",
  "lib/growth/apollo/apollo-voice-drop-pipeline-builder.ts",
  "lib/growth/apollo/apollo-voice-drop-bridge.ts",
  "lib/growth/apollo/apollo-voice-drop-candidate-queue.ts",
  "lib/growth/apollo/apollo-voice-drop-funnel-metrics.ts",
  "lib/growth/apollo/apollo-voice-drop-certification.ts",
  "lib/growth/apollo/apollo-voice-drop-automation-route-gates.ts",
  "lib/growth/apollo/apollo-voice-drop-automation-route.ts",
  "app/api/platform/growth/apollo-voice-drop-automation/readiness/route.ts",
  "app/api/platform/growth/apollo-voice-drop-automation/execute/route.ts",
  "app/api/platform/growth/apollo-voice-drop-automation/voice-drop-queue/route.ts",
  "app/api/platform/growth/apollo-voice-drop-automation/voice-drop-queue/actions/route.ts",
  "app/api/platform/growth/apollo-voice-drop-automation/funnel-metrics/route.ts",
  "components/growth/apollo-voice-drop-automation-panel.tsx",
  "supabase/migrations/20270814120000_growth_engine_apollo_voice_drop_automation.sql",
]

const FORBIDDEN_SIDE_EFFECT_IMPORTS = [
  "createGrowthSequenceEnrollmentDraft",
  "confirmGrowthSequenceEnrollment",
  "voice-drop-service",
  "twilio-voice-drop-provider",
  "sendEmail",
  "sendSms",
  "runSequenceVoiceDrop",
  "queueSequenceStepTransportJob",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

assert.equal(APOLLO_VOICE_DROP_AUTOMATION_QA_MARKER, "apollo-voice-drop-automation-v1")
assert.equal(APOLLO_VOICE_DROP_AUTOMATION_ID, "apollo-voice-drop-automation-v1")
assert.equal(APOLLO_VOICE_DROP_AUTOMATION_ROUTE_QA_MARKER, "apollo-voice-drop-automation-route-v1")
console.log("  ✓ voice drop automation QA markers")

const confirmReject = validateApolloVoiceDropAutomationConfirmation({
  confirm: "WRONG",
  enrollmentCandidateId: "e-1",
})
assert.equal(confirmReject.ok, false)
console.log("  ✓ invalid confirmation rejected")

const confirmOk = validateApolloVoiceDropAutomationConfirmation({
  confirm: APOLLO_VOICE_DROP_AUTOMATION_EXECUTE_CONFIRM,
  enrollmentCandidateId: "e-1",
})
assert.equal(confirmOk.ok, true)
assert.equal(confirmOk.enrollment_candidate_id, "e-1")
console.log("  ✓ execute confirmation")

const certConfirm = validateApolloVoiceDropAutomationConfirmation({
  confirm: APOLLO_VOICE_DROP_CERTIFICATION_EXECUTE_CONFIRM,
  enrollment_candidate_id: "e-1",
})
assert.equal(certConfirm.certification_mode, true)
console.log("  ✓ certification confirmation")

const readiness = buildApolloVoiceDropAutomationReadinessPayload({
  env: {
    ...process.env,
    GROWTH_APOLLO_VOICE_DROP_AUTOMATION_ENABLED: "true",
    GROWTH_APOLLO_VOICE_DROP_AUTOMATION_ACK: "1",
    GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ENABLED: "true",
    GROWTH_APOLLO_ENROLLMENT_AUTOMATION_ACK: "1",
    VERCEL_ENV: "production",
  },
})
assert.equal(readiness.voice_drop_sent, false)
assert.equal(readiness.outreach_sent, false)
assert.equal(readiness.draft_created, false)
assertApolloEnrichmentCertProductionResponseHasNoSecrets(readiness)
console.log("  ✓ readiness safety flags")

const attribution = buildApolloVoiceDropAttributionRecord()
assert.equal(assertApolloVoiceDropAttributionPreserved(attribution), true)
assert.deepEqual(attribution.attribution_chain, [
  "Apollo",
  "Qualification",
  "Enrollment",
  "Account Playbook",
  "Voice Drop",
])
console.log("  ✓ attribution chain preserved")

const availability = evaluateApolloVoiceDropChannelAvailability({
  email: "alex@example.com",
  email_verified: true,
  phone: "+15551234567",
  compliance_orchestration_enabled: true,
  voice_drop_vd4_certified: true,
})
assert.equal(availability.verified_email, true)
assert.equal(availability.voice_drop_capable, true)
console.log("  ✓ channel evaluation")

const channelRec = buildApolloChannelRecommendation({
  availability,
  qualification_score: 85,
  fit_score: 80,
  title: "VP Operations",
  has_buying_committee: true,
})
assert.ok(channelRec.confidence_score > 0)
console.log("  ✓ channel recommendation")

const strategy = recommendApolloMultichannelStrategy({
  availability,
  channel_recommendation: channelRec,
  qualification_score: 85,
})
assert.ok(strategy.steps.length >= 2)
console.log("  ✓ multichannel strategy")

const voiceDropScore = computeApolloVoiceDropScore({
  availability,
  qualification_score: 85,
  fit_score: 80,
  channel_recommendation: channelRec,
})
assert.ok(voiceDropScore > 0)
console.log("  ✓ voice drop score")

const intelligence = buildApolloVoiceDropIntelligence({
  company_name: "Summit Medical",
  full_name: "Alex Rivera",
  title: "VP Operations",
  fit_score: 80,
  research_summary: "Research confidence 80/100.",
  company_summary: "Regional biomedical operator.",
})
assert.ok(intelligence.recommended_script_type)
console.log("  ✓ voice drop intelligence")

const script = generateApolloVoiceDropScript({
  script_type: intelligence.recommended_script_type,
  full_name: "Alex Rivera",
  company_name: "Summit Medical",
  title: "VP Operations",
})
assert.match(script.full_script, /Summit Medical/)
assert.ok(script.intro && script.value_proposition && script.call_to_action)
console.log("  ✓ script generation")

const pipeline = buildVoiceDropPipelineFromEnrollmentHandoff({
  enrollment_candidate_id: "e-1",
  company_candidate_id: "c-1",
  company_contact_id: "cc-1",
  contact_candidate_id: null,
  growth_lead_id: "l-1",
  company_name: "Summit Medical",
  full_name: "Alex Rivera",
  title: "VP Operations",
  email: "alex@example.com",
  phone: "+15551234567",
  qualification_score: 85,
  fit_score: 80,
  research_score: 75,
  operator_intelligence: { company_summary: "Regional biomedical operator." },
  source_attribution: {},
  acquisition_evidence: {},
}, {
  VOICE_COMPLIANCE_ORCHESTRATION_ENABLED: "true",
  GROWTH_VOICE_DROP_VD4_LIVE_CERTIFIED: "1",
})
assert.ok(pipeline.voiceDropScript.full_script.trim())
assert.equal(assertApolloVoiceDropAttributionPreserved(pipeline.sourceAttribution), true)
console.log("  ✓ enrollment handoff pipeline")

const approvalGate = evaluateApolloVoiceDropApprovalGate({
  candidate: {
    candidate_id: "vd-1",
    enrollment_candidate_id: "e-1",
    company_candidate_id: "c-1",
    company_contact_id: "cc-1",
    contact_candidate_id: null,
    growth_lead_id: "l-1",
    status: "pending_voice_drop_approval",
    company_name: "Summit Medical",
    full_name: "Alex Rivera",
    title: "VP Operations",
    email: "alex@example.com",
    phone: "+15551234567",
    qualification_score: 85,
    voice_drop_score: voiceDropScore,
    recommendation_confidence: channelRec.confidence_score,
    channel_availability: availability,
    channel_recommendations: channelRec,
    multichannel_strategy: strategy,
    voice_drop_intelligence: intelligence,
    voice_drop_script: script,
    source_attribution: attribution,
    created_at: new Date().toISOString(),
    voice_drop_approved_at: null,
    voice_drop_approved_email: null,
  },
})
assert.equal(approvalGate.allowed, true)
console.log("  ✓ approval gate")

const duplicate = evaluateApolloVoiceDropDuplicateBlock({ existing_status: "pending_voice_drop_approval" })
assert.equal(duplicate.blocked, true)
console.log("  ✓ duplicate prevention")

const enrollmentQueue = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-enrollment-candidate-queue.ts"),
  "utf8",
)
assert.match(enrollmentQueue, /handoffEnrollmentApprovedToAccountPlaybook/)
console.log("  ✓ enrollment approval triggers account playbook handoff")

const bridgeSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-voice-drop-bridge.ts"),
  "utf8",
)
const actionsRoute = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/platform/growth/apollo-voice-drop-automation/voice-drop-queue/actions/route.ts",
  ),
  "utf8",
)

for (const forbidden of FORBIDDEN_SIDE_EFFECT_IMPORTS) {
  assert.doesNotMatch(bridgeSource, new RegExp(forbidden, "i"), `Bridge must not import ${forbidden}`)
  assert.doesNotMatch(actionsRoute, new RegExp(forbidden, "i"), `Actions route must not import ${forbidden}`)
}
console.log("  ✓ no live outreach side-effect imports")

assert.match(bridgeSource, /voice_drop_sent:\s*false/)
assert.match(bridgeSource, /draft_created:\s*false/)
console.log("  ✓ bridge safety flags")

const panelSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/apollo-voice-drop-automation-panel.tsx"),
  "utf8",
)
assert.match(panelSource, /Voice Drops Ready/)
assert.match(panelSource, /Approve Voice Drop/)
assert.match(panelSource, /Voice Funnel/)
console.log("  ✓ UI queue + funnel")

const gates = assertApolloVoiceDropAutomationExecuteAllowed({
  GROWTH_APOLLO_VOICE_DROP_AUTOMATION_ENABLED: "false",
  GROWTH_APOLLO_VOICE_DROP_AUTOMATION_ACK: "0",
})
assert.equal(gates.ok, false)
console.log("  ✓ production gates block when disabled")

console.log("\nApollo Voice Drop Automation certification checks passed.")
