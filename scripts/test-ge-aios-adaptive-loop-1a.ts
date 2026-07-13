/**
 * GE-AIOS-ADAPTIVE-LOOP-1A — Continuous relationship & strategy evolution certification.
 * Run: pnpm test:ge-aios-adaptive-loop-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_ADAPTIVE_LOOP_1A_QA_MARKER,
} from "../lib/growth/aios/growth/growth-adaptive-loop-1a-types"
import {
  ADAPTIVE_NEGATIVE_PROSPECT_EVENTS,
  ADAPTIVE_POSITIVE_PROSPECT_EVENTS,
  applyAdaptiveLoopToOutreachPreparation,
  buildAdaptiveProspectEvent,
  evolveOutreachStrategyFromAdaptiveEvents,
} from "../lib/growth/aios/growth/growth-adaptive-loop-1a"
import {
  projectApprovals2AOperatorReviewPacket,
} from "../lib/growth/aios/approvals/approvals-operator-review-packet"
import { buildOutreachSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import { buildOutreachSellerTruth } from "../lib/growth/aios/growth/growth-outreach-seller-truth"
import { generateOutreachDraftsFromSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-strategy-drafts"
import { isAnsweredDiscoveryTheme } from "../lib/growth/aios/growth/growth-outreach-consultant-discovery-intelligence"
import { reviewHumanAuthenticity } from "../lib/growth/aios/growth/growth-outreach-elite-human-communication"
import { EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE } from "../lib/growth/business-profile/equipify-master-knowledge-canonical"
import type { BusinessProfileDraftContent } from "../lib/growth/business-profile/business-profile-types"
import type { GrowthAutonomousOutreachApprovalPackage } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"

const ROOT = process.cwd()
const BLOCK = "6d9220f0-2960-468c-b4be-5d7595d292c3"

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
        elevatorPitch: "Equipify helps service teams replace scattered handoffs with a clearer operating rhythm.",
        tone: "consultative",
        formality: "professional",
        emailLengthPreference: "short",
        ctaPreferences: ["15-minute workflow review"],
        wordsToAvoid: ["synergy"],
        neverSay: ["guaranteed ROI"],
      },
      positioning: {
        competitiveAdvantages: ["Built for equipment-centric operators"],
        pricingPhilosophy: "Value over discounting",
        neverCompeteOnPrice: true,
        competitorNotes: [],
      },
      salesPhilosophy: {
        qualificationStandards: [],
        discoveryQuestions: ["How do you coordinate depot and field work today?"],
        disqualifiers: [],
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

const blockEvidence = [
  "Verified description (82%): Block Imaging is a global diagnostic imaging company specializing in MRI and CT refurbished systems.",
  "Service indicator: MRI / CT refurbished systems",
  "Combines depot and field service operations.",
]

console.log(`[${GROWTH_AIOS_ADAPTIVE_LOOP_1A_QA_MARKER}] Adaptive loop certification\n`)

const adaptiveSource = readSource("lib/growth/aios/growth/growth-adaptive-loop-1a.ts")
const draftServiceSource = readSource(
  "lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts",
)
const packetSource = readSource("lib/growth/aios/approvals/approvals-operator-review-packet.ts")

assert.ok(adaptiveSource.includes("applyAdaptiveLoopToOutreachPreparation"))
assert.ok(adaptiveSource.includes("buildRelationshipAssessment"))
assert.ok(adaptiveSource.includes("enrichOutreachSalesStrategyBrief"))
assert.ok(draftServiceSource.includes("applyAdaptiveLoopToOutreachPreparation"))
assert.ok(packetSource.includes("adaptiveLoopEssentials"))
assert.ok(!/new memory system|duplicate relationship store/i.test(adaptiveSource))
assert.equal(ADAPTIVE_POSITIVE_PROSPECT_EVENTS.length, 9)
assert.equal(ADAPTIVE_NEGATIVE_PROSPECT_EVENTS.length, 8)
console.log("  ✓ Adaptive loop reuses existing pipeline — no duplicate engines")

const profile = sampleProfile()
const sellerTruth = buildOutreachSellerTruth({
  profile,
  profileId: "profile-1",
  prospectTitle: "President",
  prospectIndustry: "Medical Imaging",
})

const coldBrief = buildOutreachSalesStrategyBrief({
  leadId: BLOCK,
  companyName: "Block Imaging",
  preparedAt: "2026-07-13T24:00:00.000Z",
  website: "https://blockimaging.com",
  contactName: "Josh Block",
  contactTitle: "President",
  equipmentServiced: ["MRI", "CT"],
  verifiedEvidence: blockEvidence,
  sellerTruth,
  approvedProfile: profile,
  relationshipStrengthTier: "cold",
  opportunityReadinessScore: 62,
  decisionMakers: [{ name: "Josh Block", title: "President", isPrimary: true }],
  buyingCommitteeSnapshot: {
    hasVerifiedCommittee: false,
    discoveryPending: true,
    discoveryFailed: false,
    singleThreadRisk: true,
    coverageScore: 0.2,
    rolesPresent: [],
    rolesMissing: ["champion", "economic_buyer"],
    verifiedMemberCount: 1,
  },
  communicationChannelHint: "email",
})

const coldRecommendation = coldBrief.revenueStrategyIntelligence?.recommendation ?? "research"
const coldGoal = coldBrief.relationshipAssessment?.relationshipGoal.current ?? "build_credibility"
const coldDrafts = generateOutreachDraftsFromSalesStrategyBrief({ brief: coldBrief, senderName: "Ava" })

const baseContext = {
  priorTouchCount: 1,
  priorReplyCount: 0,
  priorOutboundSubjects: ["Block Imaging imaging service ops"],
  objectionSummaries: [],
  priorReplySummaries: [],
  sequenceHistorySummaries: [],
  memoryOpenLoopSummaries: [],
  buyingIntent: null,
  competitorPressure: null,
}

const baseLead = {
  relationshipStrengthTier: "cold",
  hasMeetingScheduled: false,
  isCustomer: false,
  isSuppressed: false,
}

const events = [
  buildAdaptiveProspectEvent({
    type: "reply_received",
    occurredAt: "2026-07-14T10:00:00.000Z",
    summary: "Josh replied about depot dispatch coordination.",
    detail: "Depot turnaround is harder to predict as volume shifts.",
  }),
  buildAdaptiveProspectEvent({
    type: "already_have_software",
    occurredAt: "2026-07-14T10:05:00.000Z",
    summary: "Operations objection — incumbent software in place.",
    detail: "We already have software for dispatch.",
  }),
  buildAdaptiveProspectEvent({
    type: "champion_identified",
    occurredAt: "2026-07-15T09:00:00.000Z",
    summary: "Service Director emerging as champion.",
    detail: "Service Director wants cleaner field-to-office handoffs.",
  }),
  buildAdaptiveProspectEvent({
    type: "buying_committee_expansion",
    occurredAt: "2026-07-16T11:00:00.000Z",
    summary: "Committee expanded with operations and finance.",
    detail: "Operations leader and finance controller added to thread.",
  }),
  buildAdaptiveProspectEvent({
    type: "meeting_booked",
    occurredAt: "2026-07-17T14:00:00.000Z",
    summary: "15-minute workflow review booked.",
    detail: "Meeting booked for next Tuesday.",
  }),
]

const evolved = evolveOutreachStrategyFromAdaptiveEvents({
  baseBrief: coldBrief,
  events,
  memory: null,
  context: baseContext,
  lead: baseLead,
  committee: coldBrief.revenueStrategyIntelligence
    ? {
        hasVerifiedCommittee: false,
        discoveryPending: true,
        discoveryFailed: false,
        singleThreadRisk: true,
        coverageScore: 0.2,
        rolesPresent: [],
        rolesMissing: ["champion", "economic_buyer"],
        verifiedMemberCount: 1,
      }
    : null,
  assessmentInput: {
    leadId: BLOCK,
    companyName: "Block Imaging",
    preparedAt: "2026-07-17T15:00:00.000Z",
    previousRecommendation: coldRecommendation,
    previousConfidence: coldBrief.revenueStrategyIntelligence?.confidenceScore ?? null,
  },
  learningWeights: [{ themeKey: "depot_coordination", replyRatePct: 18, sends: 24 }],
  enrichInput: {
    approvedProfile: profile,
    website: "https://blockimaging.com",
    contactTitle: "President",
    equipmentServiced: ["MRI", "CT"],
    decisionMakers: [{ name: "Josh Block", title: "President", isPrimary: true }],
    buyingCommitteeSnapshot: {
      hasVerifiedCommittee: true,
      discoveryPending: false,
      discoveryFailed: false,
      singleThreadRisk: false,
      coverageScore: 0.68,
      rolesPresent: ["champion", "economic_buyer"],
      rolesMissing: [],
      verifiedMemberCount: 3,
    },
    communicationChannelHint: "email",
  },
})

const warmBrief = evolved.brief
assert.ok(warmBrief.relationshipAssessment?.available)
assert.ok(warmBrief.relationshipAssessment!.relationshipStory.summary.length > 40)
assert.ok(warmBrief.relationshipAssessment!.relationshipStory.sections.length >= 3)
assert.notEqual(warmBrief.relationshipAssessment!.relationshipGoal.current, coldGoal)
console.log("  ✓ Block Imaging relationship story evolves across simulated events")

const warmRecommendation = warmBrief.revenueStrategyIntelligence?.recommendation
assert.ok(warmRecommendation)
assert.ok(warmBrief.adaptiveLoopEvolution?.strategyChange.meaningfulChanges.length)
console.log(
  `  ✓ Revenue strategy adapts (${coldRecommendation} → ${warmRecommendation})`,
)

const warmDrafts = generateOutreachDraftsFromSalesStrategyBrief({ brief: warmBrief, senderName: "Ava" })
assert.notEqual(warmDrafts.email.body.slice(0, 80), coldDrafts.email.body.slice(0, 80))
assert.ok(warmBrief.consultantDiscoveryIntelligence)
const answered = warmBrief.relationshipAssessment?.answeredThemes ?? []
assert.ok(answered.length > 0)
for (const row of warmBrief.consultantDiscoveryIntelligence!.rankedDiscoveryQuestions) {
  assert.equal(isAnsweredDiscoveryTheme(row.question, answered), false)
}
assert.equal(reviewHumanAuthenticity(warmDrafts.email.full, "Block Imaging").length, 0)
console.log("  ✓ Conversation strategy and drafts adapt — constitution holds")

const pkg: GrowthAutonomousOutreachApprovalPackage = {
  packageId: `outreach-prep:${BLOCK}:2026-07-17T15:00:00.000Z`,
  leadId: BLOCK,
  companyName: "Block Imaging",
  preparedAt: "2026-07-17T15:00:00.000Z",
  generatedAssets: [],
  salesStrategyBrief: warmBrief,
  draftQuality: { emailWordCount: 0, emailReadTimeSeconds: 0, smsCharacterCount: 0, qualityFailures: [] },
  personalizationEvidence: [],
  supportingResearch: blockEvidence,
  confidence: warmBrief.confidence,
  approvalRequirements: ["operator_outbound_approval"],
  complianceNotes: [],
  recommendedChannel: "email",
  recommendedSequence: "email_first_multichannel",
  expectedOutcome: warmBrief.businessObjective,
  pendingHumanApproval: true,
  transportBlocked: true,
}

const packet = projectApprovals2AOperatorReviewPacket({ pkg, teammateName: "Ava" })
assert.ok(packet.operatorReviewLayout.adaptiveLoopEssentials.length >= 3)
assert.ok(packet.operatorReviewLayout.relationshipStrategyEssentials.some((line) => /changed because/i.test(line)))
assert.ok(packet.operatorReviewLayout.relationshipStrategyEssentials.some((line) => /Story:/i.test(line)))
assert.ok(packetSource.includes("adaptiveLoopEssentials"))
console.log("  ✓ Operator review surfaces relationship change + previous/current strategy")

const objectionOnly = applyAdaptiveLoopToOutreachPreparation({
  events: [
    buildAdaptiveProspectEvent({
      type: "ghosting",
      occurredAt: "2026-07-18T10:00:00.000Z",
      summary: "No reply after follow-up.",
    }),
  ],
  memory: evolved.evolution.relationshipAssessment.available
    ? {
        available: true,
        memoryCoverageScore: 60,
        relationshipStage: "engaged",
        relationshipSummary: "Prior engagement on depot coordination.",
        engagementTrend: "stable",
        progressionScore: 0.5,
        topObjections: [],
        topPreferences: [],
        priorInteractionSummaries: ["Josh replied about depot dispatch coordination."],
        commitmentSummaries: [],
        riskFlags: [],
        avoidRepeating: [],
        committeeContext: [],
        unresolvedObjectionCount: 0,
        unresolvedHighSeverityObjectionCount: 0,
      }
    : null,
  context: {
    ...baseContext,
    priorReplyCount: 1,
    priorReplySummaries: ["Josh replied about depot dispatch coordination."],
  },
  lead: { ...baseLead, relationshipTrend: "warming" },
  committee: {
    hasVerifiedCommittee: true,
    discoveryPending: false,
    discoveryFailed: false,
    singleThreadRisk: false,
    coverageScore: 0.6,
    rolesPresent: ["champion"],
    rolesMissing: ["economic_buyer"],
    verifiedMemberCount: 2,
  },
  assessmentInput: {
    leadId: BLOCK,
    companyName: "Block Imaging",
    preparedAt: "2026-07-18T10:00:00.000Z",
    previousRecommendation: warmRecommendation,
    previousConfidence: warmBrief.revenueStrategyIntelligence?.confidenceScore ?? null,
  },
  previousAssessment: warmBrief.relationshipAssessment,
  previousRevenue: warmBrief.revenueStrategyIntelligence,
})

assert.ok(
  objectionOnly.relationshipAssessment.relationshipMomentum.trend === "stalling" ||
    objectionOnly.relationshipAssessment.relationshipMomentum.trend === "reversing" ||
    objectionOnly.relationshipAssessment.relationshipProtection.active,
)
console.log("  ✓ Negative events cool momentum / activate protection")

console.log("\nGE-AIOS-ADAPTIVE-LOOP-1A certification passed.")
