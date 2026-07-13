/**
 * GE-AIOS-CONVERSATION-INTELLIGENCE-3A — Consultant discovery intelligence certification.
 * Run: pnpm test:ge-aios-conversation-intelligence-3a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_CONVERSATION_INTELLIGENCE_3A_QA_MARKER,
  buildConsultantDiscoveryIntelligence,
  isGenericDiscoveryQuestion,
  passesConsultantDiscoveryTest,
  reviewConsultantDiscoveryQuality,
} from "../lib/growth/aios/growth/growth-outreach-consultant-discovery-intelligence"
import { buildEliteSdrObservationSelection } from "../lib/growth/aios/growth/growth-outreach-elite-sdr-intelligence"
import { reviewHumanAuthenticity } from "../lib/growth/aios/growth/growth-outreach-elite-human-communication"
import { buildOutreachSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import { buildOutreachSellerTruth } from "../lib/growth/aios/growth/growth-outreach-seller-truth"
import { generateOutreachDraftsFromSalesStrategyBrief as generateDrafts } from "../lib/growth/aios/growth/growth-outreach-strategy-drafts"
import {
  GROWTH_AIOS_CONVERSATION_INTELLIGENCE_3A_OPERATOR_LAYOUT_QA_MARKER,
  projectApprovals2AOperatorReviewPacket,
} from "../lib/growth/aios/approvals/approvals-operator-review-packet"
import { generateConsultantDiscoveryInsight } from "../lib/growth/aios/learning/growth-learning-insight-engine"
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

console.log(`[${GROWTH_AIOS_CONVERSATION_INTELLIGENCE_3A_QA_MARKER}] Consultant discovery certification\n`)

const discoverySource = readSource(
  "lib/growth/aios/growth/growth-outreach-consultant-discovery-intelligence.ts",
)
const packetSource = readSource("lib/growth/aios/approvals/approvals-operator-review-packet.ts")
const uiSource = readSource("components/growth/ai-os/approvals/growth-ava-completed-outreach-package-card.tsx")

assert.ok(discoverySource.includes("buildConsultantDiscoveryIntelligence"))
assert.ok(discoverySource.includes("reasoningChain"))
assert.ok(packetSource.includes("consultantDiscoveryEssentials"))
assert.ok(uiSource.includes("Consultant discovery"))
assert.ok(!/createTable|insert into/i.test(discoverySource))
console.log("  ✓ Extends existing pipeline — no new persistence")

assert.ok(isGenericDiscoveryQuestion("How do you schedule technicians?"))
assert.ok(isGenericDiscoveryQuestion("What software do you use?"))
assert.ok(
  !isGenericDiscoveryQuestion(
    "When workload spikes, is dispatch usually the bottleneck—or is it getting completed work closed out fast enough?",
  ),
)
console.log("  ✓ Rejects generic discovery questions")

const selection = buildEliteSdrObservationSelection({
  evidence: [{ source: "Research findings", detail: blockEvidence[0] }],
  equipment: ["MRI", "CT"],
  companyName: "Block Imaging",
  prospectKnowledgePack: {
    observed_facts: ["Depot and field imaging service across provider sites"],
    derived_inferences: ["Multi-site imaging service operations"],
  } as never,
})
assert.ok(selection.selected)

const discovery = buildConsultantDiscoveryIntelligence({
  selectedObservation: selection.selected,
  evidence: [{ source: "Research findings", detail: blockEvidence[0] }],
  equipment: ["MRI", "CT"],
  companyName: "Block Imaging",
  leadId: BLOCK,
})
assert.ok(discovery)
assert.ok(discovery.reasoningChain.operationalImplication.length > 20)
assert.ok(discovery.reasoningChain.businessImplication.length > 20)
assert.ok(discovery.primaryBusinessPressure)
assert.ok(discovery.primaryBuyingTrigger)
assert.ok(discovery.rankedDiscoveryQuestions.length >= 2)
assert.ok(passesConsultantDiscoveryTest(discovery))
assert.ok(!isGenericDiscoveryQuestion(discovery.recommendedFirstQuestion))
console.log(`  ✓ Reasoning chain: ${discovery.themeKey}`)
console.log(`  ✓ Primary pressure: ${discovery.primaryBusinessPressure?.key}`)
console.log(`  ✓ Primary trigger: ${discovery.primaryBuyingTrigger?.label}`)

const profile = sampleProfile()
const sellerTruth = buildOutreachSellerTruth({
  profile,
  profileId: "profile-1",
  prospectTitle: "President",
  prospectIndustry: "Industrial equipment service",
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
})

assert.ok(brief.consultantDiscoveryIntelligence)
assert.equal(
  brief.consultantDiscoveryIntelligence?.recommendedFirstQuestion,
  discovery?.recommendedFirstQuestion,
)
console.log("  ✓ Wired into Sales Strategy Brief enrichment")

const drafts = generateDrafts({ brief, senderName: "Ava" })
const prospectCopy = [drafts.email.full, drafts.linkedIn, drafts.sms].join("\n")

assert.ok(
  prospectCopy.includes(
    discovery!.recommendedFirstQuestion.replace(/\?$/, "").slice(0, 40),
  ),
  "Draft should use consultant discovery question",
)
assert.ok(!/operational implication|business implication|hypothesis/i.test(prospectCopy))
assert.equal(reviewConsultantDiscoveryQuality({
  discovery: brief.consultantDiscoveryIntelligence!,
  prospectFacingQuestion: discovery!.recommendedFirstQuestion,
}).length, 0)
assert.equal(reviewHumanAuthenticity(drafts.email.full, "Block Imaging").length, 0)
assert.equal(drafts.qualityFailures.length, 0, drafts.qualityFailures.join(", "))
assert.ok((brief.sellerKnowledgeQuality?.overallScore ?? 0) >= 0.95)
console.log("  ✓ Block Imaging drafts pass consultant discovery gate")

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
  personalizationEvidence: ["Mentioned nationwide depot repair"],
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
assert.ok(review.operatorReviewLayout.consultantDiscoveryEssentials.length >= 4)
assert.match(
  review.operatorReviewLayout.consultantDiscoveryEssentials.join("\n"),
  /Top business pressure/,
)
assert.match(
  review.operatorReviewLayout.consultantDiscoveryEssentials.join("\n"),
  /Recommended first question/,
)
assert.ok(review.operatorReviewLayout.expandable.consultantDiscoveryDetail.length > 0)
console.log(`  ✓ Operator layout marker ${GROWTH_AIOS_CONVERSATION_INTELLIGENCE_3A_OPERATOR_LAYOUT_QA_MARKER}`)

const learningInsight = generateConsultantDiscoveryInsight({
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
        messageTheme: "imaging_depot_field_rhythm",
        businessPressureKey: "equipment_uptime",
        discoveryQuestionTheme: "dispatch_vs_closeout",
      },
      evidence: [],
      occurredAt: "2026-07-13T22:00:00.000Z",
      createdAt: "2026-07-13T22:00:00.000Z",
    },
  ],
})
assert.equal(learningInsight.insightType, "message_performance")
assert.match(learningInsight.title, /business pressure/i)
console.log("  ✓ Learning loop extends message_performance with pressure + discovery themes")

console.log("\nGE-AIOS-CONVERSATION-INTELLIGENCE-3A certification PASSED")
