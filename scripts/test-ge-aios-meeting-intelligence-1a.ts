/**
 * GE-AIOS-MEETING-INTELLIGENCE-1A — Canonical meeting preparation certification.
 * Run: pnpm test:ge-aios-meeting-intelligence-1a
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
import {
  buildGrowthCanonicalMeetingBrief,
  buildMeetingIntelligenceInputForDecisionEngine,
  projectCanonicalMeetingBriefLiveContext,
} from "../lib/growth/meeting-intelligence/growth-canonical-meeting-brief-builder"
import { GROWTH_AIOS_MEETING_INTELLIGENCE_1A_QA_MARKER } from "../lib/growth/meeting-intelligence/growth-canonical-meeting-brief-types"
import { GROWTH_MEETING_PREP_QA_MARKER } from "../lib/growth/meeting-intelligence/meeting-prep-types"
import type { GrowthMeetingPrepBundle } from "../lib/growth/meeting-intelligence/meeting-prep-types"

const ROOT = process.cwd()
const BLOCK_LEAD = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const MEETING_ID = "meeting-block-imaging-service-director"
const ORG_ID = "org-cert-meeting-intelligence-1a"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function blockImagingDecisionInput(): GrowthCanonicalDecisionInput {
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
      summary: "Missing operations leadership coverage",
    },
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
      meetingObjective: "Workflow review with Service Director",
      stakeholderRole: "Service Director",
      stakeholderContactId: null,
    },
    packageState: {
      packageId: "pkg-checklist-001",
      status: "sent",
      purpose: "workflow checklist follow-up",
      promisedInformationPending: false,
      promisedInformationSent: true,
    },
    draftFactoryStatus: null,
    approvalState: null,
    sequenceState: { enrolled: true, nextScheduledAt: "2026-07-15T14:00:00.000Z", nextStepLabel: "Discovery follow-up" },
    transportState: { blocked: false, reason: null },
    operatorConstraints: null,
    commercialReadiness: {
      pricingInputsComplete: false,
      proposalInputsComplete: false,
      discoveryGaps: [],
    },
    sourceVersions: { materialEventId: "call-closure:block-imaging", packageVersion: "pending-approval-v1" },
  }
}

function blockImagingPrepBundle(): GrowthMeetingPrepBundle {
  return {
    qa_marker: GROWTH_MEETING_PREP_QA_MARKER,
    meeting: {
      id: MEETING_ID,
      leadId: BLOCK_LEAD,
      title: "Workflow review with Service Director",
      status: "scheduled",
      startAt: "2026-07-24T15:00:00.000Z",
      endAt: "2026-07-24T16:00:00.000Z",
      source: "operator",
      calendarEventId: "cal-block-imaging-001",
      attendeeEmails: ["service.director@blockimaging.example"],
      meetingUrl: null,
    },
    companySnapshot: {
      companyName: "Block Imaging",
      website: "https://blockimaging.example",
      industry: "Medical equipment service",
      location: "Grand Rapids, MI",
      employees: "120",
      revenue: null,
    },
    leadScore: { score: 78, label: "Strong", explanation: "High fit", source: "lead_engine" },
    buyingStage: { stage: "evaluation", confidence: 0.72, reason: "Meeting booked after workflow pain" },
    decisionMakers: [
      {
        id: "dm-service-director",
        name: "Jordan Lee",
        title: "Service Director",
        confidence: 88,
        status: "confirmed",
        isPrimary: true,
      },
    ],
    contactIntelligence: null,
    territoryContext: { label: "Grand Rapids, MI", reasons: ["State: MI"] },
    signals: [
      "Depot-to-field coordination is a real operational issue",
      "Field service stack: ServiceMax",
      "Confirmed depot-to-field coordination pain",
    ],
    openRisks: [
      {
        id: "incumbent-servicemax",
        label: "Incumbent vendor",
        priority: "High",
        reason: "ServiceMax already in use — switching risk must be handled carefully.",
        source: "research",
      },
      {
        id: "committee-gap",
        label: "Committee gap",
        priority: "Medium",
        reason: "Operations leadership not fully mapped.",
        source: "committee",
      },
    ],
    researchSummary: {
      summary: "Block Imaging struggles with depot-to-field handoffs.",
      pitchAngle: "Validate depot workflow bottleneck before proposing change.",
      confidence: 0.82,
      painSignals: ["Depot-to-field coordination pain", "Technician dispatch delays"],
      recommendedNextAction: "Validate depot workflow bottleneck in meeting.",
    },
    recommendedObjectives: [
      {
        objective: "Validate depot workflow bottleneck.",
        reasons: ["Confirmed on prior call"],
        evidence: ["Depot-to-field coordination is a real operational issue"],
        priority: 1,
      },
      {
        objective: "Increase trust with Service Director.",
        reasons: ["Relationship still early"],
        evidence: ["Meeting booked after workflow pain"],
        priority: 2,
      },
    ],
    readiness: {
      score: 82,
      label: "Ready",
      summary: "Strong context for Service Director workflow review.",
      missing: ["Finance stakeholder"],
    },
    accountPlaybookContext: null,
    videoEngagementContext: null,
  }
}

console.log(`[${GROWTH_AIOS_MEETING_INTELLIGENCE_1A_QA_MARKER}] Meeting Intelligence 1A certification\n`)

const types = readSource("lib/growth/meeting-intelligence/growth-canonical-meeting-brief-types.ts")
const builder = readSource("lib/growth/meeting-intelligence/growth-canonical-meeting-brief-builder.ts")
const service = readSource("lib/growth/meeting-intelligence/growth-canonical-meeting-brief-service.ts")
const prepContext = readSource("lib/growth/meeting-intelligence/meeting-prep-context.ts")
const prepTypes = readSource("lib/growth/meeting-intelligence/meeting-prep-types.ts")
const liveBuilder = readSource("lib/growth/operator-assist/call-workspace-aios-live-reasoning-builder.ts")
const liveService = readSource("lib/growth/operator-assist/call-workspace-aios-live-reasoning-service.ts")
const liveTypes = readSource("lib/growth/operator-assist/call-workspace-aios-live-reasoning-types.ts")
const decisionInput = readSource("lib/growth/aios/growth/growth-canonical-decision-engine-1a-input.ts")
const decisionResolver = readSource("lib/growth/aios/growth/resolve-growth-canonical-decision-for-lead.ts")
const prepPanel = readSource("components/growth/growth-meeting-prep-panel.tsx")

assert.ok(types.includes("GrowthCanonicalMeetingBrief"))
assert.ok(builder.includes("buildGrowthCanonicalMeetingBrief"))
assert.ok(service.includes("resolveGrowthCanonicalMeetingBriefForMeeting"))
assert.ok(prepContext.includes("resolveGrowthCanonicalMeetingBriefForMeeting"))
assert.ok(prepTypes.includes("canonicalMeetingBrief"))
assert.ok(liveBuilder.includes("meetingBrief"))
assert.ok(liveService.includes("resolveGrowthCanonicalMeetingBriefForMeeting"))
assert.ok(liveTypes.includes("meetingBrief"))
assert.ok(decisionInput.includes("meetingIntelligence"))
assert.ok(decisionResolver.includes("buildMeetingIntelligenceInputForDecisionEngine"))
assert.ok(prepPanel.includes("canonicalMeetingBrief"))
assert.ok(prepPanel.includes("Meeting battle plan"))

const decisionInputFixture = blockImagingDecisionInput()
const decision = buildGrowthCanonicalNextBestDecision(decisionInputFixture)
const canonicalDecision = {
  qaMarker: GROWTH_AIOS_CANONICAL_DECISION_ENGINE_1B_QA_MARKER,
  organizationId: ORG_ID,
  leadId: BLOCK_LEAD,
  generatedAt: decisionInputFixture.generatedAt,
  companyName: "Block Imaging",
  decision,
  operatorCard: projectCanonicalDecisionOperatorCard(decision),
  freshness: computeGrowthCanonicalDecisionFreshness({
    decision,
    materialEventAt: decisionInputFixture.generatedAt,
  }),
  suppressionHints: buildCanonicalDecisionSuppressionHints(decision),
  inputDegraded: [],
}

const prepBundle = blockImagingPrepBundle()
const brief = buildGrowthCanonicalMeetingBrief({
  generatedAt: "2026-07-13T22:00:00.000Z",
  prepBundle,
  salesStrategyBrief: null,
  leadMemory: {
    available: true,
    memoryCoverageScore: 0.8,
    relationshipStage: "early",
    relationshipSummary: "Early trust after workflow pain call.",
    engagementTrend: "warming",
    progressionScore: 0.55,
    topObjections: ["Already have software"],
    topPreferences: [],
    priorInteractionSummaries: ["Confirmed depot-to-field coordination pain"],
    commitmentSummaries: ["Send the depot-to-field workflow checklist by end of week"],
    riskFlags: [],
    avoidRepeating: [],
    committeeContext: ["Service Director engaged"],
    unresolvedObjectionCount: 1,
    unresolvedHighSeverityObjectionCount: 0,
  },
  relationshipAssessment: null,
  canonicalDecision,
  postCallClosure: null,
})

assert.equal(brief.qaMarker, GROWTH_AIOS_MEETING_INTELLIGENCE_1A_QA_MARKER)
assert.ok(/workflow|depot/i.test(brief.meetingObjective))
assert.ok(brief.agenda.length >= 5)
assert.ok(brief.agenda.some((step) => /workflow|discovery|commitment/i.test(step.step)))
assert.ok(brief.stakeholders.some((row) => /service director/i.test(row.role ?? row.name)))
assert.ok(brief.questionsToAsk.length > 0)
assert.ok(brief.commitmentsToVerify.some((row) => /checklist|depot|workflow/i.test(row.commitment)))
assert.ok(brief.evidenceToReference.some((row) => /depot|workflow|coordination/i.test(row)))
assert.ok(
  brief.competitiveConsiderations.some((row) => /servicemax|stack|incumbent/i.test(row)) ||
    brief.likelyObjections.some((row) => /software|incumbent|vendor/i.test(row.objection)),
)
assert.ok(brief.goals.businessObjective.length > 0)
assert.ok(brief.goals.relationshipObjective.length > 0)
assert.equal(brief.opportunityProgression.currentStage, "evaluation")

const liveStep0 = projectCanonicalMeetingBriefLiveContext(brief, 0)
const liveStep2 = projectCanonicalMeetingBriefLiveContext(brief, 2)
assert.ok(liveStep0.currentAgendaStep)
assert.notEqual(liveStep0.currentAgendaStep, liveStep2.currentAgendaStep)
assert.ok(liveStep2.questionToAskNext)

const meetingIntel = buildMeetingIntelligenceInputForDecisionEngine({
  hasUpcomingMeeting: true,
  buyingStage: "evaluation",
  recommendedNextAction: "Validate depot workflow bottleneck.",
  readinessScore: 82,
  readinessMissing: ["Finance stakeholder"],
  committeeCoverage: "Partial",
  canonicalDecision,
  postCallClosure: null,
})
assert.ok(meetingIntel)
assert.ok(meetingIntel!.opportunityProgression.mustHappenNext.length > 0)
assert.equal(decision.primaryAction, "prepare_meeting")

console.log("Wiring checks: PASS")
console.log("Block Imaging meeting objective: PASS")
console.log("Dynamic agenda: PASS")
console.log("Stakeholder intelligence: PASS")
console.log("Questions + commitments + evidence: PASS")
console.log("Competitive/objection prep: PASS")
console.log("Live agenda progression: PASS")
console.log("Decision Engine opportunity progression input: PASS")
console.log("\nGE-AIOS-MEETING-INTELLIGENCE-1A certification complete.")
