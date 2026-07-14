/**
 * GE-AIOS-DECISION-ENGINE-1A — Canonical next-best decision authority certification.
 * Run: pnpm test:ge-aios-decision-engine-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildGrowthCanonicalNextBestDecision } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a"
import { buildGrowthCanonicalDecisionFingerprint } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-fingerprint"
import {
  buildCanonicalDecisionInputFromPostCall,
  mapCanonicalDecisionToPostCallNba,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-adapters"
import {
  GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1A_OPERATOR_LAYOUT_QA_MARKER,
  projectCanonicalDecisionOperatorCard,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-operator-card"
import { GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1A_QA_MARKER } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-types"
import type { GrowthCanonicalDecisionInput } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-input"
import {
  isReplyMaterialForCanonicalDecision,
  refreshCanonicalDecisionAfterReply,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-reply"
import { resolveCallWorkspacePostCallNextAction } from "../lib/growth/operator-assist/call-workspace-post-call-nba"

const ROOT = process.cwd()
const BLOCK_LEAD = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const ORG_ID = "org-cert-decision-1a"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function blockImagingBaseInput(): GrowthCanonicalDecisionInput {
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
    sourceVersions: {
      materialEventId: "call-closure:block-imaging",
      packageVersion: "pending-approval-v1",
      meetingVersion: "2026-07-24",
    },
  }
}

console.log(`[${GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1A_QA_MARKER}] Decision Engine 1A certification\n`)

const engineSource = readSource("lib/growth/aios/growth/growth-canonical-decision-engine-1a.ts")
const nbaSource = readSource("lib/growth/operator-assist/call-workspace-post-call-nba.ts")
const closureCompute = readSource("lib/growth/operator-assist/call-workspace-post-call-closure-compute.ts")
const replyProcess = readSource("lib/growth/reply-intelligence/process-reply-intelligence.ts")
const decisionCard = readSource("components/growth/growth-canonical-decision-card.tsx")
const closurePanel = readSource("components/growth/growth-call-workspace-post-call-closure-panel.tsx")

assert.ok(engineSource.includes("buildGrowthCanonicalNextBestDecision"))
assert.ok(nbaSource.includes("buildGrowthCanonicalNextBestDecision"))
assert.ok(closureCompute.includes("canonicalDecision"))
assert.ok(replyProcess.includes("resolveGrowthCanonicalDecisionForLead"))
assert.ok(decisionCard.includes("GrowthCanonicalDecisionCard"))
assert.ok(closurePanel.includes("GrowthCanonicalDecisionCard"))

const base = blockImagingBaseInput()
const baseDecision = buildGrowthCanonicalNextBestDecision(base)

assert.equal(baseDecision.primaryAction, "send_promised_information")
assert.match(baseDecision.title, /workflow checklist/i)
assert.ok(baseDecision.supportingActions.some((row) => row.action === "prepare_meeting"))
assert.ok(baseDecision.suppressedActions.some((row) => /cold email/i.test(row.title)))
assert.ok(baseDecision.suppressedActions.some((row) => /discovery/i.test(row.title)))
assert.ok(baseDecision.suppressedActions.some((row) => /pricing/i.test(row.title)))
assert.ok(baseDecision.suppressedActions.some((row) => /sequence/i.test(row.title)))
assert.ok(baseDecision.suppressedActions.some((row) => /proposal/i.test(row.title)))
assert.equal(baseDecision.transportBlocked, true)
assert.equal(baseDecision.operatorReviewRequired, true)

const operatorCard = projectCanonicalDecisionOperatorCard(baseDecision)
assert.equal(operatorCard.qaMarker, GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1A_OPERATOR_LAYOUT_QA_MARKER)
assert.ok(operatorCard.thenActions.some((row) => /meeting/i.test(row)))
assert.ok(operatorCard.doNotActions.length >= 4)

const postCallNba = resolveCallWorkspacePostCallNextAction({
  organizationId: ORG_ID,
  leadId: BLOCK_LEAD,
  generatedAt: base.generatedAt,
  companyName: base.companyName,
  contactName: base.contactName,
  extracted: {
    commitments: base.postCall!.commitments,
    objections: base.postCall!.objections,
    buyingSignals: base.postCall!.buyingSignals,
    businessConclusions: base.postCall!.businessConclusions,
  },
  liveReasoning: null,
  relationshipAssessment: null,
  scorecard: null,
  operatorWrapup: { outcome: "connected", meetingBooked: true, followUpNeeded: true },
  packageState: base.packageState,
  meeting: base.meeting,
  approvalState: base.approvalState,
})
assert.equal(postCallNba.kind, "send_promised_information")

const sentInput: GrowthCanonicalDecisionInput = {
  ...base,
  packageState: {
    packageId: "pkg-checklist-001",
    status: "sent",
    purpose: "workflow checklist follow-up",
    promisedInformationPending: false,
    promisedInformationSent: true,
  },
  approvalState: { pendingOperatorReview: false, pendingPackageApproval: false, label: null },
  transportState: { blocked: false, reason: null },
  sourceVersions: { ...base.sourceVersions, packageVersion: "sent-v1" },
}
const sentDecision = buildGrowthCanonicalNextBestDecision(sentInput)
assert.equal(sentDecision.primaryAction, "prepare_meeting")

const proposalRequestedInput: GrowthCanonicalDecisionInput = {
  ...sentInput,
  meeting: {
    ...sentInput.meeting!,
    hasUpcomingMeeting: false,
    postMeetingProposalRequested: true,
  },
  postCall: {
    ...sentInput.postCall!,
    commitments: [...sentInput.postCall!.commitments, "Send proposal after workflow review"],
  },
}
const proposalBlocked = buildGrowthCanonicalNextBestDecision(proposalRequestedInput)
assert.equal(proposalBlocked.primaryAction, "research")

const proposalReadyInput: GrowthCanonicalDecisionInput = {
  ...proposalRequestedInput,
  commercialReadiness: {
    pricingInputsComplete: true,
    proposalInputsComplete: true,
    discoveryGaps: [],
  },
}
const proposalReady = buildGrowthCanonicalNextBestDecision(proposalReadyInput)
assert.equal(proposalReady.primaryAction, "prepare_proposal")

const waitInput: GrowthCanonicalDecisionInput = {
  ...base,
  postCall: {
    ...base.postCall!,
    commitments: [],
    meetingBooked: false,
    agreedWaitUntil: "2026-10-01",
    timelineDetected: true,
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
  transportState: { blocked: false, reason: null },
  sequenceState: { enrolled: true, nextScheduledAt: "2026-07-15T14:00:00.000Z", nextStepLabel: "Discovery follow-up" },
}
const waitDecision = buildGrowthCanonicalNextBestDecision(waitInput)
assert.equal(waitDecision.primaryAction, "wait")
assert.ok(waitDecision.suppressedActions.some((row) => row.action === "contact"))

const archivedInput: GrowthCanonicalDecisionInput = {
  ...base,
  operatorConstraints: { archived: true },
}
const archivedDecision = buildGrowthCanonicalNextBestDecision(archivedInput)
assert.ok(archivedDecision.primaryAction === "no_action" || archivedDecision.primaryAction === "disqualify")
assert.equal(archivedDecision.transportBlocked, true)

const fingerprintA = buildGrowthCanonicalDecisionFingerprint(base)
const fingerprintB = buildGrowthCanonicalDecisionFingerprint(base)
assert.equal(fingerprintA, fingerprintB)
const repeatDecision = buildGrowthCanonicalNextBestDecision(base)
assert.equal(repeatDecision.decisionFingerprint, baseDecision.decisionFingerprint)
assert.equal(repeatDecision.primaryAction, baseDecision.primaryAction)

assert.equal(isReplyMaterialForCanonicalDecision("out_of_office"), false)
assert.equal(isReplyMaterialForCanonicalDecision("positive_interest"), true)
const replyRefresh = refreshCanonicalDecisionAfterReply({
  organizationId: ORG_ID,
  leadId: BLOCK_LEAD,
  generatedAt: base.generatedAt,
  intent: "positive_interest",
  classificationLabel: "Positive interest",
  receivedAt: base.generatedAt,
  sequenceEnrolled: true,
})
assert.ok(replyRefresh)
assert.equal(replyRefresh!.primaryAction, "reply")
assert.ok(replyRefresh!.suppressedActions.some((row) => /cold outreach/i.test(row.title)))

const adapterDecision = buildGrowthCanonicalNextBestDecision(
  buildCanonicalDecisionInputFromPostCall({
    organizationId: ORG_ID,
    leadId: BLOCK_LEAD,
    generatedAt: base.generatedAt,
    contactName: "Josh",
    extracted: {
      commitments: base.postCall!.commitments,
      objections: [],
      buyingSignals: base.postCall!.buyingSignals,
      businessConclusions: base.postCall!.businessConclusions,
    },
    liveReasoning: null,
    relationshipAssessment: null,
    scorecard: null,
    operatorWrapup: { outcome: "connected", meetingBooked: true },
    packageState: base.packageState,
    meeting: base.meeting,
    approvalState: base.approvalState,
  }),
)
const mapped = mapCanonicalDecisionToPostCallNba(adapterDecision, "validate operational pain")
assert.equal(mapped.kind, "send_promised_information")

console.log("Block Imaging certification: PASS")
console.log("State transitions: PASS")
console.log("Idempotency fingerprint: PASS")
console.log("Post-call delegation: PASS")
console.log("Reply refresh: PASS")
console.log("Operator card projection: PASS")
console.log("Wiring checks: PASS")
console.log("\nGE-AIOS-DECISION-ENGINE-1A certification complete.")
