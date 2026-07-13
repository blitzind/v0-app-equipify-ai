/**
 * GE-AIOS-REVENUE-STRATEGY-1A — Autonomous sales strategy intelligence certification.
 * Run: pnpm test:ge-aios-revenue-strategy-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_REVENUE_STRATEGY_1A_QA_MARKER,
  buildRevenueStrategyIntelligence,
  passesRevenueStrategyQuality,
  reviewRevenueStrategyQuality,
} from "../lib/growth/aios/growth/growth-outreach-revenue-strategy-intelligence"
import { buildConsultantDiscoveryIntelligence } from "../lib/growth/aios/growth/growth-outreach-consultant-discovery-intelligence"
import { buildEliteSdrObservationSelection } from "../lib/growth/aios/growth/growth-outreach-elite-sdr-intelligence"
import { reviewHumanAuthenticity } from "../lib/growth/aios/growth/growth-outreach-elite-human-communication"
import { buildOutreachSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import { buildOutreachSellerTruth } from "../lib/growth/aios/growth/growth-outreach-seller-truth"
import { generateOutreachDraftsFromSalesStrategyBrief as generateDrafts } from "../lib/growth/aios/growth/growth-outreach-strategy-drafts"
import {
  GROWTH_AIOS_REVENUE_STRATEGY_1A_OPERATOR_LAYOUT_QA_MARKER,
  projectApprovals2AOperatorReviewPacket,
} from "../lib/growth/aios/approvals/approvals-operator-review-packet"
import { generateRevenueStrategyInsight } from "../lib/growth/aios/learning/growth-learning-insight-engine"
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

console.log(`[${GROWTH_AIOS_REVENUE_STRATEGY_1A_QA_MARKER}] Revenue strategy certification\n`)

const strategySource = readSource("lib/growth/aios/growth/growth-outreach-revenue-strategy-intelligence.ts")
const auditDoc = readSource("docs/GE-AIOS-REVENUE-STRATEGY-1A_ARCHITECTURE_AUDIT.md")
const packetSource = readSource("lib/growth/aios/approvals/approvals-operator-review-packet.ts")
const uiSource = readSource("components/growth/ai-os/approvals/growth-ava-completed-outreach-package-card.tsx")
const draftServiceSource = readSource(
  "lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts",
)

assert.ok(strategySource.includes("buildRevenueStrategyIntelligence"))
assert.ok(auditDoc.includes("Extend only"))
assert.ok(packetSource.includes("revenueStrategyEssentials"))
assert.ok(uiSource.includes("Sales recommendation"))
assert.ok(draftServiceSource.includes("buyingCommitteeSnapshot"))
assert.ok(!/createTable|insert into/i.test(strategySource))
console.log("  ✓ Architecture audit complete — extends existing pipeline only")

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
})

const strategy = buildRevenueStrategyIntelligence({
  leadId: BLOCK,
  companyName: "Block Imaging",
  primaryDmName: "Josh Block",
  primaryDmTitle: "President",
  decisionMakers: [
    { name: "Josh Block", title: "President", isPrimary: true },
    { name: "Alex Rivera", title: "Director of Service Operations", isPrimary: false },
  ],
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
    rolesPresent: ["champion", "economic_buyer", "influencer"],
    rolesMissing: ["technical_buyer"],
    verifiedMemberCount: 3,
  },
  communicationChannelHint: "email",
})

assert.ok(strategy)
assert.equal(strategy.recommendation, "proceed")
assert.ok(passesRevenueStrategyQuality(strategy))
assert.ok(strategy.primaryEntryPoint.label.length > 0)
assert.ok(strategy.channelPlan.primaryChannel !== "none")
assert.match(strategy.sequencePlan.approach, /operational_insight|curiosity/)
assert.ok(strategy.vpSalesJudgment.includes("ten calls"))
console.log(`  ✓ Recommendation: ${strategy.recommendation}`)
console.log(`  ✓ Entry: ${strategy.primaryEntryPoint.label}`)
console.log(`  ✓ Channel: ${strategy.channelPlan.primaryChannel}`)

const profile = sampleProfile()
const sellerTruth = buildOutreachSellerTruth({
  profile,
  profileId: "profile-1",
  prospectTitle: "President",
  prospectIndustry: "Medical Imaging",
})

const brief = buildOutreachSalesStrategyBrief({
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
  decisionMakers: [
    { name: "Josh Block", title: "President", isPrimary: true },
    { name: "Alex Rivera", title: "Director of Service Operations", isPrimary: false },
  ],
  buyingCommitteeSnapshot: {
    hasVerifiedCommittee: true,
    discoveryPending: false,
    discoveryFailed: false,
    singleThreadRisk: false,
    coverageScore: 0.72,
    rolesPresent: ["champion", "economic_buyer"],
    rolesMissing: ["technical_buyer"],
    verifiedMemberCount: 3,
  },
  communicationChannelHint: "email",
})

assert.ok(brief.revenueStrategyIntelligence)
assert.equal(brief.revenueStrategyIntelligence?.recommendation, "proceed")
console.log("  ✓ Wired into Sales Strategy Brief enrichment")

const drafts = generateDrafts({ brief, senderName: "Ava" })
const prospectCopy = [drafts.email.full, drafts.linkedIn, drafts.sms].join("\n")
assert.ok(!/sales recommendation|vp judgment|revenue strategy|committee strategy/i.test(prospectCopy))
assert.equal(reviewRevenueStrategyQuality(brief.revenueStrategyIntelligence).length, 0)
assert.equal(reviewHumanAuthenticity(drafts.email.full, "Block Imaging").length, 0)
assert.equal(drafts.qualityFailures.length, 0, drafts.qualityFailures.join(", "))
assert.ok((brief.sellerKnowledgeQuality?.overallScore ?? 0) >= 0.95)
console.log("  ✓ Block Imaging drafts pass revenue strategy gate")

const pkg: GrowthAutonomousOutreachApprovalPackage = {
  packageId: `outreach-prep:${BLOCK}:2026-07-13T22:00:00.000Z`,
  leadId: BLOCK,
  companyName: "Block Imaging",
  preparedAt: "2026-07-13T22:00:00.000Z",
  generatedAssets: [],
  salesStrategyBrief: brief,
  draftQuality: {
    emailWordCount: drafts.email.wordCount,
    emailReadTimeSeconds: 30,
    smsCharacterCount: drafts.sms.length,
    qualityFailures: drafts.qualityFailures,
    sellerKnowledgeQuality: brief.sellerKnowledgeQuality,
  },
  personalizationEvidence: ["Depot + field imaging ops"],
  supportingResearch: blockEvidence,
  confidence: brief.confidence,
  approvalRequirements: ["operator_outbound_approval"],
  complianceNotes: [],
  recommendedChannel: "email",
  recommendedSequence: "email_first_multichannel",
  expectedOutcome: brief.businessObjective,
  pendingHumanApproval: true,
  transportBlocked: true,
}

const review = projectApprovals2AOperatorReviewPacket({ pkg, teammateName: "Ava" })
assert.ok(review.operatorReviewLayout.revenueStrategyEssentials.length >= 4)
assert.match(
  review.operatorReviewLayout.revenueStrategyEssentials.join("\n"),
  /Sales recommendation: proceed/i,
)
assert.match(
  review.operatorReviewLayout.revenueStrategyEssentials.join("\n"),
  /Recommended entry:/i,
)
assert.ok(review.operatorReviewLayout.expandable.revenueStrategyDetail.length > 0)
console.log(`  ✓ Operator layout marker ${GROWTH_AIOS_REVENUE_STRATEGY_1A_OPERATOR_LAYOUT_QA_MARKER}`)

const learningInsight = generateRevenueStrategyInsight({
  organizationId: "org-1",
  generatedAt: "2026-07-13T22:00:00.000Z",
  outcomes: [
    {
      id: "o1",
      organizationId: "org-1",
      subjectType: "lead",
      subjectId: BLOCK,
      source: "workflow_agent",
      outcomeType: "reply",
      signalStrength: 0.8,
      confidence: 0.82,
      dimensions: {
        revenueStrategyRecommendation: "proceed",
        entryPointRole: "service_director",
        channelStrategy: "email",
        committeeStrategy: "multi_thread",
      },
      evidence: [],
      occurredAt: "2026-07-13T22:00:00.000Z",
      createdAt: "2026-07-13T22:00:00.000Z",
    },
  ],
})
assert.equal(learningInsight.insightType, "message_performance")
assert.match(learningInsight.title, /revenue strategy/i)
console.log("  ✓ Learning loop extends message_performance with strategy dimensions")

const intelSource = readSource("lib/growth/aios/growth/growth-outreach-conversation-intelligence.ts")
assert.match(intelSource, /buildRevenueStrategyIntelligence/)
console.log("  ✓ Revenue strategy wired into enrichOutreachSalesStrategyBrief")

console.log("\nGE-AIOS-REVENUE-STRATEGY-1A certification PASSED")
