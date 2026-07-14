/**
 * GE-AIOS-INSTITUTIONAL-LEARNING-1A — Organizational sales intelligence certification.
 * Run: pnpm test:ge-aios-institutional-learning-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildInstitutionalSalesIntelligence,
  applyInstitutionalConfidenceBoost,
  GROWTH_AIOS_INSTITUTIONAL_LEARNING_1A_QA_MARKER,
} from "../lib/growth/aios/growth/growth-institutional-learning-1a"
import {
  INSTITUTIONAL_LEARNING_MIN_CONFIDENCE,
  INSTITUTIONAL_LEARNING_MIN_SAMPLE_SIZE,
} from "../lib/growth/aios/growth/growth-institutional-learning-1a-types"
import { synthesizeGrowthLearningInsights } from "../lib/growth/aios/learning/growth-learning-insight-engine"
import type { GrowthLearningOutcome } from "../lib/growth/aios/learning/growth-closed-loop-learning-types"
import { buildOutreachSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import { buildOutreachSellerTruth } from "../lib/growth/aios/growth/growth-outreach-seller-truth"
import { generateOutreachDraftsFromSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-strategy-drafts"
import {
  projectApprovals2AOperatorReviewPacket,
} from "../lib/growth/aios/approvals/approvals-operator-review-packet"
import { reviewProductionHumanCommunicationConstitution } from "../lib/growth/aios/growth/growth-send-plane-1a-constitution"
import { EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE } from "../lib/growth/business-profile/equipify-master-knowledge-canonical"
import type { BusinessProfileDraftContent } from "../lib/growth/business-profile/business-profile-types"
import type { GrowthAutonomousOutreachApprovalPackage } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"

const ROOT = process.cwd()
const BLOCK = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const ORG = "org-equipify-test"

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

function sampleOutcomes(): GrowthLearningOutcome[] {
  const base = {
    organizationId: ORG,
    source: "email" as const,
    subject: { type: "lead" as const, id: "lead-1" },
    related: {},
    signalStrength: 0.8,
    confidence: 0.82,
    evidence: [],
    createdAt: "2026-07-13T20:00:00.000Z",
  }
  return [
    {
      ...base,
      id: "o1",
      outcomeType: "reply",
      dimensions: {
        industry: "biomedical_imaging",
        channel: "email",
        businessPressureKey: "equipment_uptime",
        entryPointRole: "service_director",
        messageTheme: "depot_field_coordination",
      },
      occurredAt: "2026-07-10T12:00:00.000Z",
    },
    {
      ...base,
      id: "o2",
      outcomeType: "positive_intent",
      dimensions: {
        industry: "biomedical_imaging",
        channel: "email",
        businessPressureKey: "equipment_uptime",
        entryPointRole: "service_director",
        messageTheme: "depot_field_coordination",
      },
      occurredAt: "2026-07-11T12:00:00.000Z",
    },
    {
      ...base,
      id: "o3",
      outcomeType: "meeting_booked",
      dimensions: {
        industry: "biomedical_imaging",
        channel: "email",
        businessPressureKey: "equipment_uptime",
        discoveryQuestionTheme: "depot_field_handoffs",
        entryPointRole: "service_director",
      },
      occurredAt: "2026-07-12T12:00:00.000Z",
    },
    {
      ...base,
      id: "o4",
      outcomeType: "no_response",
      dimensions: {
        industry: "biomedical_imaging",
        channel: "email",
        messageTheme: "cost_first_pitch",
      },
      occurredAt: "2026-07-08T12:00:00.000Z",
    },
    {
      ...base,
      id: "o5",
      outcomeType: "reply",
      dimensions: {
        industry: "biomedical_imaging",
        channel: "sms",
        businessPressureKey: "dispatch_coordination",
      },
      occurredAt: "2026-07-09T12:00:00.000Z",
    },
  ]
}

console.log(`[${GROWTH_AIOS_INSTITUTIONAL_LEARNING_1A_QA_MARKER}] Institutional learning certification\n`)

const coreSource = readSource("lib/growth/aios/growth/growth-institutional-learning-1a.ts")
const resolverSource = readSource("lib/growth/aios/growth/growth-institutional-learning-1a-resolver.ts")
const draftSource = readSource("lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts")
const enrichSource = readSource("lib/growth/aios/growth/growth-outreach-conversation-intelligence.ts")
const revenueSource = readSource("lib/growth/aios/growth/growth-outreach-revenue-strategy-intelligence.ts")
const approvalsSource = readSource("lib/growth/aios/approvals/approvals-operator-review-packet.ts")

assert.ok(coreSource.includes("buildInstitutionalSalesIntelligence"))
assert.ok(resolverSource.includes("resolveInstitutionalSalesIntelligenceForOrganization"))
assert.ok(readSource("lib/growth/lead-memory/resolve-canonical-human-memory-for-lead.ts").includes("resolveInstitutionalSalesIntelligenceForOrganization"))
assert.ok(draftSource.includes("resolveCanonicalHumanMemoryForLead"))
assert.ok(enrichSource.includes("applyInstitutionalConfidenceBoost"))
assert.ok(revenueSource.includes("institutionalLearning"))
assert.ok(approvalsSource.includes("institutionalLearningEssentials"))
assert.ok(approvalsSource.includes("institutionalLearningDetail"))
console.log("  ✓ Wired into draft service, strategy enrichment, revenue strategy, operator review")

const outcomes = sampleOutcomes()
const insights = synthesizeGrowthLearningInsights({
  organizationId: ORG,
  generatedAt: "2026-07-13T22:00:00.000Z",
  outcomes,
})

const institutional = buildInstitutionalSalesIntelligence({
  outcomes,
  insights,
  referenceAt: "2026-07-13T22:00:00.000Z",
  accountContext: {
    companyName: "Block Imaging",
    industry: "Biomedical and medical equipment service",
    contactTitle: "President",
    persona: "Executive decision maker",
    companySize: "45",
    employeeCount: "45",
    relationshipStage: "warm",
    businessPressureKey: "equipment_uptime",
    messageThemeKey: "depot_field_coordination",
    accountEvidenceThemes: blockEvidence,
  },
})

assert.equal(institutional.qaMarker, GROWTH_AIOS_INSTITUTIONAL_LEARNING_1A_QA_MARKER)
assert.equal(institutional.hierarchyRespected, true)
assert.ok(institutional.applicablePatterns.length > 0)
assert.ok(institutional.operatorInsights.length > 0)
assert.ok(institutional.confidenceBoost > 0)
assert.ok(institutional.confidenceBoost <= 0.06)
for (const pattern of institutional.applicablePatterns) {
  assert.ok(pattern.sampleSize >= INSTITUTIONAL_LEARNING_MIN_SAMPLE_SIZE)
  assert.ok(pattern.confidence >= INSTITUTIONAL_LEARNING_MIN_CONFIDENCE)
}
console.log("  ✓ Institutional patterns include confidence, sample size, freshness, applicability")

const conflicted = buildInstitutionalSalesIntelligence({
  outcomes,
  insights,
  referenceAt: "2026-07-13T22:00:00.000Z",
  accountContext: {
    companyName: "Block Imaging",
    industry: "Biomedical and medical equipment service",
    accountEvidenceThemes: [
      "Depot and field dispatch coordination is the verified operational pressure for Block Imaging.",
    ],
    businessPressureKey: "equipment_uptime",
  },
})
assert.ok(
  !conflicted.applicablePatterns.some((row) => /cost_first/i.test(row.dimensionValue)),
  "account evidence should suppress conflicting institutional angle",
)
console.log("  ✓ Account evidence overrides conflicting institutional patterns")

const profile = sampleProfile()
const sellerTruth = buildOutreachSellerTruth({
  profile,
  profileId: "profile-1",
  prospectTitle: "President",
  prospectIndustry: "Medical Imaging",
})

const briefWithout = buildOutreachSalesStrategyBrief({
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
})

const briefWith = buildOutreachSalesStrategyBrief({
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
      singleThreadRisk: false,
      coverageScore: 0.72,
      rolesPresent: ["champion"],
      rolesMissing: [],
      verifiedMemberCount: 3,
    },
    communicationChannelHint: "email",
  },
  institutionalLearning: institutional,
})

assert.ok(briefWith.confidence >= briefWithout.confidence)
assert.ok(briefWith.institutionalLearning?.applicablePatterns.length)
assert.ok(briefWith.primaryHook.includes("Block Imaging"))
assert.ok(briefWithout.primaryHook.includes("Block Imaging"))
console.log("  ✓ Block Imaging strategy confidence increases with applicable institutional learning")

const drafts = generateOutreachDraftsFromSalesStrategyBrief({ brief: briefWith, senderName: "Ava" })
assert.ok(!drafts.email.body.includes("—"))
assert.equal(reviewProductionHumanCommunicationConstitution(drafts.email.body, "Block Imaging").length, 0)
for (const text of [drafts.email.body, drafts.linkedIn, drafts.sms]) {
  assert.ok(!text.includes("—"))
}
console.log("  ✓ Institutional learning influences reasoning only — drafts pass constitution")

const approvedPkg: GrowthAutonomousOutreachApprovalPackage = {
  packageId: `outreach-prep:${BLOCK}:approved`,
  leadId: BLOCK,
  companyName: "Block Imaging",
  preparedAt: "2026-07-13T21:00:00.000Z",
  generatedAssets: [],
  salesStrategyBrief: {
    ...briefWithout,
    packageApprovalDecision: "approved",
  } as GrowthAutonomousOutreachApprovalPackage["salesStrategyBrief"],
  draftQuality: { emailWordCount: 0, emailReadTimeSeconds: 0, smsCharacterCount: 0, qualityFailures: [] },
  personalizationEvidence: [],
  supportingResearch: blockEvidence,
  confidence: briefWithout.confidence,
  approvalRequirements: [],
  complianceNotes: [],
  recommendedChannel: "email",
  recommendedSequence: "email_first_multichannel",
  expectedOutcome: briefWithout.businessObjective,
  pendingHumanApproval: false,
  transportBlocked: false,
  packageApprovalDecision: "approved",
}

const newBriefOnly = buildOutreachSalesStrategyBrief({
  leadId: BLOCK,
  companyName: "Block Imaging",
  preparedAt: "2026-07-13T23:00:00.000Z",
  website: "https://blockimaging.com",
  contactName: "Josh Block",
  contactTitle: "President",
  equipmentServiced: ["MRI", "CT"],
  verifiedEvidence: blockEvidence,
  sellerTruth,
  approvedProfile: profile,
  institutionalLearning: institutional,
})

assert.ok(!approvedPkg.salesStrategyBrief?.institutionalLearning)
assert.ok(briefWith.institutionalLearning?.qaMarker === GROWTH_AIOS_INSTITUTIONAL_LEARNING_1A_QA_MARKER)
console.log("  ✓ Approved packages remain immutable — institutional learning affects future generation only")

const packet = projectApprovals2AOperatorReviewPacket({
  pkg: {
    ...approvedPkg,
    salesStrategyBrief: briefWith,
  },
  teammateName: "Ava",
})
assert.ok(packet.operatorReviewLayout.institutionalLearningEssentials.length > 0)
assert.ok(packet.operatorReviewLayout.expandable.institutionalLearningDetail.length > 0)
console.log("  ✓ Operator review surfaces What Ava has learned insights")

const lowSample = buildInstitutionalSalesIntelligence({
  outcomes: outcomes.slice(0, 1),
  insights: [],
  referenceAt: "2026-07-13T22:00:00.000Z",
  accountContext: { companyName: "Block Imaging", industry: "Biomedical" },
})
assert.equal(lowSample.applicablePatterns.length, 0)
assert.equal(applyInstitutionalConfidenceBoost(0.72, lowSample), 0.72)
console.log("  ✓ Low-confidence / low-sample patterns do not materially influence strategy")

console.log("\nGE-AIOS-INSTITUTIONAL-LEARNING-1A certification passed.\n")
