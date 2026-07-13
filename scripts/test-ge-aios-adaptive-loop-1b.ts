/**
 * GE-AIOS-ADAPTIVE-LOOP-1B — Live relationship event ingestion certification.
 * Run: pnpm test:ge-aios-adaptive-loop-1b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  applyAdaptiveLoopToOutreachPreparation,
  buildAdaptiveProspectEvent,
  evolveOutreachStrategyFromAdaptiveEvents,
} from "../lib/growth/aios/growth/growth-adaptive-loop-1a"
import {
  GROWTH_AIOS_ADAPTIVE_LOOP_1B_QA_MARKER,
  GROWTH_AIOS_ADAPTIVE_LOOP_1B_RELATIONSHIP_WAKE_CONDITION,
} from "../lib/growth/aios/growth/growth-adaptive-loop-1b-types"
import {
  isNeverRebuildAloneSource,
  isRelationshipMaterialChange,
} from "../lib/growth/aios/growth/growth-adaptive-loop-1b-material-change"
import {
  mapBuyingCommitteeRoleChangeToAdaptiveProspectEvent,
  mapMeetingStatusToAdaptiveProspectEvent,
  mapReplyIntentToAdaptiveProspectEvent,
} from "../lib/growth/aios/growth/growth-adaptive-loop-1b-event-mappers"
import { projectApprovals2AOperatorReviewPacket } from "../lib/growth/aios/approvals/approvals-operator-review-packet"
import { buildOutreachSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import { buildOutreachSellerTruth } from "../lib/growth/aios/growth/growth-outreach-seller-truth"
import { generateOutreachDraftsFromSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-strategy-drafts"
import { isAnsweredDiscoveryTheme } from "../lib/growth/aios/growth/growth-outreach-consultant-discovery-intelligence"
import { reviewHumanAuthenticity } from "../lib/growth/aios/growth/growth-outreach-elite-human-communication"
import { mergeOperatorAssetStateFromPreviousPackage } from "../lib/growth/aios/growth/growth-send-plane-1b-operator-approval-persistence"
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

console.log(`[${GROWTH_AIOS_ADAPTIVE_LOOP_1B_QA_MARKER}] Live ingestion certification\n`)

const ingestionSource = readSource("lib/growth/aios/growth/growth-adaptive-loop-1b-live-ingestion.ts")
const finalizeSource = readSource("lib/growth/replies/finalize-ingested-reply-intelligence.ts")
const meetingSource = readSource("lib/growth/meeting-intelligence/mutate-meeting.ts")
const committeeSource = readSource(
  "lib/growth/buying-committee-intelligence/buying-committee-intelligence-orchestrator.ts",
)
const draftServiceSource = readSource(
  "lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts",
)
const processEventSource = readSource("lib/growth/outbound/process-event.ts")

assert.ok(ingestionSource.includes("ingestLiveRelationshipEvent"))
assert.ok(ingestionSource.includes("advanceDraftFactoryForLeadLive"))
assert.ok(ingestionSource.includes("recordCanonicalRelationshipEvent"))
assert.ok(finalizeSource.includes("ingestLiveRelationshipEvent"))
assert.ok(finalizeSource.includes("mapReplyIntentToAdaptiveProspectEvent"))
assert.ok(meetingSource.includes("ingestLiveRelationshipEvent"))
assert.ok(committeeSource.includes("ingestBuyingCommitteePromotionForCompany"))
assert.ok(draftServiceSource.includes("loadPendingAdaptiveEventsForLead"))
assert.ok(processEventSource.includes("ingestOutboundEngagementRelationshipEvent"))
assert.ok(!/new event bus|duplicate webhook|parallel memory/i.test(ingestionSource))
console.log("  ✓ Live ingestion wired into reply, meeting, committee, outbound, Growth 5F")

assert.equal(isRelationshipMaterialChange({ eventType: "reply_received" }), true)
assert.equal(isRelationshipMaterialChange({ eventType: "pricing_discussion" }), true)
assert.equal(isRelationshipMaterialChange({ eventType: "champion_identified" }), true)
assert.equal(
  isRelationshipMaterialChange({
    eventType: "company_research_updated",
    context: { researchDeltaScore: 0.2 },
  }),
  false,
)
assert.equal(
  isRelationshipMaterialChange({
    eventType: "company_research_updated",
    context: { researchDeltaScore: 0.55 },
  }),
  true,
)
assert.equal(isNeverRebuildAloneSource("email_delivered"), true)
assert.equal(
  isRelationshipMaterialChange({
    eventType: "reply_received",
    neverRebuildAloneSource: "email_delivered",
  }),
  false,
)
console.log("  ✓ Material-change decision logic — always, conditional, never-alone")

const profile = sampleProfile()
const sellerTruth = buildOutreachSellerTruth({
  profile,
  profileId: "profile-1",
  prospectTitle: "President",
  prospectIndustry: "Medical Imaging",
})

const blockEvidence = [
  "Verified description (82%): Block Imaging is a global diagnostic imaging company specializing in MRI and CT refurbished systems.",
  "Service indicator: MRI / CT refurbished systems",
  "Combines depot and field service operations.",
]

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
const coldDrafts = generateOutreachDraftsFromSalesStrategyBrief({ brief: coldBrief, senderName: "Ava" })

const liveEvents = [
  mapReplyIntentToAdaptiveProspectEvent({
    intent: "positive_interest",
    occurredAt: "2026-07-14T10:00:00.000Z",
    bodyPreview: "Thanks for reaching out. Can you tell me more about dispatch coordination?",
  })!,
  mapReplyIntentToAdaptiveProspectEvent({
    intent: "objection",
    occurredAt: "2026-07-14T11:00:00.000Z",
    bodyPreview: "We already have software for dispatch.",
  })!,
  buildAdaptiveProspectEvent({
    type: "champion_identified",
    occurredAt: "2026-07-14T12:00:00.000Z",
    summary: "Operations manager emerging as champion",
    detail: "Ops lead asked detailed workflow questions.",
  }),
  mapBuyingCommitteeRoleChangeToAdaptiveProspectEvent({
    committeeRole: "champion",
    change: "appeared",
    personLabel: "Operations Manager",
    occurredAt: "2026-07-14T12:30:00.000Z",
  })!,
  mapMeetingStatusToAdaptiveProspectEvent({
    status: "scheduled",
    occurredAt: "2026-07-14T13:00:00.000Z",
    companyName: "Block Imaging",
  })!,
  mapReplyIntentToAdaptiveProspectEvent({
    intent: "pricing_question",
    occurredAt: "2026-07-14T14:00:00.000Z",
    bodyPreview: "What does pricing look like for a 40-tech depot?",
  })!,
]

assert.equal(liveEvents.length, 6)
for (const event of liveEvents) {
  assert.equal(isRelationshipMaterialChange({ eventType: event.type }), true)
}

const baseContext = {
  priorTouchCount: 2,
  priorReplyCount: 1,
  priorOutboundSubjects: ["Block Imaging imaging service ops"],
  objectionSummaries: [],
  priorReplySummaries: ["Thanks for reaching out"],
  sequenceHistorySummaries: [],
  memoryOpenLoopSummaries: [],
  buyingIntent: "medium" as const,
  competitorPressure: null,
}

const evolved = evolveOutreachStrategyFromAdaptiveEvents({
  baseBrief: coldBrief,
  events: liveEvents,
  memory: null,
  context: baseContext,
  lead: {
    relationshipStrengthScore: 48,
    relationshipStrengthTier: "warming",
    relationshipTrend: "improving",
    sequenceFatigueRisk: "low",
    leadStatus: "replied",
    hasMeetingScheduled: true,
    isCustomer: false,
    isSuppressed: false,
    committeeMemberCount: 2,
    singleThreadRisk: false,
  },
  committee: {
    hasVerifiedCommittee: true,
    discoveryPending: false,
    discoveryFailed: false,
    singleThreadRisk: false,
    coverageScore: 0.55,
    rolesPresent: ["champion"],
    rolesMissing: ["economic_buyer"],
    verifiedMemberCount: 2,
  },
  assessmentInput: {
    leadId: BLOCK,
    companyName: "Block Imaging",
    preparedAt: "2026-07-14T15:00:00.000Z",
    institutionalAdvice: [],
  },
  enrichInput: {
    sellerTruth,
    approvedProfile: profile,
    learningWeights: null,
    communicationChannelHint: "email",
  },
})

const warmBrief = evolved.brief
assert.ok(warmBrief.relationshipAssessment?.available)
assert.ok(warmBrief.relationshipAssessment!.relationshipStory.sections.length >= 4)
assert.notEqual(
  warmBrief.revenueStrategyIntelligence?.recommendation ?? coldRecommendation,
  coldRecommendation,
)
assert.ok(warmBrief.adaptiveLoopEvolution?.strategyChange.meaningfulChanges.length)

const warmDrafts = generateOutreachDraftsFromSalesStrategyBrief({ brief: warmBrief, senderName: "Ava" })
assert.notEqual(warmDrafts.email.body.slice(0, 80), coldDrafts.email.body.slice(0, 80))
const answered = warmBrief.relationshipAssessment?.answeredThemes ?? []
for (const row of warmBrief.consultantDiscoveryIntelligence?.rankedDiscoveryQuestions ?? []) {
  assert.equal(isAnsweredDiscoveryTheme(row.question, answered), false)
}
assert.equal(reviewHumanAuthenticity(warmDrafts.email.full, "Block Imaging").length, 0)
console.log("  ✓ Block Imaging live-event simulation — relationship, revenue, conversation evolve")

const approvedPrevious: GrowthAutonomousOutreachApprovalPackage = {
  packageId: `outreach-prep:${BLOCK}:2026-07-13T20:00:00.000Z`,
  leadId: BLOCK,
  companyName: "Block Imaging",
  preparedAt: "2026-07-13T20:00:00.000Z",
  generatedAssets: [
    {
      channel: "email",
      label: "Email",
      preview: "Approved operator email body.",
      draftOnly: true,
      generatedPreview: "Generated email body.",
      operatorPreview: "Approved operator email body.",
      approvedPreview: "Approved operator email body.",
      versionStatus: "approved",
      approvedAt: "2026-07-13T21:00:00.000Z",
    },
  ],
  salesStrategyBrief: coldBrief,
  personalizationEvidence: [],
  supportingResearch: [],
  confidence: 0.7,
  approvalRequirements: ["operator_outbound_approval"],
  complianceNotes: [],
  recommendedChannel: "email",
  recommendedSequence: "email_first_multichannel",
  expectedOutcome: "Book discovery",
  pendingHumanApproval: true,
  transportBlocked: true,
  packageApprovalDecision: "approved",
}

const mergedAssets = mergeOperatorAssetStateFromPreviousPackage({
  generatedAssets: summarizeWarmAssets(warmDrafts),
  previousPackage: approvedPrevious,
})
assert.equal(mergedAssets[0]?.approvedPreview, "Approved operator email body.")
assert.equal(mergedAssets[0]?.versionStatus, "approved")
console.log("  ✓ Previously approved packages remain immutable — new strategy does not overwrite approval")

const packet = projectApprovals2AOperatorReviewPacket({
  pkg: {
    packageId: `outreach-prep:${BLOCK}:2026-07-14T15:00:00.000Z`,
    leadId: BLOCK,
    companyName: "Block Imaging",
    preparedAt: "2026-07-14T15:00:00.000Z",
    generatedAssets: mergedAssets,
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
  },
  teammateName: "Ava",
})
assert.ok(packet.operatorReviewLayout.adaptiveLoopEssentials.length >= 2)
assert.ok(
  packet.operatorReviewLayout.relationshipStrategyEssentials.some((line) => /changed because/i.test(line)),
)
console.log("  ✓ Operator packet surfaces relationship change + strategy delta")

assert.equal(GROWTH_AIOS_ADAPTIVE_LOOP_1B_RELATIONSHIP_WAKE_CONDITION, "relationship_material_change")
console.log("\nGE-AIOS-ADAPTIVE-LOOP-1B certification passed.")

function summarizeWarmAssets(
  drafts: ReturnType<typeof generateOutreachDraftsFromSalesStrategyBrief>,
): GrowthAutonomousOutreachApprovalPackage["generatedAssets"] {
  return [
    {
      channel: "email",
      label: "Email",
      preview: drafts.email.body,
      draftOnly: true,
      generatedPreview: drafts.email.body,
      versionStatus: "generated",
    },
  ]
}
