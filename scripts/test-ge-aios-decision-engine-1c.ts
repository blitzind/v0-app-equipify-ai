/**
 * GE-AIOS-DECISION-ENGINE-1C — Runtime decision enforcement certification.
 * Run: pnpm test:ge-aios-decision-engine-1c
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
  canOperatorOverrideCanonicalSuppression,
  evaluateCanonicalSequenceStepExecution,
  evaluateCanonicalTransportBoundary,
  evaluateDraftFactoryDecisionGate,
  evaluateGrowth5fPackagePreparation,
  projectCanonicalDecisionHacEnforcement,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1c-enforcement"
import { GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1C_QA_MARKER } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1c-types"

const ROOT = process.cwd()
const BLOCK_LEAD = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const ORG_ID = "org-cert-decision-1c"

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
    committee: {
      championIdentified: false,
      recommendedStakeholderRole: "Service Director",
      recommendedStakeholderLabel: "Service Director",
      multiThreadRecommended: true,
      summary: "Service Director recommended on call.",
    },
    replyState: null,
    postCall: {
      commitments: ["Send the depot-to-field workflow checklist by end of week"],
      objections: [],
      buyingSignals: ["Confirmed depot-to-field coordination pain"],
      businessConclusions: [
        "Depot-to-field coordination is a real operational issue",
        "Competitor ServiceMax confirmed in use",
        "Timing is next quarter",
      ],
      operatorOutcome: "connected",
      meetingBooked: true,
      timelineDetected: true,
      agreedWaitUntil: null,
    },
    meeting: {
      hasUpcomingMeeting: true,
      meetingAt: "2026-07-24T15:00:00.000Z",
      meetingObjective: "Workflow review with operations leadership",
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
    draftFactoryStatus: "package_drafted",
    approvalState: {
      pendingOperatorReview: true,
      pendingPackageApproval: true,
      label: "Checklist package awaiting operator review",
    },
    sequenceState: {
      enrolled: true,
      nextScheduledAt: "2026-07-15T14:00:00.000Z",
      nextStepLabel: "Discovery follow-up",
    },
    transportState: { blocked: true, reason: "Awaiting Human Approval Center" },
    operatorConstraints: null,
    commercialReadiness: {
      pricingInputsComplete: false,
      proposalInputsComplete: false,
      discoveryGaps: ["Decision-maker commercial authority"],
    },
    sourceVersions: { materialEventId: "call-closure:block-imaging", packageVersion: "pending-approval-v1" },
  }
}

function toResolution(
  input: GrowthCanonicalDecisionInput,
  packageSnapshot?: {
    packageId: string
    preparedAt: string
    expectedOutcome?: string
  } | null,
  strategyChangedSincePackage = false,
): GrowthCanonicalDecisionResolution {
  const decision = buildGrowthCanonicalNextBestDecision(input)
  const freshness = computeGrowthCanonicalDecisionFreshness({
    decision,
    packageSnapshot: packageSnapshot
      ? {
          packageId: packageSnapshot.packageId,
          leadId: input.leadId,
          companyName: input.companyName,
          preparedAt: packageSnapshot.preparedAt,
          generatedAssets: [],
          personalizationEvidence: [],
          supportingResearch: [],
          confidence: 0.82,
          approvalRequirements: [],
          complianceNotes: [],
          recommendedChannel: "email",
          recommendedSequence: "follow_up",
          expectedOutcome: packageSnapshot.expectedOutcome ?? "follow-up",
          pendingHumanApproval: true,
          transportBlocked: true,
        }
      : null,
    materialEventAt: input.generatedAt,
    strategyChangedSincePackage,
  })
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

console.log(`[${GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1C_QA_MARKER}] Decision Engine 1C runtime enforcement certification\n`)

const packagePersistence = readSource(
  "lib/growth/aios/growth/growth-autonomous-outreach-preparation-package-persistence.ts",
)
const draftFactoryLive = readSource("lib/growth/draft-factory/draft-factory-durable-live.ts")
const draftFactoryService = readSource("lib/growth/draft-factory/draft-factory-durable-service.ts")
const sequenceRunner = readSource("lib/growth/sequences/execution/sequence-job-runner.ts")
const transportOrchestrator = readSource("lib/growth/providers/transport/transport-orchestrator.ts")
const approvalsPacket = readSource("lib/growth/aios/approvals/approvals-operator-review-packet.ts")
const packageCard = readSource("components/growth/ai-os/approvals/growth-ava-completed-outreach-package-card.tsx")

assert.ok(packagePersistence.includes("evaluateGrowth5fPackagePreparation"))
assert.ok(draftFactoryLive.includes("evaluateDraftFactoryDecisionGate"))
assert.ok(draftFactoryService.includes("decisionEnforcementBlocked"))
assert.ok(sequenceRunner.includes("enforceCanonicalDecisionForSequenceChannelJob"))
assert.ok(readSource("lib/growth/aios/growth/growth-canonical-decision-engine-1d-sequence-enforcement.ts").includes("finalizeCanonicalDecisionSuppressedJob"))
assert.ok(transportOrchestrator.includes("evaluateCanonicalTransportBoundary"))
assert.ok(approvalsPacket.includes("canonicalDecisionEnforcementEssentials"))
assert.ok(packageCard.includes("Enforcement status"))

// Scenario A — promised checklist pending
const scenarioA = toResolution(blockImagingInput(), {
  packageId: "pkg-checklist-001",
  preparedAt: "2026-07-12T12:00:00.000Z",
  expectedOutcome: "Send promised workflow checklist",
})
assert.equal(scenarioA.decision.primaryAction, "send_promised_information")

const checklistAllowed = evaluateGrowth5fPackagePreparation(scenarioA, {
  proposedPurpose: "Send promised workflow checklist",
})
assert.equal(checklistAllowed.outcome, "decision_allowed")

const coldBlocked = evaluateGrowth5fPackagePreparation(scenarioA, {
  proposedPurpose: "Cold discovery outreach",
  wakeCondition: "execution_completed",
})
assert.ok(
  coldBlocked.outcome === "decision_blocked_competing_package" ||
    coldBlocked.outcome === "decision_blocked_waiting_on_operator",
)

const sequenceSuppressed = evaluateCanonicalSequenceStepExecution(scenarioA, {
  stepLabel: "Discovery follow-up",
  stepChannel: "email",
})
assert.equal(sequenceSuppressed.allowed, false)
assert.equal(sequenceSuppressed.outcome, "canonical_decision_pending_approval")

const meetingPrepAllowed = evaluateGrowth5fPackagePreparation(scenarioA, {
  proposedPurpose: "Meeting prep for workflow review",
})
assert.equal(meetingPrepAllowed.allowed, true)

// Scenario B — checklist approved and sent
const scenarioBInput: GrowthCanonicalDecisionInput = {
  ...blockImagingInput(),
  generatedAt: "2026-07-14T10:00:00.000Z",
  postCall: {
    ...blockImagingInput().postCall!,
    commitments: [],
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
  sourceVersions: { materialEventId: "package:sent", packageVersion: "sent-v1" },
}
const scenarioB = toResolution(scenarioBInput, {
  packageId: "pkg-checklist-001",
  preparedAt: "2026-07-13T08:00:00.000Z",
  expectedOutcome: "Workflow checklist sent",
})
assert.equal(scenarioB.decision.primaryAction, "prepare_meeting")

const meetingPrepB = evaluateGrowth5fPackagePreparation(scenarioB, {
  proposedPurpose: "Meeting prep for Service Director workflow review",
})
assert.equal(meetingPrepB.allowed, true)

const coldB = evaluateCanonicalSequenceStepExecution(scenarioB, {
  stepLabel: "Cold nurture email",
  stepChannel: "email",
})
assert.equal(coldB.allowed, false)

// Scenario C — prospect requests Q4
const scenarioCInput: GrowthCanonicalDecisionInput = {
  ...blockImagingInput(),
  generatedAt: "2026-07-15T10:00:00.000Z",
  postCall: {
    ...blockImagingInput().postCall!,
    commitments: [],
    meetingBooked: false,
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
}
const scenarioC = toResolution(scenarioCInput)
assert.equal(scenarioC.decision.primaryAction, "wait")

const dfGateC = evaluateDraftFactoryDecisionGate(scenarioC, { proposedPurpose: "Cold outreach package" })
assert.equal(dfGateC.allowGeneration, false)
assert.equal(dfGateC.outcome, "decision_blocked_waiting_on_prospect")
assert.equal(dfGateC.nextEligibleWakeAt, "2026-10-01")

const sequenceC = evaluateCanonicalSequenceStepExecution(scenarioC, { stepLabel: "Follow-up email" })
assert.equal(sequenceC.outcome, "canonical_decision_wait_until")

const transportC = evaluateCanonicalTransportBoundary(scenarioC, { humanApproved: true })
assert.equal(transportC.allowed, false)

const replyEarlyC = toResolution({
  ...scenarioCInput,
  generatedAt: "2026-07-20T10:00:00.000Z",
  replyState: {
    classification: "Positive interest",
    intent: "positive_interest",
    isMaterial: true,
    isOutOfOffice: false,
    isUnknown: false,
    receivedAt: "2026-07-20T10:00:00.000Z",
  },
  postCall: {
    ...scenarioCInput.postCall!,
    agreedWaitUntil: null,
    timelineDetected: false,
  },
  sourceVersions: { materialEventId: "reply:positive", packageVersion: "sent-v1" },
})
assert.notEqual(replyEarlyC.decision.primaryAction, "wait")

// Scenario D — strategy changed after package approval
const scenarioDInput: GrowthCanonicalDecisionInput = {
  ...blockImagingInput(),
  generatedAt: "2026-07-16T10:00:00.000Z",
  packageState: {
    packageId: "pkg-checklist-001",
    status: "approved",
    purpose: "workflow checklist follow-up",
    promisedInformationPending: false,
    promisedInformationSent: false,
  },
  approvalState: null,
  transportState: { blocked: false, reason: null },
}
const scenarioD = toResolution(
  scenarioDInput,
  {
    packageId: "pkg-checklist-001",
    preparedAt: "2026-07-10T12:00:00.000Z",
    expectedOutcome: "Send promised workflow checklist",
  },
  true,
)
assert.equal(scenarioD.freshness.state, "strategy_changed")

const transportD = evaluateCanonicalTransportBoundary(scenarioD, {
  humanApproved: true,
  packageFingerprintAtApproval: "pkg-checklist-001",
})
assert.equal(transportD.allowed, false)
assert.equal(transportD.requiresPackageRefresh, true)
assert.equal(transportD.outcome, "transport_blocked_strategy_changed")

const regenBlocked = evaluateGrowth5fPackagePreparation(scenarioD, {
  proposedPurpose: "Replacement cold outreach package",
})
assert.ok(
  regenBlocked.outcome === "decision_refresh_required" ||
    regenBlocked.outcome === "decision_blocked_competing_package",
)
assert.equal(regenBlocked.allowed, false)

const hacD = projectCanonicalDecisionHacEnforcement(scenarioD)
assert.equal(hacD.status, "strategy_changed")

// Scenario E — archived / unsubscribed
const scenarioE = toResolution({
  ...blockImagingInput(),
  operatorConstraints: { archived: true, unsubscribed: true },
})
const lifecycleBlocked = evaluateGrowth5fPackagePreparation(scenarioE, {
  proposedPurpose: "Any package",
})
assert.equal(lifecycleBlocked.outcome, "decision_blocked_lead_lifecycle")
assert.equal(canOperatorOverrideCanonicalSuppression({ resolution: scenarioE, scope: "sequence" }), false)
assert.equal(canOperatorOverrideCanonicalSuppression({ resolution: scenarioE, scope: "transport" }), false)

// Scenario F — repeated scheduler/runner execution idempotency
const fingerprintA = buildCanonicalEnforcementFingerprint({
  decisionFingerprint: scenarioA.decision.decisionFingerprint,
  outcome: sequenceSuppressed.outcome,
  scope: "sequence",
})
assert.equal(
  fingerprintA,
  buildCanonicalEnforcementFingerprint({
    decisionFingerprint: scenarioA.decision.decisionFingerprint,
    outcome: sequenceSuppressed.outcome,
    scope: "sequence",
  }),
)
assert.equal(sequenceSuppressed.enforcementFingerprint, fingerprintA)

console.log("Wiring checks: PASS")
console.log("Scenario A promised checklist pending: PASS")
console.log("Scenario B checklist sent / prepare meeting: PASS")
console.log("Scenario C Q4 wait enforcement: PASS")
console.log("Scenario D strategy changed / package refresh: PASS")
console.log("Scenario E archived lifecycle block: PASS")
console.log("Scenario F stable suppression fingerprint: PASS")
console.log("\nGE-AIOS-DECISION-ENGINE-1C certification complete.")
