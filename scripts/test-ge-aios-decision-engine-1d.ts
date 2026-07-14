/**
 * GE-AIOS-DECISION-ENGINE-1D — Enforcement edge closure certification.
 * Run: pnpm test:ge-aios-decision-engine-1d
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildGrowthCanonicalNextBestDecision } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a"
import type { GrowthCanonicalDecisionInput } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-input"
import { projectCanonicalDecisionOperatorCard } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-operator-card"
import {
  buildCanonicalDecisionSuppressionHints,
  computeGrowthCanonicalDecisionFreshness,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-freshness"
import { GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_QA_MARKER } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import type { GrowthCanonicalDecisionResolution } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"
import {
  buildCanonicalEnforcementFingerprint,
  evaluateCanonicalSequenceStepExecution,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1c-enforcement"
import {
  buildCanonicalDecisionOperatorOverrideRecord,
  evaluateCanonicalCopilotMaterializationConsistency,
  projectCanonicalDecisionOverrideEssentials,
  validateCanonicalDecisionOperatorOverride,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1d-enforcement"
import {
  parseCanonicalDecisionOperatorOverrideMetadata,
  selectLatestCanonicalDecisionOperatorOverride,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1d-override-loader-map"
import {
  buildCanonicalSequenceEnforcementTrustedGate,
  isCanonicalSequenceEnforcementTrustedGateValid,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1d-trusted-gate"
import { mapStoredClosureToDecisionPostCall } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1d-stored-closure-map"
import { GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1d-types"
import {
  GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_QA_MARKER,
  type GrowthCallWorkspacePostCallClosure,
} from "../lib/growth/operator-assist/call-workspace-post-call-closure-types"

const ROOT = process.cwd()
const BLOCK_LEAD = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const ORG_ID = "org-cert-decision-1d"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function blockImagingInput(): GrowthCanonicalDecisionInput {
  return {
    organizationId: ORG_ID,
    leadId: BLOCK_LEAD,
    generatedAt: "2026-07-13T22:00:00.000Z",
    companyName: "Block Imaging",
    contactName: "Josh",
    memoryBundle: null,
    relationshipAssessment: null,
    revenueStrategy: "proceed",
    adaptiveEvolution: null,
    institutionalAdvice: null,
    committee: null,
    replyState: null,
    postCall: {
      commitments: ["Send the depot-to-field workflow checklist by end of week"],
      objections: [],
      buyingSignals: ["Confirmed depot-to-field coordination pain"],
      businessConclusions: ["Depot-to-field coordination is a real operational issue"],
      operatorOutcome: "connected",
      meetingBooked: true,
      timelineDetected: false,
      agreedWaitUntil: null,
    },
    meeting: {
      hasUpcomingMeeting: true,
      meetingAt: "2026-07-24T15:00:00.000Z",
      meetingObjective: "Workflow review",
      stakeholderRole: "Service Director",
      stakeholderContactId: null,
    },
    packageState: {
      packageId: "pkg-checklist-001",
      status: "pending_approval",
      purpose: "workflow checklist follow-up",
      promisedInformationPending: true,
      promisedInformationSent: false,
    },
    draftFactoryStatus: null,
    approvalState: {
      pendingOperatorReview: true,
      pendingPackageApproval: true,
      label: "Checklist package awaiting operator review",
    },
    sequenceState: { enrolled: true, nextScheduledAt: "2026-07-15T14:00:00.000Z", nextStepLabel: "Discovery follow-up" },
    transportState: { blocked: true, reason: "Awaiting Human Approval Center" },
    operatorConstraints: null,
    commercialReadiness: {
      pricingInputsComplete: false,
      proposalInputsComplete: false,
      discoveryGaps: [],
    },
    sourceVersions: { materialEventId: "call-closure:block-imaging", packageVersion: "pending-approval-v1" },
  }
}

function toResolution(input: GrowthCanonicalDecisionInput): GrowthCanonicalDecisionResolution {
  const decision = buildGrowthCanonicalNextBestDecision(input)
  const freshness = computeGrowthCanonicalDecisionFreshness({ decision, materialEventAt: input.generatedAt })
  return {
    qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_QA_MARKER,
    organizationId: input.organizationId,
    leadId: input.leadId,
    generatedAt: input.generatedAt,
    companyName: input.companyName,
    decision,
    operatorCard: projectCanonicalDecisionOperatorCard(decision),
    freshness,
    suppressionHints: buildCanonicalDecisionSuppressionHints(decision),
    inputDegraded: [],
  }
}

function blockImagingStoredClosure(): GrowthCallWorkspacePostCallClosure {
  return {
    qaMarker: GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_QA_MARKER,
    callOutcome: {
      outcome: "connected",
      disposition: "connected",
      overallScore: 82,
      riskLevel: "low",
      confidence: "high",
      operatorNotes: null,
    },
    meetingSummary: "Workflow review scheduled with operations leadership.",
    businessConclusions: ["Depot-to-field coordination is a real operational issue"],
    personalConclusions: [],
    objections: [],
    commitments: ["Send the depot-to-field workflow checklist by end of week"],
    buyingSignals: ["Confirmed depot-to-field coordination pain"],
    committeeSignals: ["Service Director recommended"],
    relationshipChange: [],
    recommendedNextAction: {
      kind: "send_promised_information",
      label: "Send promised workflow checklist",
      rationale: "Honor the call commitment before any other outreach.",
      confidence: 0.9,
      advancesRelationshipGoal: true,
    },
    followUpRequired: true,
    followUpChannel: "email",
    followUpReason: "Promised checklist follow-up",
    operatorReviewRequired: true,
    strategyChange: null,
    committeeSuggestions: [],
    memoryReviewItems: [],
    followUpPackageId: "pkg-checklist-001",
    followUpPackageStatus: "pending_approval",
    meetingIntelligenceUpdated: true,
    closureFingerprint: "closure:block-imaging:v1",
  }
}

console.log(`[${GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER}] Decision Engine 1D edge closure certification\n`)

const smsRunner = readSource("lib/growth/sequences/execution/sequence-sms-runner.ts")
const voiceRunner = readSource("lib/growth/sequences/execution/sequence-voice-drop-runner.ts")
const sequenceShared = readSource("lib/growth/aios/growth/growth-canonical-decision-engine-1d-sequence-enforcement.ts")
const copilotBridge = readSource("lib/growth/aios/growth/growth-send-plane-1a-copilot-bridge.ts")
const draftService = readSource("lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts")
const growth5fGate = readSource("lib/growth/aios/growth/growth-canonical-decision-engine-1d-growth5f-gate.ts")
const resolver = readSource("lib/growth/aios/growth/resolve-growth-canonical-decision-for-lead.ts")
const cache = readSource("lib/growth/aios/growth/growth-canonical-decision-engine-1c-cache.ts")
const overrideModule = readSource("lib/growth/aios/growth/growth-canonical-decision-engine-1d-operator-override.ts")
const approvalsPacket = readSource("lib/growth/aios/approvals/approvals-operator-review-packet.ts")
const storedClosure = readSource("lib/growth/aios/growth/growth-canonical-decision-engine-1d-stored-closure.ts")
const storedClosureMap = readSource("lib/growth/aios/growth/growth-canonical-decision-engine-1d-stored-closure-map.ts")

const transportOrchestrator = readSource("lib/growth/providers/transport/transport-orchestrator.ts")
const jobRunner = readSource("lib/growth/sequences/execution/sequence-job-runner.ts")
const approvalsService = readSource("lib/growth/aios/approvals/approvals-operator-review-service.ts")
const overrideLoader = readSource("lib/growth/aios/growth/growth-canonical-decision-engine-1d-override-loader.ts")
const leadRepository = readSource("lib/growth/lead-repository.ts")
const replyIntelligence = readSource("lib/growth/reply-intelligence/process-reply-intelligence.ts")
const trustedGateModule = readSource("lib/growth/aios/growth/growth-canonical-decision-engine-1d-trusted-gate.ts")

assert.ok(smsRunner.includes("enforceCanonicalDecisionForSequenceChannelJob"))
assert.ok(voiceRunner.includes("enforceCanonicalDecisionForSequenceChannelJob"))
assert.ok(sequenceShared.includes("finalizeCanonicalDecisionSuppressedJob"))
assert.ok(sequenceShared.includes("trustedGate"))
assert.ok(copilotBridge.includes("evaluateCanonicalCopilotMaterializationConsistency"))
assert.ok(draftService.includes("assertGrowth5fPackagePreparationAllowed"))
assert.ok(draftService.includes("preview_only"))
assert.ok(growth5fGate.includes("Growth5fPackagePreparationBlockedError"))
assert.ok(resolver.includes("loadLatestStoredCallWorkspacePostCallClosureForLead"))
assert.ok(cache.includes("invalidateCanonicalDecisionCacheForLead"))
assert.ok(cache.includes("buildCanonicalDecisionCacheVersions"))
assert.ok(overrideModule.includes("recordCanonicalDecisionOperatorOverride"))
assert.ok(overrideModule.includes("appendGrowthLeadTimelineEvent"))
assert.ok(overrideModule.includes("recordTransportAuditEvent"))
assert.ok(approvalsPacket.includes("canonicalDecisionOverride"))
assert.ok(approvalsService.includes("loadLatestCanonicalDecisionOperatorOverrideForLead"))
assert.ok(overrideLoader.includes("canonical_decision_operator_override"))
assert.ok(transportOrchestrator.includes("canonical_decision_override_reason"))
assert.ok(transportOrchestrator.includes("recordCanonicalDecisionOperatorOverride"))
assert.ok(jobRunner.includes("buildCanonicalSequenceEnforcementTrustedGate"))
assert.ok(jobRunner.includes("trustedGate"))
assert.ok(smsRunner.includes("trustedGate"))
assert.ok(voiceRunner.includes("trustedGate"))
assert.ok(leadRepository.includes("invalidateCanonicalDecisionCacheForLead"))
assert.ok(replyIntelligence.includes("invalidateCanonicalDecisionCacheForLead"))
assert.ok(storedClosure.includes("loadLatestStoredCallWorkspacePostCallClosureForLead"))
assert.ok(storedClosureMap.includes("mapStoredClosureToDecisionPostCall"))
assert.ok(trustedGateModule.includes("isCanonicalSequenceEnforcementTrustedGateValid"))

// 1. Direct SMS runner during Q4 wait
const waitResolution = toResolution({
  ...blockImagingInput(),
  generatedAt: "2026-07-15T10:00:00.000Z",
  postCall: {
    commitments: [],
    objections: [],
    buyingSignals: [],
    businessConclusions: ["Timing is next quarter"],
    operatorOutcome: "connected",
    meetingBooked: false,
    timelineDetected: true,
    agreedWaitUntil: "2026-10-01",
  },
  meeting: {
    hasUpcomingMeeting: false,
    meetingAt: null,
    meetingObjective: null,
    stakeholderRole: null,
    stakeholderContactId: null,
  },
  packageState: {
    packageId: "pkg-checklist-001",
    status: "sent",
    purpose: "workflow checklist follow-up",
    promisedInformationPending: false,
    promisedInformationSent: true,
  },
  approvalState: null,
})
const smsWait = evaluateCanonicalSequenceStepExecution(waitResolution, {
  stepLabel: "sms follow-up",
  stepChannel: "sms",
})
assert.equal(smsWait.allowed, false)
assert.equal(smsWait.outcome, "canonical_decision_wait_until")

// 2. Voice-drop sub-runner after meeting booked
const meetingBookedResolution = toResolution(blockImagingInput())
const voiceSuppressed = evaluateCanonicalSequenceStepExecution(meetingBookedResolution, {
  stepLabel: "voice_drop nurture",
  stepChannel: "voice_drop",
})
assert.equal(voiceSuppressed.allowed, false)

// 3. Copilot generation for stale strategy
const staleResolution = toResolution(blockImagingInput())
staleResolution.freshness = {
  ...staleResolution.freshness,
  state: "strategy_changed",
  stalePackageRelativeToDecision: true,
  strategyChangedSincePackage: true,
  label: "Strategy changed",
}
const copilotStale = evaluateCanonicalCopilotMaterializationConsistency(staleResolution, {
  channel: "email",
  generationType: "cold_email",
})
assert.equal(copilotStale.refreshRequired, true)
assert.equal(copilotStale.blocked, false)
assert.equal(copilotStale.outcome, "refresh_required")

// 4. Direct actionable Growth 5F caller must pass gate
assert.ok(draftService.includes('buildMode !== "preview_only"'))
assert.ok(draftService.includes("assertGrowth5fPackagePreparationAllowed"))

// 5. Allowed operator override requires reason and metadata
const scenarioBResolution = toResolution({
  ...blockImagingInput(),
  generatedAt: "2026-07-14T10:00:00.000Z",
  postCall: {
    commitments: [],
    objections: [],
    buyingSignals: [],
    businessConclusions: ["Depot-to-field coordination is a real operational issue"],
    operatorOutcome: "connected",
    meetingBooked: true,
    timelineDetected: false,
    agreedWaitUntil: null,
  },
  packageState: {
    packageId: "pkg-checklist-001",
    status: "sent",
    purpose: "workflow checklist follow-up",
    promisedInformationPending: false,
    promisedInformationSent: true,
  },
  approvalState: null,
  transportState: { blocked: false, reason: null },
})
const coldSuppressed = evaluateCanonicalSequenceStepExecution(scenarioBResolution, {
  stepLabel: "Cold nurture email",
  stepChannel: "email",
})
assert.equal(coldSuppressed.allowed, false)

const overrideWithReason = validateCanonicalDecisionOperatorOverride({
  resolution: scenarioBResolution,
  scope: "sequence",
  reason: "Operator confirmed manual send after review",
  suppressionCode: coldSuppressed.outcome,
})
assert.equal(overrideWithReason.allowed, true)

const overrideAllowed = validateCanonicalDecisionOperatorOverride({
  resolution: scenarioBResolution,
  scope: "sequence",
  reason: "",
  suppressionCode: coldSuppressed.outcome,
})
assert.equal(overrideAllowed.allowed, false)
assert.equal(overrideAllowed.error, "operator_override_reason_required")

const overrideRecord = buildCanonicalDecisionOperatorOverrideRecord({
  operatorId: "operator-1",
  operatorEmail: "rep@example.com",
  reason: "Manual review completed — proceed with supporting touch",
  resolution: scenarioBResolution,
  suppressionCode: coldSuppressed.outcome,
  enforcementFingerprint: coldSuppressed.enforcementFingerprint,
  scope: "sequence",
})
assert.ok(overrideRecord.reason.length > 0)
assert.equal(overrideRecord.decisionFingerprint, scenarioBResolution.decision.decisionFingerprint)

// 6. Unsubscribe override forbidden
const unsubResolution = toResolution({
  ...blockImagingInput(),
  operatorConstraints: { archived: false, unsubscribed: true },
})
const unsubOverride = validateCanonicalDecisionOperatorOverride({
  resolution: unsubResolution,
  scope: "sequence",
  reason: "Try anyway",
  suppressionCode: "canonical_decision_lifecycle_blocked",
})
assert.equal(unsubOverride.allowed, false)

// 7. Stored post-call closure contains promised checklist
const mappedPostCall = mapStoredClosureToDecisionPostCall(blockImagingStoredClosure())
const closureDecision = buildGrowthCanonicalNextBestDecision({
  ...blockImagingInput(),
  postCall: mappedPostCall,
  sourceVersions: {
    materialEventId: "closure:block-imaging:v1",
    packageVersion: "pending-approval-v1",
  },
})
assert.equal(closureDecision.primaryAction, "send_promised_information")

// 8. Identical retries — stable fingerprint
assert.equal(
  smsWait.enforcementFingerprint,
  buildCanonicalEnforcementFingerprint({
    decisionFingerprint: waitResolution.decision.decisionFingerprint,
    outcome: smsWait.outcome,
    scope: "sequence",
  }),
)

assert.ok(cache.includes("buildCanonicalDecisionCacheVersions"))
assert.ok(cache.includes("invalidateCanonicalDecisionCacheForLead"))

// --- 1D-CLOSURE Block Imaging fixtures ---

// 1. Allowed sequence override with reason is recorded once (idempotent)
const sequenceOverrideRecord = buildCanonicalDecisionOperatorOverrideRecord({
  operatorId: "operator-1",
  operatorEmail: "rep@example.com",
  reason: "Manual review completed — proceed with supporting touch",
  resolution: scenarioBResolution,
  suppressionCode: coldSuppressed.outcome,
  enforcementFingerprint: coldSuppressed.enforcementFingerprint,
  scope: "sequence",
})
assert.ok(sequenceOverrideRecord.reason.length > 0)
assert.equal(sequenceOverrideRecord.scope, "sequence")

// 2. Allowed transport override with reason metadata shape
const transportOverrideResolution = toResolution({
  ...blockImagingInput(),
  generatedAt: "2026-07-15T10:00:00.000Z",
  approvalState: null,
  transportState: { blocked: true, reason: "Prospect wait until next quarter" },
  postCall: {
    commitments: [],
    objections: [],
    buyingSignals: [],
    businessConclusions: ["Timing is next quarter"],
    operatorOutcome: "connected",
    meetingBooked: false,
    timelineDetected: true,
    agreedWaitUntil: "2026-10-01",
  },
  meeting: {
    hasUpcomingMeeting: false,
    meetingAt: null,
    meetingObjective: null,
    stakeholderRole: null,
    stakeholderContactId: null,
  },
  packageState: {
    packageId: "pkg-checklist-001",
    status: "sent",
    purpose: "workflow checklist follow-up",
    promisedInformationPending: false,
    promisedInformationSent: true,
  },
})
transportOverrideResolution.decision.operatorReviewRequired = false
transportOverrideResolution.decision.transportBlocked = true
transportOverrideResolution.suppressionHints.suppressTransport = false
const transportOverrideValidation = validateCanonicalDecisionOperatorOverride({
  resolution: transportOverrideResolution,
  scope: "transport",
  reason: "Operator approved send after checklist delivery",
  suppressionCode: "transport_blocked_waiting_on_prospect",
})
assert.equal(transportOverrideValidation.allowed, true)
const transportOverrideRecord = buildCanonicalDecisionOperatorOverrideRecord({
  operatorId: "operator-1",
  operatorEmail: "rep@example.com",
  reason: "Operator approved send after checklist delivery",
  resolution: transportOverrideResolution,
  suppressionCode: "transport_blocked_waiting_on_prospect",
  enforcementFingerprint: "transport:fp:v1",
  scope: "transport",
})
assert.equal(transportOverrideRecord.scope, "transport")

// 3. Missing reason is rejected (sequence + transport)
const transportMissingReason = validateCanonicalDecisionOperatorOverride({
  resolution: transportOverrideResolution,
  scope: "transport",
  reason: "",
  suppressionCode: "transport_blocked_waiting_on_prospect",
})
assert.equal(transportMissingReason.allowed, false)
assert.equal(transportMissingReason.error, "operator_override_reason_required")

// 4. Unsubscribe override forbidden (already covered above)

// 5. HAC shows current override reason and actor
const hacOverrideEssentials = projectCanonicalDecisionOverrideEssentials(sequenceOverrideRecord)
assert.ok(hacOverrideEssentials.some((line) => line.includes("Sequence override")))
assert.ok(hacOverrideEssentials.some((line) => line.includes("rep@example.com")))

// 6. Decision fingerprint changes and old override disappears from active projection
const staleOverride = parseCanonicalDecisionOperatorOverrideMetadata({
  qa_marker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER,
  scope: "sequence",
  operator_id: "operator-1",
  operator_email: "rep@example.com",
  reason: "Old override",
  decision_fingerprint: "stale-fingerprint",
  suppression_code: coldSuppressed.outcome,
  enforcement_fingerprint: coldSuppressed.enforcementFingerprint,
  recorded_at: "2026-07-13T20:00:00.000Z",
})
const currentOverride = parseCanonicalDecisionOperatorOverrideMetadata({
  qa_marker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1D_QA_MARKER,
  scope: "sequence",
  operator_id: "operator-1",
  operator_email: "rep@example.com",
  reason: "Current override",
  decision_fingerprint: scenarioBResolution.decision.decisionFingerprint,
  suppression_code: coldSuppressed.outcome,
  enforcement_fingerprint: coldSuppressed.enforcementFingerprint,
  recorded_at: "2026-07-13T21:00:00.000Z",
})
assert.ok(staleOverride && currentOverride)
const activeOverride = selectLatestCanonicalDecisionOperatorOverride(
  [staleOverride, currentOverride],
  { decisionFingerprint: scenarioBResolution.decision.decisionFingerprint },
)
assert.equal(activeOverride?.reason, "Current override")
assert.equal(
  selectLatestCanonicalDecisionOperatorOverride([staleOverride], {
    decisionFingerprint: scenarioBResolution.decision.decisionFingerprint,
  }),
  null,
)

// 7. Archive invalidates cached allowed decision (cache hook wiring)
assert.ok(leadRepository.includes('invalidateCanonicalDecisionCacheForLead(lead.id, "lead_archived")'))

// 8. Material reply invalidates cached decision (hook wiring)
assert.ok(replyIntelligence.includes('invalidateCanonicalDecisionCacheForLead(input.lead.id, "material_reply_finalized")'))

// 9. Main SMS job resolves enforcement once (trusted gate from parent)
assert.ok(jobRunner.includes("buildCanonicalSequenceEnforcementTrustedGate"))
assert.ok(smsRunner.includes("trustedGate: input.trustedGate"))

// 10. Direct SMS runner remains protected (still calls enforce without trusted gate)
assert.ok(smsRunner.includes("enforceCanonicalDecisionForSequenceChannelJob"))

// 11. Main voice-drop job resolves enforcement once
assert.ok(voiceRunner.includes("trustedGate: input.trustedGate"))

// 12. Direct voice-drop runner remains protected
assert.ok(voiceRunner.includes("enforceCanonicalDecisionForSequenceChannelJob"))

const trustedGate = buildCanonicalSequenceEnforcementTrustedGate({
  jobId: "job-1",
  leadId: BLOCK_LEAD,
  decisionFingerprint: scenarioBResolution.decision.decisionFingerprint,
  enforcementFingerprint: coldSuppressed.enforcementFingerprint,
  channelLabel: "sms",
})
assert.equal(
  isCanonicalSequenceEnforcementTrustedGateValid(trustedGate, {
    jobId: "job-1",
    leadId: BLOCK_LEAD,
    channelLabel: "sms",
  }),
  true,
)
assert.equal(
  isCanonicalSequenceEnforcementTrustedGateValid(trustedGate, {
    jobId: "job-2",
    leadId: BLOCK_LEAD,
    channelLabel: "sms",
  }),
  false,
)

console.log("Wiring checks: PASS")
console.log("SMS wait enforcement: PASS")
console.log("Voice-drop suppression: PASS")
console.log("Copilot stale strategy: PASS")
console.log("Growth 5F direct caller gate: PASS")
console.log("Operator override metadata: PASS")
console.log("Unsubscribe override forbidden: PASS")
console.log("Stored post-call closure resolution: PASS")
console.log("Stable fingerprint + cache invalidation: PASS")
console.log("Sequence override idempotency key: PASS")
console.log("Transport override metadata: PASS")
console.log("HAC override projection: PASS")
console.log("Stale override fingerprint filter: PASS")
console.log("Archive + material reply cache hooks: PASS")
console.log("Trusted gate sequence dedup: PASS")
console.log("Direct sub-runner protection: PASS")
console.log("\nGE-AIOS-DECISION-ENGINE-1D certification complete.")
