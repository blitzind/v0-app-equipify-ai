/**
 * GE-AIOS-CONVERSATION-INTELLIGENCE-2B — Human authenticity & operator experience certification.
 * Run: pnpm test:ge-aios-conversation-intelligence-2b
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_CONVERSATION_INTELLIGENCE_2B_QA_MARKER,
  detectHumanAuthenticityFailures,
  passesRealSalespersonTest,
} from "../lib/growth/aios/growth/growth-outreach-human-authenticity"
import {
  buildOperatorResearchSummaries,
  normalizeOperatorResearchLine,
} from "../lib/growth/aios/growth/growth-outreach-conversation-intelligence"
import {
  consultantOpeningLine,
  buildEliteSdrObservationSelection,
} from "../lib/growth/aios/growth/growth-outreach-elite-sdr-intelligence"
import {
  detectAiFingerprint,
  reviewHumanAuthenticity,
} from "../lib/growth/aios/growth/growth-outreach-elite-human-communication"
import { buildOutreachSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import { buildOutreachSellerTruth } from "../lib/growth/aios/growth/growth-outreach-seller-truth"
import { generateOutreachDraftsFromSalesStrategyBrief as generateDrafts } from "../lib/growth/aios/growth/growth-outreach-strategy-drafts"
import {
  GROWTH_AIOS_CONVERSATION_INTELLIGENCE_2B_OPERATOR_LAYOUT_QA_MARKER,
  projectApprovals2AOperatorReviewPacket,
} from "../lib/growth/aios/approvals/approvals-operator-review-packet"
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
]

console.log(`[${GROWTH_AIOS_CONVERSATION_INTELLIGENCE_2B_QA_MARKER}] Human authenticity certification\n`)

const humanSource = readSource("lib/growth/aios/growth/growth-outreach-human-authenticity.ts")
const eliteSource = readSource("lib/growth/aios/growth/growth-outreach-elite-human-communication.ts")
const packetSource = readSource("lib/growth/aios/approvals/approvals-operator-review-packet.ts")
const uiSource = readSource("components/growth/ai-os/approvals/growth-ava-completed-outreach-package-card.tsx")

assert.ok(humanSource.includes("HUMAN_AUTHENTICITY_RESEARCH_REVEAL_PATTERNS"))
assert.ok(eliteSource.includes("pickHumanEmailVariation"))
assert.ok(packetSource.includes("operatorReviewLayout"))
assert.ok(uiSource.includes("GrowthCollapsibleEngineCard"))
assert.ok(!/createTable|insert into/i.test(packetSource))
console.log("  ✓ Extends existing pipeline — no new persistence")

const rawLeak = blockEvidence[0]
const normalized = normalizeOperatorResearchLine(rawLeak)
assert.ok(normalized)
assert.ok(!/verified description|\(\d+%\)/i.test(normalized))
assert.match(normalized, /diagnostic imaging/i)
const summaries = buildOperatorResearchSummaries(blockEvidence)
assert.equal(summaries.length, 1)
console.log("  ✓ Operator research normalized — no crawler artifacts")

const selection = buildEliteSdrObservationSelection({
  evidence: [{ source: "Research findings", detail: blockEvidence[0] }],
  equipment: ["MRI", "CT"],
  companyName: "Block Imaging",
})
const opening = consultantOpeningLine({
  observation: selection.selected!,
  seed: BLOCK,
})
assert.ok(!/something i kept|one thing that stood out|i noticed|made me wonder/i.test(opening))
assert.ok(detectHumanAuthenticityFailures(opening).length === 0)
console.log("  ✓ Openings make observations directly — never reveal research")

const banned =
  "Something I kept coming back to — I noticed your website. Based on my research, I came across your company while reviewing LinkedIn."
assert.ok(detectHumanAuthenticityFailures(banned).length >= 4)
assert.ok(detectAiFingerprint(banned).length >= 4)
assert.ok(!passesRealSalespersonTest(banned))
console.log("  ✓ Expanded fingerprint detection rejects research-reveal phrasing")

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

const drafts = generateDrafts({ brief, senderName: "Ava" })
const prospectCopy = [drafts.email.full, drafts.linkedIn, drafts.sms].join("\n")

assert.ok(!/something i kept|one thing that stood out|i noticed|made me wonder|based on my research|curious if/i.test(prospectCopy))
assert.ok(!/verified description|\(\d+%\)/i.test(prospectCopy))
assert.equal(reviewHumanAuthenticity(drafts.email.full, "Block Imaging").length, 0)
assert.equal(drafts.qualityFailures.length, 0, drafts.qualityFailures.join(", "))
assert.ok((brief.sellerKnowledgeQuality?.overallScore ?? 0) >= 0.95)
console.log("  ✓ Block Imaging drafts pass human authenticity gate")

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
assert.ok(review.operatorReviewLayout.priorityLineCount > 0)
assert.ok(review.operatorReviewLayout.priorityLineCount < review.operatorReviewLayout.expandableLineCount)
assert.ok(review.operatorReviewLayout.researchSummary.every((line) => !/verified description|\(\d+%\)/i.test(line)))
assert.ok(review.whySelected.every((line) => !/verified description|\(\d+%\)/i.test(line)))
assert.ok(review.operatorReviewLayout.conversationStrategyEssentials.length <= 8)
assert.ok(review.knowledgeLayers.sellerTruth.length <= 8)
console.log(`  ✓ Operator review layout marker ${GROWTH_AIOS_CONVERSATION_INTELLIGENCE_2B_OPERATOR_LAYOUT_QA_MARKER}`)
const legacyVisibleLines =
  review.whySelected.length +
  review.operatorReviewLayout.conversationStrategyEssentials.length +
  review.knowledgeLayers.sellerTruth.length +
  8
const legacyEquivalent = legacyVisibleLines + review.operatorReviewLayout.expandableLineCount
assert.ok(legacyVisibleLines <= legacyEquivalent * 0.55, "Priority scan path should be <55% of total detail")
console.log(`  ✓ Operator review priority path ${legacyVisibleLines} lines vs ${legacyEquivalent} total`)

console.log("\nGE-AIOS-CONVERSATION-INTELLIGENCE-2B certification PASSED")
