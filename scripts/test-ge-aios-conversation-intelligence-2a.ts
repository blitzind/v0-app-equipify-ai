/**
 * GE-AIOS-CONVERSATION-INTELLIGENCE-2A — Elite SDR Intelligence certification.
 * Run: pnpm test:ge-aios-conversation-intelligence-2a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_CONVERSATION_INTELLIGENCE_2A_QA_MARKER,
  buildEliteSdrObservationSelection,
  discoverObservationCandidates,
  passesConsultantTest,
  selectPrimaryObservation,
} from "../lib/growth/aios/growth/growth-outreach-elite-sdr-intelligence"
import {
  buildEvidenceIntelligence,
  GROWTH_AIOS_CONVERSATION_INTELLIGENCE_1A_QA_MARKER,
} from "../lib/growth/aios/growth/growth-outreach-conversation-intelligence"
import {
  detectAiFingerprint,
  GROWTH_AIOS_CONVERSATION_INTELLIGENCE_1B_QA_MARKER,
  reviewEliteHumanCommunication,
} from "../lib/growth/aios/growth/growth-outreach-elite-human-communication"
import { generateMessagePerformanceInsight } from "../lib/growth/aios/learning/growth-learning-insight-engine"
import { EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE } from "../lib/growth/business-profile/equipify-master-knowledge-canonical"
import type { BusinessProfileDraftContent } from "../lib/growth/business-profile/business-profile-types"
import {
  GROWTH_OUTREACH_SALES_STRATEGY_BRIEF_VERSION,
  buildOutreachSalesStrategyBrief,
} from "../lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import { buildOutreachSellerTruth } from "../lib/growth/aios/growth/growth-outreach-seller-truth"
import { generateOutreachDraftsFromSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-strategy-drafts"
import { projectApprovals2AOperatorReviewPacket } from "../lib/growth/aios/approvals/approvals-operator-review-packet"
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
  "Hiring biomedical field technicians",
]

console.log(`[${GROWTH_AIOS_CONVERSATION_INTELLIGENCE_2A_QA_MARKER}] Elite SDR Intelligence certification\n`)

// Architecture — extend existing pipeline, no new persistence
const draftService = readSource("lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts")
const intelSource = readSource("lib/growth/aios/growth/growth-outreach-conversation-intelligence.ts")
const eliteSource = readSource("lib/growth/aios/growth/growth-outreach-elite-sdr-intelligence.ts")
assert.match(draftService, /fetchLatestCompletedProspectResearchRun/)
assert.match(draftService, /prospectKnowledgePack/)
assert.match(intelSource, /buildEliteSdrObservationSelection/)
assert.match(eliteSource, /discoverObservationCandidates/)
assert.ok(!/createTable|insert into|new migration/i.test(draftService))
console.log("  ✓ Extends existing 5F pipeline — no new persistence")

// Observation discovery + ranking
const candidates = discoverObservationCandidates({
  evidence: [
    { source: "Research findings", detail: blockEvidence[0] },
    { source: "Equipment serviced", detail: "MRI / CT refurbished systems" },
  ],
  equipment: ["MRI", "CT"],
  companyName: "Block Imaging",
  website: "https://blockimaging.com",
})
assert.ok(candidates.length >= 3, `Expected multiple candidates, got ${candidates.length}`)
assert.ok(candidates.length <= 40)
assert.ok(candidates.every((row) => row.scores.total >= 0 && row.scores.total <= 1))
assert.ok(candidates[0].scores.total >= (candidates[candidates.length - 1]?.scores.total ?? 0))
console.log(`  ✓ Discovered ${candidates.length} ranked observation candidates`)

const selection = selectPrimaryObservation(candidates)
assert.ok(selection.selected)
assert.ok(selection.selectionRationale)
assert.ok(selection.themeKey)
console.log(`  ✓ Selected primary observation: ${selection.themeKey}`)

const eliteSelection = buildEliteSdrObservationSelection({
  evidence: [
    { source: "Research findings", detail: blockEvidence[0] },
    { source: "Equipment serviced", detail: "MRI / CT refurbished systems" },
  ],
  equipment: ["MRI", "CT"],
  companyName: "Block Imaging",
  website: "https://blockimaging.com",
  matchedIndustry: EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE.industries[0] ?? null,
})
assert.ok(eliteSelection.selected?.consultantObservation)
assert.ok(!/you repair medical equipment/i.test(eliteSelection.selected.consultantObservation))
console.log("  ✓ Consultant observation avoids obvious/generic phrasing")

// Evidence intelligence wired to 2A selection
const evidenceIntel = buildEvidenceIntelligence({
  evidence: [
    { source: "Research findings", detail: blockEvidence[0] },
    { source: "Equipment serviced", detail: "MRI / CT refurbished systems" },
  ],
  equipment: ["MRI", "CT"],
  website: "https://blockimaging.com",
  companyName: "Block Imaging",
})
assert.ok(evidenceIntel.selectedObservation)
assert.equal(evidenceIntel.primaryInsight, evidenceIntel.selectedObservation.consultantObservation)
assert.ok(evidenceIntel.rankedObservations && evidenceIntel.rankedObservations.length > 0)
console.log("  ✓ buildEvidenceIntelligence selects ONE consultant-grade observation")

// Consultant test + expanded fingerprints
assert.ok(passesConsultantTest("Refurb + field imaging ops — curious if depot turnaround stays predictable?"))
assert.ok(!passesConsultantTest("We help companies streamline operations with our platform."))
const aiDraft =
  "Hi John, I hope you're doing well. Based on my analysis, our AI noticed your website. We help companies streamline operations."
assert.ok(detectAiFingerprint(aiDraft).length >= 4)
console.log("  ✓ Consultant test + expanded AI fingerprint detector")

// Learning loop extension
const messageInsight = generateMessagePerformanceInsight({
  organizationId: "org-1",
  generatedAt: "2026-07-13T20:00:00.000Z",
  outcomes: [
    {
      id: "o1",
      organizationId: "org-1",
      source: "email",
      outcomeType: "reply",
      subject: { type: "lead", id: BLOCK },
      related: {},
      signalStrength: 0.8,
      confidence: 0.85,
      dimensions: { messageTheme: "imaging_depot_field_rhythm", channel: "email" },
      evidence: [],
      occurredAt: "2026-07-13T20:00:00.000Z",
      createdAt: "2026-07-13T20:00:00.000Z",
    },
  ],
})
assert.equal(messageInsight.insightType, "message_performance")
console.log("  ✓ message_performance learning insight generator wired")

// Block Imaging end-to-end benchmark
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
  preparedAt: "2026-07-13T21:00:00.000Z",
  website: "https://blockimaging.com",
  contactName: "Josh Block",
  contactTitle: "President",
  contactEmail: "josh@blockimaging.com",
  equipmentServiced: ["MRI", "CT"],
  verifiedEvidence: blockEvidence,
  opportunitySummary: "Strong imaging service fit.",
  fitReason: "Fits approved ICP",
  qualificationConfidence: 0.82,
  sellerTruth,
  approvedProfile: profile,
})

assert.equal(GROWTH_OUTREACH_SALES_STRATEGY_BRIEF_VERSION, "outreach-sales-strategy-brief-v4")
assert.ok(brief.evidenceIntelligence?.selectedObservation)
assert.ok(brief.evidenceIntelligence?.themeKey)
assert.ok((brief.sellerKnowledgeQuality?.overallScore ?? 0) >= 0.95, `Quality ${brief.sellerKnowledgeQuality?.overallScore}`)
console.log(`  ✓ Quality score ${brief.sellerKnowledgeQuality?.overallScore?.toFixed(2)} ≥ 0.95`)

const drafts = generateOutreachDraftsFromSalesStrategyBrief({ brief, senderName: "Ava" })
const prospectCopy = [drafts.email.full, drafts.linkedIn, drafts.sms].join("\n")

assert.ok(!/verified description|\(\d+%\)|based on my analysis|our ai noticed|we help|our platform/i.test(prospectCopy))
assert.ok(!/hope you(?:'|’)re doing well|i noticed|wanted to reach out|i came across/i.test(prospectCopy))
assert.ok(!/equipify/i.test(drafts.email.body.split("\n").slice(0, 4).join(" ")), "Email must not lead with seller")
assert.equal(reviewEliteHumanCommunication(drafts.email.full, "Block Imaging").length, 0)
assert.equal(reviewEliteHumanCommunication(drafts.linkedIn, "Block Imaging").length, 0)
assert.equal(reviewEliteHumanCommunication(drafts.sms, "Block Imaging").length, 0)
assert.equal(drafts.qualityFailures.length, 0, `Quality failures: ${drafts.qualityFailures.join(", ")}`)
assert.ok(/refurb|depot|imaging|curious|wonder|stood out/i.test(prospectCopy))
console.log("  ✓ Block Imaging drafts pass elite SDR intelligence review")

// Operator review packet shows observation selection
const pkg: GrowthAutonomousOutreachApprovalPackage = {
  packageId: `outreach-prep:${BLOCK}:2026-07-13T21:00:00.000Z`,
  leadId: BLOCK,
  companyName: "Block Imaging",
  preparedAt: "2026-07-13T21:00:00.000Z",
  generatedAssets: [],
  salesStrategyBrief: brief,
  draftQuality: {
    emailWordCount: drafts.email.wordCount,
    emailReadTimeSeconds: 30,
    smsCharacterCount: drafts.sms.length,
    qualityFailures: drafts.qualityFailures,
    sellerKnowledgeQuality: brief.sellerKnowledgeQuality,
  },
  personalizationEvidence: [],
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
assert.ok(
  review.knowledgeLayers.conversationStrategy.some((line) => /Selected observation theme:/i.test(line)),
)
assert.ok(
  review.knowledgeLayers.conversationStrategy.some((line) => /Consultant observation:/i.test(line)),
)
console.log("  ✓ Operator review packet exposes ranked observations + selection rationale")

// 1A / 1B regressions still wired
assert.ok(intelSource.includes(GROWTH_AIOS_CONVERSATION_INTELLIGENCE_1A_QA_MARKER))
const humanSource = readSource("lib/growth/aios/growth/growth-outreach-elite-human-communication.ts")
assert.ok(humanSource.includes(GROWTH_AIOS_CONVERSATION_INTELLIGENCE_1B_QA_MARKER))
assert.ok(humanSource.includes("selectedObservation"))
console.log("  ✓ CONVERSATION-INTELLIGENCE-1A/1B layers preserved")

console.log("\nGE-AIOS-CONVERSATION-INTELLIGENCE-2A certification PASSED")
