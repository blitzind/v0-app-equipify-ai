/**
 * Apollo Multi-Channel Orchestration certification — regression checks without live outreach.
 * Run: pnpm test:apollo-multichannel-orchestration
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  APOLLO_MULTICHANNEL_CERTIFICATION_EXECUTE_CONFIRM,
  APOLLO_MULTICHANNEL_ORCHESTRATION_EXECUTE_CONFIRM,
  APOLLO_MULTICHANNEL_ORCHESTRATION_ROUTE_QA_MARKER,
  assertApolloMultichannelOrchestrationExecuteAllowed,
  buildApolloMultichannelOrchestrationReadinessPayload,
  validateApolloMultichannelOrchestrationConfirmation,
} from "../lib/growth/apollo/apollo-multichannel-orchestration-route-gates"
import {
  APOLLO_MULTICHANNEL_ORCHESTRATION_ID,
  APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER,
} from "../lib/growth/apollo/apollo-multichannel-orchestration-types"
import {
  assertApolloMultichannelAttributionPreserved,
  buildApolloMultichannelAttributionRecord,
  evaluateApolloMultichannelDuplicateBlock,
  evaluateApolloMultichannelSequenceApprovalGate,
} from "../lib/growth/apollo/apollo-multichannel-orchestration-evidence"
import { buildApolloMultichannelChannelIntelligence } from "../lib/growth/apollo/apollo-multichannel-channel-intelligence"
import { runMultiChannelOrchestrationEngine } from "../lib/growth/apollo/apollo-multichannel-orchestration-engine"
import { buildMultichannelOrchestrationPipelineFromVoiceDropHandoff } from "../lib/growth/apollo/apollo-multichannel-orchestration-pipeline-builder"
import {
  buildApolloMultichannelSchedulingPlan,
  formatSchedulingPlanSummary,
} from "../lib/growth/apollo/apollo-multichannel-scheduling-layer"
import {
  listApolloMultichannelSequenceTemplates,
  selectApolloMultichannelSequenceTemplate,
} from "../lib/growth/apollo/apollo-multichannel-sequence-templates"
import { assertApolloEnrichmentCertProductionResponseHasNoSecrets } from "../lib/growth/apollo/apollo-enrichment-cert-production-route-gates"

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-multichannel-orchestration-types.ts",
  "lib/growth/apollo/apollo-multichannel-sequence-templates.ts",
  "lib/growth/apollo/apollo-multichannel-orchestration-engine.ts",
  "lib/growth/apollo/apollo-multichannel-scheduling-layer.ts",
  "lib/growth/apollo/apollo-multichannel-channel-intelligence.ts",
  "lib/growth/apollo/apollo-multichannel-orchestration-evidence.ts",
  "lib/growth/apollo/apollo-multichannel-orchestration-pipeline-builder.ts",
  "lib/growth/apollo/apollo-multichannel-orchestration-bridge.ts",
  "lib/growth/apollo/apollo-multichannel-orchestration-queue.ts",
  "lib/growth/apollo/apollo-multichannel-orchestration-funnel-metrics.ts",
  "lib/growth/apollo/apollo-multichannel-orchestration-certification.ts",
  "lib/growth/apollo/apollo-multichannel-orchestration-route-gates.ts",
  "lib/growth/apollo/apollo-multichannel-orchestration-route.ts",
  "app/api/platform/growth/apollo-multichannel-orchestration/readiness/route.ts",
  "app/api/platform/growth/apollo-multichannel-orchestration/execute/route.ts",
  "app/api/platform/growth/apollo-multichannel-orchestration/multichannel-queue/route.ts",
  "app/api/platform/growth/apollo-multichannel-orchestration/multichannel-queue/actions/route.ts",
  "app/api/platform/growth/apollo-multichannel-orchestration/funnel-metrics/route.ts",
  "components/growth/apollo-multichannel-orchestration-panel.tsx",
  "supabase/migrations/20270815120000_growth_engine_apollo_multichannel_orchestration.sql",
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

assert.equal(APOLLO_MULTICHANNEL_ORCHESTRATION_QA_MARKER, "apollo-multichannel-orchestration-v1")
assert.equal(APOLLO_MULTICHANNEL_ORCHESTRATION_ID, "apollo-multichannel-orchestration-v1")
assert.equal(
  APOLLO_MULTICHANNEL_ORCHESTRATION_ROUTE_QA_MARKER,
  "apollo-multichannel-orchestration-route-v1",
)
console.log("  ✓ multichannel orchestration QA markers")

const confirmReject = validateApolloMultichannelOrchestrationConfirmation({
  confirm: "WRONG",
  voiceDropCandidateId: "vd-1",
})
assert.equal(confirmReject.ok, false)
console.log("  ✓ invalid confirmation rejected")

const confirmOk = validateApolloMultichannelOrchestrationConfirmation({
  confirm: APOLLO_MULTICHANNEL_ORCHESTRATION_EXECUTE_CONFIRM,
  voiceDropCandidateId: "vd-1",
})
assert.equal(confirmOk.ok, true)
assert.equal(confirmOk.voice_drop_candidate_id, "vd-1")
console.log("  ✓ execute confirmation")

const certConfirm = validateApolloMultichannelOrchestrationConfirmation({
  confirm: APOLLO_MULTICHANNEL_CERTIFICATION_EXECUTE_CONFIRM,
  voice_drop_candidate_id: "vd-1",
})
assert.equal(certConfirm.certification_mode, true)
console.log("  ✓ certification confirmation")

const readiness = buildApolloMultichannelOrchestrationReadinessPayload({
  env: {
    ...process.env,
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
assert.equal(readiness.voice_drop_sent, false)
assert.equal(readiness.draft_created, false)
assert.equal(readiness.jobs_scheduled, false)
assertApolloEnrichmentCertProductionResponseHasNoSecrets(readiness)
console.log("  ✓ readiness safety flags")

const attribution = buildApolloMultichannelAttributionRecord()
assert.equal(assertApolloMultichannelAttributionPreserved(attribution), true)
assert.deepEqual(attribution.attribution_chain, [
  "Apollo",
  "Qualification",
  "Enrollment",
  "Voice Drop",
  "Multi-Channel Sequence",
])
console.log("  ✓ attribution chain preserved")

const availability = {
  verified_email: true,
  phone: true,
  mobile_phone: true,
  sms_capable: true,
  voice_drop_capable: true,
  linkedin: false,
}

const templates = listApolloMultichannelSequenceTemplates()
assert.ok(templates.length >= 8)
assert.ok(templates.some((t) => t.sequence_key === "email_voice_drop"))
assert.ok(templates.some((t) => t.sequence_key === "call_sms"))
console.log("  ✓ sequence templates")

const template = selectApolloMultichannelSequenceTemplate({ availability })
assert.equal(template.sequence_key, "email_voice_sms")
console.log("  ✓ template selection")

const orchestration = runMultiChannelOrchestrationEngine({
  qualification_score: 85,
  fit_score: 80,
  contact_role: "VP Operations",
  company_intelligence_present: true,
  buying_committee_present: true,
  available_channels: availability,
  channel_confidence: 82,
  engagement_history_present: true,
  prior_outreach_count: 1,
  voice_drop_score: 78,
})
assert.ok(orchestration.channel_order.length >= 2)
assert.ok(orchestration.confidence_score > 0)
console.log("  ✓ orchestration engine")

const scheduling = buildApolloMultichannelSchedulingPlan({
  channel_order: orchestration.channel_order,
  prior_outreach_count: 1,
})
assert.ok(scheduling.touches.length >= 2)
assert.match(formatSchedulingPlanSummary(scheduling), /Day 1/)
console.log("  ✓ cadence generation")

const channelIntel = buildApolloMultichannelChannelIntelligence({
  availability,
  channel_order: orchestration.channel_order,
  prior_outreach_count: 0,
})
assert.ok(channelIntel.strongest_channel)
assert.ok(channelIntel.fallback_channels.length >= 0)
console.log("  ✓ channel intelligence")

const pipeline = buildMultichannelOrchestrationPipelineFromVoiceDropHandoff({
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
  fit_score: 80,
  voice_drop_score: 78,
  channel_availability: availability,
  channel_confidence: 82,
  multichannel_strategy_key: "email_voice_drop",
  source_attribution: {},
  operator_intelligence: {
    company_summary: "Regional biomedical operator.",
    buying_committee_summary: "Buying committee coverage identified.",
  },
})
assert.ok(pipeline.scheduling_plan.touches.length >= 2)
assert.equal(assertApolloMultichannelAttributionPreserved(pipeline.source_attribution), true)
console.log("  ✓ voice drop handoff pipeline")

const approvalGate = evaluateApolloMultichannelSequenceApprovalGate({
  candidate: {
    candidate_id: "mc-1",
    voice_drop_candidate_id: "vd-1",
    enrollment_candidate_id: "e-1",
    company_candidate_id: "c-1",
    company_contact_id: "cc-1",
    growth_lead_id: "l-1",
    status: "pending_sequence_approval",
    company_name: "Summit Medical",
    full_name: "Alex Rivera",
    title: "VP Operations",
    email: "alex@example.com",
    phone: "+15551234567",
    qualification_score: 85,
    fit_score: 80,
    orchestration_confidence: orchestration.confidence_score,
    channel_availability: availability,
    orchestration_result: orchestration,
    sequence_template: template,
    scheduling_plan: scheduling,
    channel_intelligence: channelIntel,
    operator_summary: {
      why_selected: orchestration.reasoning,
      recommended_sequence: orchestration.recommended_sequence,
      confidence: orchestration.confidence_score,
      channel_availability_summary: "email, voice drop, sms",
      scheduling_summary: formatSchedulingPlanSummary(scheduling),
    },
    source_attribution: attribution,
    created_at: new Date().toISOString(),
    sequence_approved_at: null,
    sequence_approved_email: null,
  },
})
assert.equal(approvalGate.allowed, true)
console.log("  ✓ approval gate")

const duplicate = evaluateApolloMultichannelDuplicateBlock({ existing_status: "pending_sequence_approval" })
assert.equal(duplicate.blocked, true)
console.log("  ✓ duplicate prevention")

const voiceDropQueue = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-voice-drop-candidate-queue.ts"),
  "utf8",
)
assert.match(voiceDropQueue, /handoffVoiceDropApprovedToMultichannelOrchestration/)
console.log("  ✓ voice drop approval triggers multichannel handoff")

const bridgeSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-multichannel-orchestration-bridge.ts"),
  "utf8",
)
const actionsRoute = fs.readFileSync(
  path.join(
    process.cwd(),
    "app/api/platform/growth/apollo-multichannel-orchestration/multichannel-queue/actions/route.ts",
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
console.log("  ✓ bridge safety flags")

const panelSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/apollo-multichannel-orchestration-panel.tsx"),
  "utf8",
)
assert.match(panelSource, /Multi-Channel Ready/)
assert.match(panelSource, /Approve Sequence/)
assert.match(panelSource, /Multi-Channel Funnel/)
console.log("  ✓ UI queue + funnel")

const gates = assertApolloMultichannelOrchestrationExecuteAllowed({
  GROWTH_APOLLO_MULTICHANNEL_ORCHESTRATION_ENABLED: "false",
  GROWTH_APOLLO_MULTICHANNEL_ORCHESTRATION_ACK: "0",
})
assert.equal(gates.ok, false)
console.log("  ✓ production gates block when disabled")

console.log("\nApollo Multi-Channel Orchestration certification checks passed.")
