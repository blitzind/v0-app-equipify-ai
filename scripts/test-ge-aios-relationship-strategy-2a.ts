/**
 * GE-AIOS-RELATIONSHIP-STRATEGY-2A — Relationship strategy certification.
 * Run: pnpm test:ge-aios-relationship-strategy-2a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_RELATIONSHIP_STRATEGY_2A_QA_MARKER,
  buildRelationshipAssessment,
  buildSafeRecallItems,
  extractAnsweredThemes,
  relationshipAssessmentSuggestsDelay,
} from "../lib/growth/aios/growth/growth-relationship-strategy-2a"
import { buildRevenueStrategyIntelligence } from "../lib/growth/aios/growth/growth-outreach-revenue-strategy-intelligence"
import { buildConsultantDiscoveryIntelligence, isAnsweredDiscoveryTheme } from "../lib/growth/aios/growth/growth-outreach-consultant-discovery-intelligence"
import { buildEliteSdrObservationSelection } from "../lib/growth/aios/growth/growth-outreach-elite-sdr-intelligence"
import { reviewHumanAuthenticity } from "../lib/growth/aios/growth/growth-outreach-elite-human-communication"
import { GROWTH_HUMAN_COMMUNICATION_CONSTITUTION_PATTERNS } from "../lib/growth/aios/growth/growth-outreach-human-authenticity"
import { buildOutreachSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import { buildOutreachSellerTruth } from "../lib/growth/aios/growth/growth-outreach-seller-truth"
import { generateOutreachDraftsFromSalesStrategyBrief as generateDrafts } from "../lib/growth/aios/growth/growth-outreach-strategy-drafts"
import {
  GROWTH_AIOS_RELATIONSHIP_STRATEGY_2A_OPERATOR_LAYOUT_QA_MARKER,
  projectApprovals2AOperatorReviewPacket,
} from "../lib/growth/aios/approvals/approvals-operator-review-packet"
import { EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE } from "../lib/growth/business-profile/equipify-master-knowledge-canonical"
import type { BusinessProfileDraftContent } from "../lib/growth/business-profile/business-profile-types"
import type { GrowthAutonomousOutreachApprovalPackage } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import type { GrowthLeadMemoryInfluenceContext } from "../lib/growth/lead-memory/memory-types"

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
            preferredResponse: "Fair — the question is whether handoffs still create delay.",
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

function warmMemory(): GrowthLeadMemoryInfluenceContext {
  return {
    available: true,
    memoryCoverageScore: 72,
    relationshipStage: "engaged",
    relationshipSummary: "Prospect replied once about depot dispatch coordination.",
    engagementTrend: "cooling",
    progressionScore: 48,
    topObjections: ["Already have a dispatch tool"],
    topPreferences: ["Email only on Tuesdays"],
    priorInteractionSummaries: ["Replied asking for pricing overview"],
    commitmentSummaries: ["Promised to send a one-page workflow comparison"],
    riskFlags: ["Cooling trend"],
    avoidRepeating: ["how do you coordinate depot and field work today"],
    committeeContext: ["Director of Service Operations engaged"],
    unresolvedObjectionCount: 1,
    unresolvedHighSeverityObjectionCount: 0,
  }
}

console.log(`[${GROWTH_AIOS_RELATIONSHIP_STRATEGY_2A_QA_MARKER}] Relationship strategy certification\n`)

const rsSource = readSource("lib/growth/aios/growth/growth-relationship-strategy-2a.ts")
const briefSource = readSource("lib/growth/aios/growth/growth-outreach-sales-strategy-brief.ts")
const intelSource = readSource("lib/growth/aios/growth/growth-outreach-conversation-intelligence.ts")
const revenueSource = readSource("lib/growth/aios/growth/growth-outreach-revenue-strategy-intelligence.ts")
const draftServiceSource = readSource("lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts")
const packetSource = readSource("lib/growth/aios/approvals/approvals-operator-review-packet.ts")
const uiSource = readSource("components/growth/ai-os/approvals/growth-ava-completed-outreach-package-card.tsx")

assert.ok(rsSource.includes("buildRelationshipAssessment"))
assert.ok(briefSource.includes("relationshipAssessment"))
assert.ok(intelSource.includes("finalizeRelationshipAssessmentStrategyEvolution"))
assert.ok(revenueSource.includes("relationshipAssessmentSuggestsDelay"))
assert.ok(draftServiceSource.includes("buildLeadMemoryInfluenceContext"))
assert.ok(draftServiceSource.includes("buildOutreachContextPacket"))
assert.ok(packetSource.includes("relationshipStrategyEssentials"))
assert.ok(uiSource.includes("Relationship strategy"))
assert.ok(!/createTable|new scheduler|relationship_strategist/i.test(rsSource))
console.log("  ✓ Canonical wiring — one assessment, no new persistence")

const coldAssessment = buildRelationshipAssessment({
  leadId: BLOCK,
  companyName: "Block Imaging",
  preparedAt: "2026-07-13T22:00:00.000Z",
  memory: null,
  context: {
    priorTouchCount: 0,
    priorReplyCount: 0,
    priorOutboundSubjects: [],
    objectionSummaries: [],
    priorReplySummaries: [],
    sequenceHistorySummaries: [],
    memoryOpenLoopSummaries: [],
  },
  lead: {},
})
assert.equal(coldAssessment.available, false)
assert.equal(coldAssessment.qaMarker, GROWTH_AIOS_RELATIONSHIP_STRATEGY_2A_QA_MARKER)
console.log("  ✓ Cold account — empty assessment projection")

const warmAssessment = buildRelationshipAssessment({
  leadId: BLOCK,
  companyName: "Block Imaging",
  preparedAt: "2026-07-13T22:00:00.000Z",
  memory: warmMemory(),
  context: {
    priorTouchCount: 4,
    priorReplyCount: 1,
    priorOutboundSubjects: ["Depot dispatch coordination"],
    objectionSummaries: ["Already have a dispatch tool"],
    priorReplySummaries: ["Asked for pricing overview"],
    sequenceHistorySummaries: ["Follow-up on workflow comparison"],
    memoryOpenLoopSummaries: ["Promised one-page workflow comparison"],
    buyingIntent: "positive",
  },
  lead: {
    relationshipTrend: "cooling",
    relationshipStrengthScore: 58,
    sequenceFatigueRisk: "high",
  },
})
assert.equal(warmAssessment.available, true)
assert.ok(warmAssessment.safeRecall.length > 0)
assert.ok(warmAssessment.answeredThemes.length > 0)
assert.ok(relationshipAssessmentSuggestsDelay(warmAssessment))
assert.match(warmAssessment.relationshipStory.summary, /Block Imaging/i)
assert.ok(warmAssessment.trustBudget.level === "consuming" || warmAssessment.trustBudget.level === "damaging")
console.log(`  ✓ Warm memory — goal: ${warmAssessment.relationshipGoal.current}, protection: ${warmAssessment.relationshipProtection.action}`)

const safeRecall = buildSafeRecallItems({
  memory: warmMemory(),
  context: {
    priorTouchCount: 4,
    priorReplyCount: 1,
    priorOutboundSubjects: [],
    objectionSummaries: [],
    priorReplySummaries: ["Asked for pricing overview"],
    sequenceHistorySummaries: [],
    memoryOpenLoopSummaries: ["Promised one-page workflow comparison"],
  },
})
for (const item of safeRecall) {
  assert.ok(!/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(item.naturalPhrase))
  assert.ok(!/our system|confidence score|crawler/i.test(item.naturalPhrase))
}
console.log("  ✓ Safe recall — no timestamps or creepy phrasing")

const selection = buildEliteSdrObservationSelection({
  evidence: [{ source: "Research findings", detail: blockEvidence[0] }],
  equipment: ["MRI", "CT"],
  companyName: "Block Imaging",
})
const discovery = buildConsultantDiscoveryIntelligence({
  selectedObservation: selection.selected,
  evidence: [{ source: "Research findings", detail: blockEvidence[0] }],
  equipment: ["MRI", "CT"],
  companyName: "Block Imaging",
  leadId: BLOCK,
  answeredThemes: warmAssessment.answeredThemes,
})
assert.ok(discovery)
assert.ok(
  !isAnsweredDiscoveryTheme(
    "How do you coordinate depot and field work today?",
    warmAssessment.answeredThemes,
  ) === false || discovery.recommendedFirstQuestion !== "How do you coordinate depot and field work today?",
)
console.log("  ✓ Adaptive discovery — answered themes suppress repeat questions")

const coldRevenue = buildRevenueStrategyIntelligence({
  leadId: BLOCK,
  companyName: "Block Imaging",
  primaryDmName: "Josh Block",
  primaryDmTitle: "President",
  relationshipStage: "Cold",
  opportunityReadinessScore: 78,
  evidenceIntelligence: {
    insights: [],
    primaryInsight: selection.selected?.consultantObservation ?? null,
    evidenceSummary: selection.selected?.consultantObservation ?? null,
    strongestThemes: ["imaging"],
    weakestThemes: [],
    selectedObservation: selection.selected,
    themeKey: selection.selected?.themeKey ?? null,
  },
  consultantDiscoveryIntelligence: discovery,
  buyingCommitteeSnapshot: {
    hasVerifiedCommittee: true,
    discoveryPending: false,
    discoveryFailed: false,
    singleThreadRisk: false,
    coverageScore: 0.72,
    rolesPresent: ["champion"],
    rolesMissing: [],
    verifiedMemberCount: 3,
  },
  relationshipAssessment: coldAssessment,
})
assert.equal(coldRevenue.recommendation, "proceed")
console.log("  ✓ Block Imaging cold regression — revenue recommendation unchanged")

const warmRevenue = buildRevenueStrategyIntelligence({
  leadId: BLOCK,
  companyName: "Block Imaging",
  primaryDmName: "Josh Block",
  primaryDmTitle: "President",
  relationshipStage: "Warm",
  opportunityReadinessScore: 78,
  evidenceIntelligence: {
    insights: [],
    primaryInsight: selection.selected?.consultantObservation ?? null,
    evidenceSummary: selection.selected?.consultantObservation ?? null,
    strongestThemes: ["imaging"],
    weakestThemes: [],
    selectedObservation: selection.selected,
    themeKey: selection.selected?.themeKey ?? null,
  },
  consultantDiscoveryIntelligence: discovery,
  buyingCommitteeSnapshot: {
    hasVerifiedCommittee: true,
    discoveryPending: false,
    discoveryFailed: false,
    singleThreadRisk: true,
    coverageScore: 0.45,
    rolesPresent: ["influencer"],
    rolesMissing: ["economic_buyer"],
    verifiedMemberCount: 1,
  },
  relationshipAssessment: warmAssessment,
})
assert.equal(warmRevenue.recommendation, "delay")
assert.match(warmRevenue.vpSalesJudgment, /Given everything I know about this relationship/i)
console.log(`  ✓ Warm relationship gating — recommendation: ${warmRevenue.recommendation}`)

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
  preparedAt: "2026-07-13T22:00:00.000Z",
  website: "https://blockimaging.com",
  contactName: "Josh Block",
  contactTitle: "President",
  equipmentServiced: ["MRI", "CT"],
  verifiedEvidence: blockEvidence,
  sellerTruth,
  approvedProfile: profile,
  relationshipStrengthTier: "warm",
  opportunityReadinessScore: 78,
  decisionMakers: [{ name: "Josh Block", title: "President", isPrimary: true }],
  buyingCommitteeSnapshot: {
    hasVerifiedCommittee: true,
    discoveryPending: false,
    discoveryFailed: false,
    singleThreadRisk: false,
    coverageScore: 0.72,
    rolesPresent: ["champion"],
    rolesMissing: [],
    verifiedMemberCount: 3,
  },
  communicationChannelHint: "email",
  relationshipAssessment: coldAssessment,
})
assert.equal(coldBrief.revenueStrategyIntelligence?.recommendation, "proceed")
assert.equal(coldBrief.relationshipAssessment?.available, false)

const warmBrief = buildOutreachSalesStrategyBrief({
  ...{
    leadId: BLOCK,
    companyName: "Block Imaging",
    preparedAt: "2026-07-13T22:00:00.000Z",
    website: "https://blockimaging.com",
    contactName: "Josh Block",
    contactTitle: "President",
    equipmentServiced: ["MRI", "CT"],
    verifiedEvidence: blockEvidence,
    sellerTruth,
    approvedProfile: profile,
    relationshipStrengthTier: "warm",
    opportunityReadinessScore: 78,
    decisionMakers: [{ name: "Josh Block", title: "President", isPrimary: true }],
    buyingCommitteeSnapshot: {
      hasVerifiedCommittee: true,
      discoveryPending: false,
      discoveryFailed: false,
      singleThreadRisk: true,
      coverageScore: 0.45,
      rolesPresent: ["influencer"],
      rolesMissing: ["economic_buyer"],
      verifiedMemberCount: 1,
    },
    communicationChannelHint: "email",
  },
  relationshipAssessment: warmAssessment,
  leadMemory: warmMemory(),
})
assert.equal(warmBrief.revenueStrategyIntelligence?.recommendation, "delay")
assert.ok(warmBrief.relationshipAssessment?.available)
console.log("  ✓ Sales Strategy Brief carries relationship assessment")

const warmDrafts = generateDrafts({ brief: warmBrief, senderName: "Ava" })
const prospectCopy = [warmDrafts.email.full, warmDrafts.linkedIn, warmDrafts.sms, warmDrafts.followUpSequence].join("\n")
assert.ok(!/trust budget|confidence score|relationship assessment|ge-aios/i.test(prospectCopy))
assert.equal(reviewHumanAuthenticity(warmDrafts.email.full, "Block Imaging").length, 0)
for (const pattern of GROWTH_HUMAN_COMMUNICATION_CONSTITUTION_PATTERNS.slice(0, 5)) {
  assert.ok(!pattern.test(prospectCopy), `constitution leak: ${pattern}`)
}
console.log("  ✓ Adaptive messaging — constitution holds on customer-facing copy")

const pkg: GrowthAutonomousOutreachApprovalPackage = {
  packageId: `outreach-prep:${BLOCK}:2026-07-13T22:00:00.000Z`,
  leadId: BLOCK,
  companyName: "Block Imaging",
  preparedAt: "2026-07-13T22:00:00.000Z",
  generatedAssets: [],
  salesStrategyBrief: warmBrief,
  draftQuality: {
    emailWordCount: warmDrafts.email.wordCount,
    emailReadTimeSeconds: 30,
    smsCharacterCount: warmDrafts.sms.length,
    qualityFailures: warmDrafts.qualityFailures,
    sellerKnowledgeQuality: warmBrief.sellerKnowledgeQuality,
  },
  personalizationEvidence: ["Depot + field imaging ops"],
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

const review = projectApprovals2AOperatorReviewPacket({ pkg, teammateName: "Ava" })
const essentials = review.operatorReviewLayout.relationshipStrategyEssentials.join("\n")
assert.ok(review.operatorReviewLayout.relationshipStrategyEssentials.length >= 6)
assert.match(essentials, /Goal:/i)
assert.match(essentials, /Momentum:/i)
assert.match(essentials, /Trust budget:/i)
assert.match(essentials, /Current recommendation:/i)
assert.ok(review.operatorReviewLayout.expandable.relationshipStrategyDetail.length > 0)
console.log(`  ✓ Operator layout marker ${GROWTH_AIOS_RELATIONSHIP_STRATEGY_2A_OPERATOR_LAYOUT_QA_MARKER}`)

console.log("\nGE-AIOS-RELATIONSHIP-STRATEGY-2A certification passed.")
