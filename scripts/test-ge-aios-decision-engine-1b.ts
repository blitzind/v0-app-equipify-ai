/**
 * GE-AIOS-DECISION-ENGINE-1B — Canonical decision convergence certification.
 * Run: pnpm test:ge-aios-decision-engine-1b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildGrowthCanonicalNextBestDecision } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a"
import type { GrowthCanonicalDecisionInput } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1a-input"
import {
  computeGrowthCanonicalDecisionFreshness,
  buildCanonicalDecisionSuppressionHints,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-freshness"
import {
  GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_OPERATOR_PROJECTION_QA_MARKER,
  projectCanonicalDecisionEssentials,
  projectCanonicalDecisionToHomePrimary,
  projectGrowthCanonicalOperatorDecision,
} from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-operator-projection"
import { GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_QA_MARKER } from "../lib/growth/aios/growth/growth-canonical-decision-engine-1b-types"

const ROOT = process.cwd()
const BLOCK_LEAD = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const ORG_ID = "org-cert-decision-1b"

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
    sequenceState: { enrolled: true, nextScheduledAt: "2026-07-15T14:00:00.000Z", nextStepLabel: "Discovery follow-up" },
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

console.log(`[${GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_QA_MARKER}] Decision Engine 1B convergence certification\n`)

const resolverSource = readSource("lib/growth/aios/growth/resolve-growth-canonical-decision-for-lead.ts")
const homeSummary = readSource("lib/growth/home/growth-home-workspace-summary-service.ts")
const hero7a = readSource("lib/growth/workspace/executive-briefing/growth-home-ava-hero-7a.ts")
const leadWorkspace = readSource("lib/growth/lead-operator-workspace/lead-operator-workspace-from-lead.ts")
const approvalsService = readSource("lib/growth/aios/approvals/approvals-operator-review-service.ts")
const approvalsPacket = readSource("lib/growth/aios/approvals/approvals-operator-review-packet.ts")
const meetingPrep = readSource("lib/growth/meeting-intelligence/meeting-prep-context.ts")
const replyProcess = readSource("lib/growth/reply-intelligence/process-reply-intelligence.ts")
const packageCard = readSource("components/growth/ai-os/approvals/growth-ava-completed-outreach-package-card.tsx")
const leadUi = readSource("components/growth/lead-operator/growth-lead-operator-workspace.tsx")

assert.ok(resolverSource.includes("resolveGrowthCanonicalDecisionForLead"))
assert.ok(homeSummary.includes("canonicalHeroDecision"))
assert.ok(hero7a.includes("canonicalHeroDecision"))
assert.ok(leadWorkspace.includes("resolveGrowthCanonicalDecisionForLead"))
assert.ok(approvalsService.includes("resolveGrowthCanonicalDecisionForLead"))
assert.ok(approvalsPacket.includes("canonicalDecisionEssentials"))
assert.ok(meetingPrep.includes("canonicalDecision"))
assert.ok(replyProcess.includes("resolveGrowthCanonicalDecisionForLead"))
assert.ok(packageCard.includes("canonicalDecisionEssentials"))
assert.ok(leadUi.includes("GrowthCanonicalDecisionCard"))

const base = blockImagingInput()
const decision = buildGrowthCanonicalNextBestDecision(base)
const freshness = computeGrowthCanonicalDecisionFreshness({
  decision,
  packageSnapshot: {
    packageId: "pkg-checklist-001",
    leadId: BLOCK_LEAD,
    companyName: "Block Imaging",
    preparedAt: "2026-07-12T12:00:00.000Z",
    generatedAssets: [],
    personalizationEvidence: [],
    supportingResearch: [],
    confidence: 0.82,
    approvalRequirements: ["Post-call workflow checklist follow-up"],
    complianceNotes: [],
    recommendedChannel: "email",
    recommendedSequence: "follow_up",
    expectedOutcome: "Send promised workflow checklist",
    pendingHumanApproval: true,
    transportBlocked: true,
  },
  materialEventAt: base.generatedAt,
})

const projection = projectGrowthCanonicalOperatorDecision({ decision, freshness })
const homePrimary = projectCanonicalDecisionToHomePrimary({ decision, freshness })
const hacEssentials = projectCanonicalDecisionEssentials({
  decision,
  freshness,
  packagePurpose: "Send promised workflow checklist",
})

assert.equal(decision.primaryAction, "send_promised_information")
assert.equal(projection.qaMarker, GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_OPERATOR_PROJECTION_QA_MARKER)
assert.equal(homePrimary.projection.decisionFingerprint, decision.decisionFingerprint)
assert.equal(projection.decisionFingerprint, decision.decisionFingerprint)
assert.ok(homePrimary.label.includes("workflow checklist") || homePrimary.label.includes("promised"))
assert.ok(projection.thenActions.some((row) => /meeting/i.test(row)))
assert.ok(hacEssentials.some((row) => /Package purpose/i.test(row)))
assert.ok(!projection.whatToDo.includes("\u2014"))
assert.ok(!hacEssentials.join(" ").includes("\u2014"))
assert.ok(!projection.whatToDo.match(/decision engine|revenue strategy 1a/i))

const materialReplyInput: GrowthCanonicalDecisionInput = {
  ...base,
  postCall: {
    ...base.postCall!,
    commitments: [],
    meetingBooked: false,
    timelineDetected: false,
    businessConclusions: ["Depot-to-field coordination is a real operational issue"],
  },
  meeting: {
    hasUpcomingMeeting: false,
    meetingAt: null,
    meetingObjective: null,
    stakeholderRole: null,
    stakeholderContactId: null,
  },
  replyState: {
    classification: "Positive interest",
    intent: "positive_interest",
    isMaterial: true,
    isOutOfOffice: false,
    isUnknown: false,
    receivedAt: "2026-07-14T10:00:00.000Z",
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
  sourceVersions: { ...base.sourceVersions, materialEventId: "reply:positive" },
}
const replyDecision = buildGrowthCanonicalNextBestDecision(materialReplyInput)
const replyProjection = projectGrowthCanonicalOperatorDecision({ decision: replyDecision })
assert.equal(replyDecision.primaryAction, "reply")

const pendingPackageHints = buildCanonicalDecisionSuppressionHints(decision)
assert.equal(pendingPackageHints.suppressDuplicatePackage, true)

const waitInput: GrowthCanonicalDecisionInput = {
  ...base,
  postCall: {
    ...base.postCall!,
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
const waitDecision = buildGrowthCanonicalNextBestDecision(waitInput)
const waitHome = projectCanonicalDecisionToHomePrimary({ decision: waitDecision })
const waitHac = projectCanonicalDecisionEssentials({ decision: waitDecision })
assert.equal(waitDecision.primaryAction, "wait")
assert.equal(waitHome.projection.decisionFingerprint, waitDecision.decisionFingerprint)
assert.equal(waitHac[0], waitHome.label)

const archivedInput: GrowthCanonicalDecisionInput = {
  ...base,
  operatorConstraints: { archived: true },
}
const archivedDecision = buildGrowthCanonicalNextBestDecision(archivedInput)
const archivedHome = projectCanonicalDecisionToHomePrimary({ decision: archivedDecision })
const archivedHac = projectCanonicalDecisionEssentials({ decision: archivedDecision })
assert.ok(archivedDecision.primaryAction === "no_action" || archivedDecision.primaryAction === "disqualify")
assert.equal(archivedHome.projection.primaryAction, archivedDecision.primaryAction)
assert.equal(archivedHac[0], archivedHome.label)

console.log("Cross-surface fingerprint consistency: PASS")
console.log("Block Imaging convergence: PASS")
console.log("Material reply transition: PASS")
console.log("Pending package suppression: PASS")
console.log("Q4 wait convergence: PASS")
console.log("Archived convergence: PASS")
console.log("Wiring checks: PASS")
console.log("\nGE-AIOS-DECISION-ENGINE-1B certification complete.")
