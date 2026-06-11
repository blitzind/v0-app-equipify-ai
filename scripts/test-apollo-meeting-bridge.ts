/**
 * Apollo Meeting Bridge (M1-A) — regression checks without live scheduling.
 * Run: pnpm test:apollo-meeting-bridge
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  assertApolloMeetingBridgeAttributionPreserved,
  buildApolloMeetingBridgeAttributionRecord,
  buildApolloMeetingReadinessSnapshot,
  detectBookingIntentFromReplyIntelligence,
  evaluateApolloMeetingBridgeTriggerRules,
  evaluateApolloMeetingCandidateApprovalGate,
  evaluateApolloMeetingCandidateDuplicateBlock,
} from "../lib/growth/apollo/apollo-meeting-bridge-evidence"
import {
  APOLLO_MEETING_BRIDGE_CERTIFICATION_EXECUTE_CONFIRM,
  APOLLO_MEETING_BRIDGE_EXECUTE_CONFIRM,
  APOLLO_MEETING_BRIDGE_ROUTE_QA_MARKER,
  assertApolloMeetingBridgeExecuteAllowed,
  buildApolloMeetingBridgeReadinessPayload,
  validateApolloMeetingBridgeConfirmation,
} from "../lib/growth/apollo/apollo-meeting-bridge-route-gates"
import {
  APOLLO_MEETING_BRIDGE_ID,
  APOLLO_MEETING_BRIDGE_MIGRATION,
  APOLLO_MEETING_BRIDGE_QA_MARKER,
  APOLLO_MEETING_BRIDGE_REPLY_INTENT_TRIGGERS,
  APOLLO_MEETING_BRIDGE_SOURCE_ATTRIBUTION,
} from "../lib/growth/apollo/apollo-meeting-bridge-types"
import { generateBookingRecommendations } from "../lib/growth/booking-intelligence/booking-recommendation"
import { assertApolloEnrichmentCertProductionResponseHasNoSecrets } from "../lib/growth/apollo/apollo-enrichment-cert-production-route-gates"

const REQUIRED_FILES = [
  "lib/growth/apollo/apollo-meeting-bridge-types.ts",
  "lib/growth/apollo/apollo-meeting-bridge-evidence.ts",
  "lib/growth/apollo/apollo-meeting-bridge.ts",
  "lib/growth/apollo/apollo-meeting-candidates-queue.ts",
  "lib/growth/apollo/apollo-meeting-candidates-funnel-metrics.ts",
  "lib/growth/apollo/apollo-meeting-bridge-certification.ts",
  "lib/growth/apollo/apollo-meeting-bridge-route-gates.ts",
  "lib/growth/apollo/apollo-meeting-bridge-route.ts",
  "app/api/platform/growth/apollo-meeting-bridge/readiness/route.ts",
  "app/api/platform/growth/apollo-meeting-bridge/execute/route.ts",
  "app/api/platform/growth/meeting-candidates/funnel-metrics/route.ts",
  "app/api/platform/growth/meeting-candidates/queue/route.ts",
  "app/api/platform/growth/meeting-candidates/queue/actions/route.ts",
  `supabase/migrations/${APOLLO_MEETING_BRIDGE_MIGRATION}`,
]

const FORBIDDEN_SIDE_EFFECT_IMPORTS = [
  "syncMeetingCalendar",
  "pushMeetingToGoogleCalendar",
  "createBookingPageBooking",
  "sendEmail",
  "sendSms",
  "queueSequenceStepTransportJob",
  "runSequenceExecutionJob",
  "runSequenceVoiceDrop",
]

for (const relativePath of REQUIRED_FILES) {
  assert.ok(fs.existsSync(path.join(process.cwd(), relativePath)), `Missing: ${relativePath}`)
  console.log(`  ✓ file.${relativePath}`)
}

assert.equal(APOLLO_MEETING_BRIDGE_QA_MARKER, "apollo-meeting-bridge-m1a-v1")
assert.equal(APOLLO_MEETING_BRIDGE_ID, "apollo-meeting-bridge-m1a-v1")
assert.equal(APOLLO_MEETING_BRIDGE_ROUTE_QA_MARKER, "apollo-meeting-bridge-route-m1a-v1")
console.log("  ✓ meeting bridge QA markers")

assert.deepEqual([...APOLLO_MEETING_BRIDGE_SOURCE_ATTRIBUTION], [
  "Apollo",
  "Qualification",
  "Enrollment",
  "Account Playbook",
  "Voice Drop",
  "Multi-Channel",
  "Sequence Execution",
  "Reply Intelligence",
  "Meeting Candidate",
])
console.log("  ✓ attribution chain")

assert.deepEqual([...APOLLO_MEETING_BRIDGE_REPLY_INTENT_TRIGGERS], [
  "meeting_request",
  "demo_request",
  "positive_interest",
  "pricing_question",
])
console.log("  ✓ trigger rules configured")

const confirmReject = validateApolloMeetingBridgeConfirmation({ confirm: "WRONG" })
assert.equal(confirmReject.ok, false)
console.log("  ✓ invalid confirmation rejected")

const confirmOk = validateApolloMeetingBridgeConfirmation({
  confirm: APOLLO_MEETING_BRIDGE_EXECUTE_CONFIRM,
  sequenceExecutionCandidateId: "seq-1",
})
assert.equal(confirmOk.ok, true)
assert.equal(confirmOk.sequence_execution_candidate_id, "seq-1")
console.log("  ✓ execute confirmation")

const certConfirm = validateApolloMeetingBridgeConfirmation({
  confirm: APOLLO_MEETING_BRIDGE_CERTIFICATION_EXECUTE_CONFIRM,
  sequence_execution_candidate_id: "seq-1",
})
assert.equal(certConfirm.certification_mode, true)
console.log("  ✓ certification confirmation")

const samplePipeline = {
  lead: {
    lead_id: "lead-1",
    company_name: "Summit Medical",
    status: "replied",
    opportunity_readiness_tier: "sales_ready",
  },
  company: {
    company_id: "company-1",
    company_name: "Summit Medical",
    company_candidate_id: "cc-1",
  },
  account_playbook: {
    account_playbook_id: "playbook-1",
    committee_role_summary: [
      {
        full_name: "Jane CEO",
        title: "CEO",
        role_category: "Executive" as const,
        recommended_messaging_theme: ["ROI"],
        recommended_channel_mix: ["Email"],
        contactable: true,
      },
    ],
    committee_coverage_score: 72,
    committee_strategy: "Multi-threaded committee outreach.",
  },
  sequence_execution: {
    sequence_execution_id: "seq-exec-1",
    sequence_enrollment_id: "enroll-1",
  },
  reply_intelligence: {
    outbound_reply_id: "reply-1",
    intent: "meeting_request" as const,
    classification_v2: "meeting_request" as const,
    confidence: 0.85,
    subject: "Demo request",
    body: "Can we schedule a demo next week?",
    has_active_sequence: true,
  },
  qualification: {
    qualification_score: 82,
    lead_status: "call_ready",
    opportunity_readiness_tier: "sales_ready",
  },
  source_attribution: {
    apollo_source: "Apollo Primary Contact Acquisition",
    attribution_chain: [
      "Apollo",
      "Qualification",
      "Enrollment",
      "Account Playbook",
      "Voice Drop",
      "Multi-Channel",
      "Sequence Execution",
    ],
  },
}

const triggerEvidence = evaluateApolloMeetingBridgeTriggerRules(samplePipeline)
assert.equal(triggerEvidence.triggered, true)
assert.ok(triggerEvidence.matched_reply_intents.includes("meeting_request"))
console.log("  ✓ candidate generation trigger rules")

const readiness = buildApolloMeetingReadinessSnapshot({
  pipeline: samplePipeline,
  trigger_evidence: triggerEvidence,
})
assert.ok(readiness.meeting_readiness_score > 0)
assert.equal(readiness.committee_coverage_score, 72)
console.log("  ✓ meeting readiness snapshot")

const bookingIntents = detectBookingIntentFromReplyIntelligence({
  intent: "meeting_request",
  subject: "Demo request",
  body: "Can we schedule a demo next week?",
})
const bookingRecommendations = generateBookingRecommendations({
  intents: bookingIntents,
  hasActiveSequence: true,
})
assert.ok(bookingRecommendations.some((rec) => rec.recommendationType === "book_meeting"))
console.log("  ✓ booking recommendation integration")

const attribution = buildApolloMeetingBridgeAttributionRecord(samplePipeline.source_attribution)
assert.equal(assertApolloMeetingBridgeAttributionPreserved(attribution), true)
console.log("  ✓ attribution preservation")

const duplicateBlock = evaluateApolloMeetingCandidateDuplicateBlock({
  existing_status: "pending_review",
})
assert.equal(duplicateBlock.blocked, true)
console.log("  ✓ duplicate prevention")

const approvalGate = evaluateApolloMeetingCandidateApprovalGate({
  candidate: {
    candidate_id: "mc-1",
    lead_id: "lead-1",
    company_id: "company-1",
    company_candidate_id: "cc-1",
    account_playbook_id: "playbook-1",
    sequence_execution_id: "seq-exec-1",
    outbound_reply_id: "reply-1",
    growth_meeting_id: null,
    booking_recommendation_id: null,
    company_name: "Summit Medical",
    lead_status: "call_ready",
    qualification_snapshot: {},
    committee_role_summary: samplePipeline.account_playbook.committee_role_summary,
    committee_coverage_score: 72,
    committee_strategy: samplePipeline.account_playbook.committee_strategy,
    meeting_readiness_score: readiness.meeting_readiness_score,
    confidence_score: 0.82,
    meeting_readiness_snapshot: readiness,
    booking_recommendation_candidate: bookingRecommendations[0] ?? null,
    trigger_evidence: triggerEvidence,
    source_attribution: attribution,
    status: "pending_review",
    created_at: new Date().toISOString(),
    approved_at: null,
    approved_email: null,
    rejection_note: null,
  },
})
assert.equal(approvalGate.allowed, true)
console.log("  ✓ approval workflow gate")

const readinessPayload = buildApolloMeetingBridgeReadinessPayload({
  env: {
    ...process.env,
    GROWTH_APOLLO_MEETING_BRIDGE_ENABLED: "true",
    GROWTH_APOLLO_MEETING_BRIDGE_ACK: "1",
  },
})
assert.equal(readinessPayload.funnel_stage, "Meeting Candidates Ready")
assert.equal(readinessPayload.safety.outreach_sent, false)
assert.equal(readinessPayload.safety.calendar_written, false)
assert.equal(readinessPayload.safety.meeting_scheduled, false)
assertApolloEnrichmentCertProductionResponseHasNoSecrets(readinessPayload)
console.log("  ✓ queue visibility readiness payload")

const bridgeSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-meeting-bridge.ts"),
  "utf8",
)
const queueSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-meeting-candidates-queue.ts"),
  "utf8",
)
const finalizeSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/replies/finalize-ingested-reply-intelligence.ts"),
  "utf8",
)
const certSource = fs.readFileSync(
  path.join(process.cwd(), "lib/growth/apollo/apollo-meeting-bridge-certification.ts"),
  "utf8",
)

for (const forbidden of FORBIDDEN_SIDE_EFFECT_IMPORTS) {
  assert.doesNotMatch(bridgeSource, new RegExp(forbidden, "i"), `Bridge must not import ${forbidden}`)
  assert.doesNotMatch(queueSource, new RegExp(forbidden, "i"), `Queue must not import ${forbidden}`)
  assert.doesNotMatch(certSource, new RegExp(forbidden, "i"), `Certification must not import ${forbidden}`)
}
console.log("  ✓ no calendar writes or automatic scheduling imports")

assert.match(bridgeSource, /bridgeApolloPipelineToMeetingIntelligence/)
assert.match(queueSource, /approveApolloMeetingCandidate/)
assert.match(queueSource, /proposeGrowthMeetingFromReply/)
assert.match(finalizeSource, /maybeBridgeApolloPipelineToMeetingIntelligenceForLead/)
assert.match(certSource, /no_automatic_scheduling/)
console.log("  ✓ funnel integration wired")

const migrationSource = fs.readFileSync(
  path.join(process.cwd(), `supabase/migrations/${APOLLO_MEETING_BRIDGE_MIGRATION}`),
  "utf8",
)
assert.match(migrationSource, /meeting_candidates/)
assert.match(migrationSource, /meeting_candidate_runs/)
assert.match(migrationSource, /outreach_sent boolean not null default false/)
assert.match(migrationSource, /calendar_written boolean not null default false/)
assert.match(migrationSource, /meeting_scheduled boolean not null default false/)
console.log("  ✓ migration schema")

const gates = assertApolloMeetingBridgeExecuteAllowed({
  ...process.env,
  GROWTH_APOLLO_MEETING_BRIDGE_ENABLED: "false",
  GROWTH_APOLLO_MEETING_BRIDGE_ACK: "0",
})
assert.equal(gates.ok, false)
console.log("  ✓ production gates block when disabled")

console.log("\nApollo Meeting Bridge (M1-A) certification checks passed.")
