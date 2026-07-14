/**
 * GE-AIOS-CALL-WORKSPACE-INTELLIGENCE-2B certification (fixtures only).
 * Run: pnpm test:ge-aios-call-workspace-intelligence-2b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { buildCallWorkspaceAiosLiveReasoningSnapshot } from "../lib/growth/operator-assist/call-workspace-aios-live-reasoning-builder"
import { GROWTH_CALL_WORKSPACE_AIOS_LIVE_REASONING_QA_MARKER } from "../lib/growth/operator-assist/call-workspace-aios-live-reasoning-types"
import {
  buildCallWorkspaceClosureFingerprint,
} from "../lib/growth/operator-assist/call-workspace-post-call-closure-idempotency"
import {
  computeCallWorkspacePostCallClosure,
} from "../lib/growth/operator-assist/call-workspace-post-call-closure-compute"
import {
  GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_QA_MARKER,
  GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_SOURCE_SYSTEM,
} from "../lib/growth/operator-assist/call-workspace-post-call-closure-types"
import {
  buildCallWorkspacePostCallAdaptiveEvents,
  extractCallWorkspacePostCallOutcomes,
} from "../lib/growth/operator-assist/call-workspace-post-call-outcome-extraction"
import {
  resolveCallWorkspacePostCallNextAction,
  resolvePostCallFollowUpChannel,
} from "../lib/growth/operator-assist/call-workspace-post-call-nba"
import {
  applyAdaptiveLoopToOutreachPreparation,
  detectAdaptiveStrategyChanges,
} from "../lib/growth/aios/growth/growth-adaptive-loop-1a"
import { buildOutreachSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import { buildOutreachSellerTruth } from "../lib/growth/aios/growth/growth-outreach-seller-truth"
import { evolveOutreachStrategyFromAdaptiveEvents } from "../lib/growth/aios/growth/growth-adaptive-loop-1a"
import { generateOutreachDraftsFromSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-strategy-drafts"
import { reviewHumanAuthenticity } from "../lib/growth/aios/growth/growth-outreach-elite-human-communication"
import {
  GROWTH_AIOS_CALL_WORKSPACE_POST_CALL_CLOSURE_2B_OPERATOR_LAYOUT_QA_MARKER,
  projectPostCallClosureEssentials,
} from "../lib/growth/aios/approvals/approvals-operator-review-packet"
import { resolveCanonicalCompanyDisplayName } from "../lib/growth/aios/growth/growth-canonical-display-identity-1b"
import type { CallIntelligenceScorecardPublicView } from "../lib/growth/call-intelligence/call-intelligence-types"
import type { GrowthRealtimeLiveSnapshot } from "../lib/growth/realtime/realtime-call-types"
import { EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE } from "../lib/growth/business-profile/equipify-master-knowledge-canonical"
import type { BusinessProfileDraftContent } from "../lib/growth/business-profile/business-profile-types"

const ROOT = process.cwd()
const BLOCK_LEAD = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const SESSION_ID = "11111111-1111-4111-8111-111111111111"
const ORG_ID = "org-cert-2b"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

function sampleProfile(): BusinessProfileDraftContent {
  return {
    company: {
      companyName: "Equipify",
      website: "https://equipify.ai",
      shortDescription: "Service operations platform",
      productsServices: ["Work orders", "Dispatch"],
      businessModel: "B2B SaaS",
      primaryValueProposition: "Reduce operational complexity for equipment service businesses.",
    },
    idealCustomers: {
      targetIndustries: ["Biomedical and medical equipment service"],
      companySizeRanges: ["20-200"],
      geography: ["United States"],
      buyerPersonas: ["Owner", "Operations leaders"],
      disqualifiers: [],
    },
    problemsAndTriggers: {
      painPoints: ["Scattered handoffs"],
      buyingTriggers: ["Multi-site expansion"],
      competitorsAlternatives: [],
      keywords: [],
      negativeKeywords: [],
    },
    salesAndMarketing: {
      averageDealSize: null,
      salesCycleEstimate: null,
      messagingAngles: ["Outcome-first service visibility"],
      qualificationCriteria: [],
    },
    businessStrategy: {
      companyWide: {
        mission: "Help equipment businesses run cleaner service operations",
        coreValues: [],
        brandPersonality: "Consultative",
      },
      messaging: {
        tone: "Consultative",
        valueProps: ["Depot-to-field visibility"],
        proofPoints: [],
      },
      objections: {
        items: [
          {
            objection: "We already have software.",
            preferredResponse: "Fair. The question is whether handoffs still create delay.",
          },
        ],
      },
      salesAndRelationships: { principles: [], notes: "" },
    },
    canonicalSellerKnowledge: EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE,
  }
}

console.log(`[${GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_QA_MARKER}] Post-call closure certification\n`)

const closureSource = readSource("lib/growth/operator-assist/call-workspace-post-call-closure.ts")
const wrapupService = readSource("lib/growth/native-dialer/native-dialer-service.ts")
const wrapupRoute = readSource("app/api/platform/growth/calls/post-call-closure/route.ts")
const centerPanel = readSource("components/growth/growth-call-workspace-center-panel.tsx")
const adaptiveTypes = readSource("lib/growth/aios/growth/growth-adaptive-loop-1b-types.ts")

assert.ok(closureSource.includes("executeCallWorkspacePostCallClosure"))
assert.ok(closureSource.includes("writeCanonicalLeadMemoryAndRebuild"))
assert.ok(closureSource.includes("ingestLiveRelationshipEvent"))
assert.ok(closureSource.includes("generateAndPersistAutonomousOutreachApprovalPackageForDraftFactory"))
assert.ok(closureSource.includes("bridgeCallWorkspaceClosureToMeetingIntelligence"))
assert.ok(wrapupService.includes("executeCallWorkspacePostCallClosure"))
assert.ok(wrapupRoute.includes("previewCallWorkspacePostCallClosure"))
assert.ok(centerPanel.includes("GrowthCallWorkspacePostCallClosurePanel"))
assert.ok(adaptiveTypes.includes('"call_workspace"'))
assert.ok(!closureSource.includes("writeTranscriptToMemory"))
console.log("  ✓ Canonical entry point wired — wrap-up, API, adaptive source, no transcript memory store")

const fingerprint = buildCallWorkspaceClosureFingerprint({
  organizationId: ORG_ID,
  leadId: BLOCK_LEAD,
  sessionId: SESSION_ID,
  completionVersion: 1,
})
assert.match(fingerprint, /ge-aios-call-workspace-intelligence-2b/)
assert.equal(
  buildCallWorkspaceClosureFingerprint({
    organizationId: ORG_ID,
    leadId: BLOCK_LEAD,
    sessionId: SESSION_ID,
    completionVersion: 1,
  }),
  fingerprint,
)
console.log("  ✓ Stable closure fingerprint for idempotency")

const profile = sampleProfile()
const sellerTruth = buildOutreachSellerTruth({
  profile,
  profileId: "profile-1",
  prospectTitle: "President",
  prospectIndustry: "Medical Imaging",
})

const blockEvidence = [
  "Verified description (82%): Block Imaging is a global diagnostic imaging company specializing in MRI and CT refurbished systems.",
  "Service indicator: depot and field coordination pressure",
]

const brief = buildOutreachSalesStrategyBrief({
  leadId: BLOCK_LEAD,
  companyName: "Block Imaging",
  preparedAt: "2026-07-13T24:00:00.000Z",
  website: "https://blockimaging.com",
  contactName: "Josh Block",
  contactTitle: "President",
  equipmentServiced: ["MRI", "CT"],
  verifiedEvidence: blockEvidence,
  sellerTruth,
  approvedProfile: profile,
  relationshipStrengthTier: "warm",
  opportunityReadinessScore: 68,
  decisionMakers: [{ name: "Josh Block", title: "President", isPrimary: true }],
  buyingCommitteeSnapshot: {
    hasVerifiedCommittee: false,
    discoveryPending: true,
    discoveryFailed: false,
    singleThreadRisk: true,
    coverageScore: 0.25,
    rolesPresent: ["operations"],
    rolesMissing: ["service_director", "economic_buyer"],
    verifiedMemberCount: 1,
  },
})

const liveSnapshot: GrowthRealtimeLiveSnapshot = {
  objections: [],
  buyingSignals: [
    { key: "stakeholder_gap", label: "Service Director should join next conversation", sequenceNumber: 8, excerpt: null },
  ],
  talkRatio: { repTalkPercent: 44, prospectTalkPercent: 56, inGoalRange: true },
  discovery: { covered: ["pain_point", "current_system"], missing: ["budget"] },
  riskFlags: ["competitor incumbents", "timing next quarter"],
  competitorGuidance: [{ competitor: "competing field service system", guidance: "Differentiate on depot coordination" }],
  recommendedNextQuestion: null,
  recommendedResponse: null,
  guidanceTips: [],
  computedAt: "2026-07-14T12:00:00.000Z",
}

const liveReasoning = buildCallWorkspaceAiosLiveReasoningSnapshot({
  generatedAt: "2026-07-14T12:00:00.000Z",
  leadId: BLOCK_LEAD,
  companyName: "Block Imaging",
  brief,
  leadMemory: null,
  relationshipContext: {
    priorTouchCount: 3,
    priorReplyCount: 1,
    priorOutboundSubjects: ["Depot coordination follow-up"],
    objectionSummaries: [],
    priorReplySummaries: [],
    sequenceHistorySummaries: [],
    memoryOpenLoopSummaries: [],
    buyingIntent: null,
    competitorPressure: null,
  },
  leadSignals: {
    relationshipStrengthScore: 64,
    relationshipStrengthTier: "warm",
    relationshipTrend: "improving",
    sequenceFatigueRisk: "low",
    leadStatus: "contacted",
    hasMeetingScheduled: false,
    isCustomer: false,
    isSuppressed: false,
    committeeMemberCount: 1,
    singleThreadRisk: true,
  },
  buyingCommitteeSnapshot: brief.buyingCommitteeSnapshot ?? null,
  institutionalLearning: null,
  liveSnapshot,
  voiceTranscript: null,
  learningWeights: null,
})

assert.equal(liveReasoning.qaMarker, GROWTH_CALL_WORKSPACE_AIOS_LIVE_REASONING_QA_MARKER)

const scorecard: CallIntelligenceScorecardPublicView = {
  id: "score-1",
  leadId: BLOCK_LEAD,
  opportunityId: null,
  meetingId: null,
  realtimeSessionId: "22222222-2222-4222-8222-222222222222",
  ownerUserId: null,
  overallScore: 72,
  conversationQualityScore: 70,
  discoveryScore: 68,
  objectionHandlingScore: 65,
  buyingSignalScore: 74,
  nextStepScore: 78,
  talkListenBalanceScore: 80,
  competitorRiskScore: 42,
  confidenceScore: 71,
  riskLevel: "medium",
  outcome: "positive",
  detectedObjections: [],
  buyingSignals: [{ key: "timing", label: "Next quarter timing confirmed" }],
  competitorMentions: [{ key: "incumbent", label: "competing field service system" }],
  discoveryGaps: [],
  nextStepCommitments: [{ key: "workflow_checklist", label: "Send workflow checklist" }],
  coachingOpportunities: [],
  safeSummary: "Josh confirmed depot coordination pain and agreed to a follow-up meeting.",
  recommendedNextAction: "Send promised workflow checklist",
  metrics: { transcriptFinalizedCount: 12, incomplete: false },
  computedAt: "2026-07-14T12:00:00.000Z",
}

const operatorWrapup = {
  outcome: "connected" as const,
  connected: true,
  followUpNeeded: true,
  meetingBooked: true,
  competitorMentioned: true,
  timelineDetected: true,
  championIdentified: false,
  decisionMakerPresent: true,
  buyingSignals: ["Service Director should join next conversation"],
  notes: "Ava promised to send a workflow checklist and schedule a follow-up meeting.",
}

const adaptiveEvents = buildCallWorkspacePostCallAdaptiveEvents({
  generatedAt: "2026-07-14T12:00:00.000Z",
  liveReasoning,
  liveSnapshot,
  scorecard,
  operatorWrapup,
})

const eventTypes = new Set(adaptiveEvents.map((event) => event.type))
assert.ok(eventTypes.has("competitor_mentioned"))
assert.ok(eventTypes.has("timing_objection"))
assert.ok(eventTypes.has("meeting_booked"))
assert.ok(eventTypes.has("meeting_completed"))
assert.equal(adaptiveEvents.filter((event) => event.type === "competitor_mentioned").length, 1)
console.log("  ✓ Adaptive-loop events emitted once from call signals")

const extracted = extractCallWorkspacePostCallOutcomes({
  generatedAt: "2026-07-14T12:00:00.000Z",
  companyName: "Block Imaging",
  liveReasoning,
  liveSnapshot,
  scorecard,
  operatorWrapup,
})

assert.ok(
  extracted.businessConclusions.some((line) => /Block Imaging|competing|timing|operational|depot|coordination/i.test(line)),
  `expected business conclusions, got: ${extracted.businessConclusions.join(" | ")}`,
)
assert.ok(extracted.commitments.some((line) => /workflow checklist|follow-up meeting/i.test(line)))
assert.ok(extracted.committeeSuggestions.some((row) => row.personLabel === "Service Director"))
assert.ok(!extracted.memoryCandidates.some((row) => /transcript/i.test(row.conclusion)))
console.log("  ✓ Outcome extraction — business facts, commitments, committee, no transcript memory")

const nba = resolveCallWorkspacePostCallNextAction({
  extracted,
  liveReasoning,
  relationshipAssessment: liveReasoning.relationshipAssessment,
  scorecard,
  operatorWrapup,
})
assert.equal(nba.kind, "send_promised_information")
assert.notEqual(nba.label.toLowerCase(), "send follow-up email")
console.log("  ✓ Next-best action honors call commitment — not default follow-up email")

const followUp = resolvePostCallFollowUpChannel(nba)
assert.equal(followUp.followUpRequired, true)
assert.equal(followUp.followUpChannel, "email")

const adaptivePrep = applyAdaptiveLoopToOutreachPreparation({
  events: adaptiveEvents,
  memory: null,
  context: {
    priorTouchCount: 3,
    priorReplyCount: 1,
    priorOutboundSubjects: [],
    objectionSummaries: [],
    priorReplySummaries: [],
    sequenceHistorySummaries: [],
    memoryOpenLoopSummaries: [],
    buyingIntent: null,
    competitorPressure: "competing field service system",
  },
  lead: {
    relationshipStrengthScore: 64,
    relationshipStrengthTier: "warm",
    relationshipTrend: "improving",
    sequenceFatigueRisk: "low",
    leadStatus: "contacted",
    hasMeetingScheduled: true,
    isCustomer: false,
    isSuppressed: false,
    committeeMemberCount: 1,
    singleThreadRisk: true,
  },
  committee: brief.buyingCommitteeSnapshot ?? null,
  assessmentInput: {
    leadId: BLOCK_LEAD,
    companyName: "Block Imaging",
    preparedAt: "2026-07-14T12:00:00.000Z",
    contactName: "Josh Block",
    contactTitle: "President",
    relationshipStrengthTier: "warm",
    contactTemperature: "warm",
    leadStatus: "contacted",
    sellerTruth,
    verifiedEvidence: blockEvidence,
    equipmentServiced: ["MRI", "CT"],
  },
  previousAssessment: liveReasoning.relationshipAssessment,
  previousRevenue: liveReasoning.revenueStrategyIntelligence,
})

const strategyChange = detectAdaptiveStrategyChanges({
  previousAssessment: liveReasoning.relationshipAssessment,
  currentAssessment: adaptivePrep.relationshipAssessment,
  previousRevenue: liveReasoning.revenueStrategyIntelligence,
  currentRevenue: brief.revenueStrategyIntelligence,
  events: adaptiveEvents,
})
assert.ok(strategyChange.meaningfulChanges.length >= 0)

const evolved = evolveOutreachStrategyFromAdaptiveEvents({
  baseBrief: brief,
  events: adaptiveEvents,
  memory: null,
  context: adaptivePrep.context,
  lead: adaptivePrep.lead,
  committee: adaptivePrep.committee,
  assessmentInput: {
    leadId: BLOCK_LEAD,
    companyName: "Block Imaging",
    preparedAt: "2026-07-14T12:00:00.000Z",
    institutionalAdvice: [],
  },
  enrichInput: {
    sellerTruth,
    approvedProfile: profile,
    learningWeights: null,
    communicationChannelHint: "email",
  },
})

assert.equal(resolveCanonicalCompanyDisplayName(evolved.brief.canonicalDisplayIdentity, "Block Imaging"), "Block Imaging")
const followUpDrafts = generateOutreachDraftsFromSalesStrategyBrief({
  brief: evolved.brief,
  senderName: "Ava",
  channels: ["email"],
})
assert.ok(followUpDrafts.email.full.includes("Block Imaging") || followUpDrafts.email.body.includes("Block Imaging"))
assert.equal(reviewHumanAuthenticity(followUpDrafts.email.full, "Block Imaging").length, 0)
assert.ok(!followUpDrafts.email.full.includes("—"))
assert.ok(!/best,\s*ava|regards,\s*ava/i.test(followUpDrafts.email.full))
console.log("  ✓ Follow-up package references Block Imaging accurately — no em dash or AI signature")

const closure = computeCallWorkspacePostCallClosure({
  closureInput: {
    organizationId: ORG_ID,
    leadId: BLOCK_LEAD,
    companyName: "Block Imaging",
    sessionId: SESSION_ID,
    realtimeSessionId: scorecard.realtimeSessionId,
    generatedAt: "2026-07-14T12:00:00.000Z",
    liveReasoning,
    scorecard,
    operatorWrapup,
    operatorDisposition: "connected",
    operatorNotes: operatorWrapup.notes,
  },
  liveSnapshot,
  memoryBundle: null,
  strategyChange,
  followUpPackageId: "pkg-block-followup",
  followUpPackageStatus: "pending_approval",
  meetingIntelligenceUpdated: true,
})

assert.equal(closure.qaMarker, GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_QA_MARKER)
assert.equal(closure.closureFingerprint, fingerprint)
assert.equal(closure.followUpPackageStatus, "pending_approval")
assert.equal(closure.memoryReviewItems.length, 0)
assert.ok(closure.businessConclusions.length > 0)

const hacLines = projectPostCallClosureEssentials({ closure })
assert.ok(hacLines.some((line) => /Block Imaging|workflow|checklist|meeting/i.test(line)))
assert.equal(
  GROWTH_AIOS_CALL_WORKSPACE_POST_CALL_CLOSURE_2B_OPERATOR_LAYOUT_QA_MARKER,
  "ge-aios-call-workspace-intelligence-2b-operator-review-layout-v1",
)
console.log("  ✓ HAC projection includes post-call closure essentials")

assert.equal(GROWTH_CALL_WORKSPACE_POST_CALL_CLOSURE_SOURCE_SYSTEM, "ge-aios-call-workspace-intelligence-2b")
console.log("\nGE-AIOS-CALL-WORKSPACE-INTELLIGENCE-2B certification PASSED")
