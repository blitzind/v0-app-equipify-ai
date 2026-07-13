/**
 * GE-AIOS-CONVERSATION-INTELLIGENCE-1A — Certification.
 * Run: pnpm test:ge-aios-conversation-intelligence-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_CONVERSATION_INTELLIGENCE_1A_QA_MARKER,
  assertNoRawResearchLeakage,
  buildEvidenceIntelligence,
  inferIndustryFromSignals,
  inferPersonaFromTitle,
  reviewOutreachDraftCopy,
  sanitizeRawEvidenceForProspect,
} from "../lib/growth/aios/growth/growth-outreach-conversation-intelligence"
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

console.log(`[${GROWTH_AIOS_CONVERSATION_INTELLIGENCE_1A_QA_MARKER}] Conversation Intelligence certification\n`)

// Architecture unchanged — no new persistence
const draftService = readSource("lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts")
const pilotTypes = readSource("lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types.ts")
assert.ok(!/createTable|insert into|new migration/i.test(draftService), "No new persistence in draft service")
assert.ok(draftService.includes("buildOutreachSalesStrategyBrief"))
assert.ok(draftService.includes("generateOutreachDraftsFromSalesStrategyBrief"))
assert.ok(!pilotTypes.includes("conversation_intelligence_store"))
console.log("  ✓ Existing architecture unchanged (no new persistence)")

// Evidence sanitization
const rawLeak =
  "Verified description (82%): Block Imaging is a global diagnostic imaging company specializing in MRI and CT."
const sanitized = sanitizeRawEvidenceForProspect(rawLeak)
assert.ok(!/\(\d+%\)/.test(sanitized))
assert.ok(!/verified description/i.test(sanitized))
assert.ok(sanitized.toLowerCase().includes("block imaging"))
console.log("  ✓ Evidence sanitized — no confidence strings or verification labels")

const evidenceIntel = buildEvidenceIntelligence({
  evidence: [
    { source: "Research findings", detail: rawLeak },
    { source: "Equipment serviced", detail: "MRI / CT refurbished systems" },
    { source: "Decision maker role", detail: "Josh Block · President" },
  ],
  equipment: ["MRI", "CT"],
  website: "https://blockimaging.com",
})
assert.ok(evidenceIntel.primaryInsight)
assert.ok(!/verified description|\(\d+%\)/i.test(evidenceIntel.primaryInsight ?? ""))
assert.ok(evidenceIntel.insights.every((row) => !/\(\d+%\)/.test(row.prospectSafeInsight)))
console.log("  ✓ Evidence intelligence transforms raw research into conversation insights")

// Persona inference
const persona = inferPersonaFromTitle("President", EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE.personas)
assert.equal(persona.normalizedRole, "Executive decision maker")
assert.ok(persona.matchedPersona?.persona === "Owner")
assert.ok(persona.confidence >= 0.8)
console.log("  ✓ Persona inference maps President → executive decision maker")

// Industry inference
const industry = inferIndustryFromSignals({
  hintIndustry: "Industrial equipment service",
  evidence: [
    { source: "Research findings", detail: rawLeak },
    { source: "Equipment serviced", detail: "MRI / CT imaging systems" },
  ],
  equipment: ["MRI", "CT"],
  companyName: "Block Imaging",
  website: "https://blockimaging.com",
  canonicalIndustries: EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE.industries,
})
assert.ok(/biomedical|medical/i.test(industry.inferredIndustry ?? ""))
assert.ok(industry.confidence >= 0.7)
console.log("  ✓ Industry inference prefers biomedical/medical imaging over generic industrial")

// Brief v4 + Block Imaging benchmark
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
  preparedAt: "2026-07-13T20:00:00.000Z",
  website: "https://blockimaging.com",
  contactName: "Josh Block",
  contactTitle: "President",
  contactEmail: "josh@blockimaging.com",
  equipmentServiced: ["MRI", "CT"],
  verifiedEvidence: [
    rawLeak,
    "Service indicator: MRI / CT refurbished systems",
    "Hiring biomedical technicians",
  ],
  opportunitySummary: "Strong imaging service fit.",
  fitReason: "Fits approved ICP for imaging operators",
  qualificationConfidence: 0.82,
  industry: "Industrial equipment service",
  sellerTruth,
  approvedProfile: profile,
})

assert.equal(GROWTH_OUTREACH_SALES_STRATEGY_BRIEF_VERSION, "outreach-sales-strategy-brief-v4")
assert.ok(brief.evidenceIntelligence)
assert.ok(brief.conversationRisk)
assert.ok(brief.operatorReasoning)
assert.ok(brief.conversationStrategy?.conversationGoal)
assert.ok(brief.conversationStrategy?.primaryInsight)
assert.ok(!/15-minute workflow review/i.test(brief.recommendedCta) || brief.operatorReasoning.reasonForCta.length > 0)
assert.ok(/biomedical|medical|imaging/i.test(brief.sellerTruth?.matchedIndustryKnowledge ?? ""))
assert.ok(brief.sellerTruth?.matchedPersona === "Owner")
assert.ok(brief.businessProblems[0]?.length > 20)
assert.ok(!/verified description|\(\d+%\)/i.test(brief.primaryHook))
console.log("  ✓ Sales Strategy Brief v4 with conversation intelligence")

const drafts = generateOutreachDraftsFromSalesStrategyBrief({ brief, senderName: "Ava" })
const allDraftText = [
  drafts.email.full,
  drafts.linkedIn,
  drafts.sms,
  drafts.callGuide,
  drafts.personalizedVideo,
  drafts.followUpSequence,
].join("\n")

assert.ok(assertNoRawResearchLeakage(allDraftText))
assert.equal(reviewOutreachDraftCopy(drafts.email.full).length, 0)
assert.ok(!/hope you(?:'|’)re doing well|wanted to reach out|i noticed/i.test(allDraftText))
assert.ok(drafts.qualityFailures.length === 0, `Draft quality failures: ${drafts.qualityFailures.join(", ")}`)
assert.ok(brief.sellerKnowledgeQuality?.overallScore ?? 0 >= 0.75)
console.log("  ✓ Drafts use sanitized insights — no raw research leakage")

// Approval experience
const pkg: GrowthAutonomousOutreachApprovalPackage = {
  packageId: `outreach-prep:${BLOCK}:2026-07-13T20:00:00.000Z`,
  leadId: BLOCK,
  companyName: "Block Imaging",
  preparedAt: "2026-07-13T20:00:00.000Z",
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
  supportingResearch: [],
  confidence: brief.confidence,
  approvalRequirements: ["operator_outbound_approval"],
  complianceNotes: [],
  recommendedChannel: "email",
  recommendedSequence: "email_first_multichannel",
  expectedOutcome: brief.businessObjective,
  pendingHumanApproval: true,
  transportBlocked: true,
}

const packet = projectApprovals2AOperatorReviewPacket({ pkg, teammateName: "Ava" })
assert.ok(packet.operatorReasoning)
assert.ok(packet.knowledgeLayers.conversationStrategy.some((line) => /Opening observation:/i.test(line)))
assert.ok(
  packet.operatorReviewLayout.consultantDiscoveryEssentials.some((line) =>
    /Top business pressure:/i.test(line),
  ),
)
assert.ok(
  packet.operatorReviewLayout.consultantDiscoveryEssentials.some((line) =>
    /Recommended first question:/i.test(line),
  ),
)
assert.ok(
  packet.operatorReviewLayout.expandable.consultantDiscoveryDetail.some((line) =>
    /Goal:|Outcome:/i.test(line),
  ),
)
console.log("  ✓ Approval packet exposes operator-facing conclusions")

// Source wiring
const briefSource = readSource("lib/growth/aios/growth/growth-outreach-sales-strategy-brief.ts")
const intelSource = readSource("lib/growth/aios/growth/growth-outreach-conversation-intelligence.ts")
const draftsSource = readSource("lib/growth/aios/growth/growth-outreach-strategy-drafts.ts")
assert.match(briefSource, /enrichOutreachSalesStrategyBrief/)
assert.match(briefSource, /outreach-sales-strategy-brief-v4/)
assert.match(intelSource, /buildEvidenceIntelligence/)
assert.match(intelSource, /buildConsultantDiscoveryIntelligence/)
assert.match(intelSource, /buildDynamicObjections/)
assert.match(intelSource, /pickDynamicCta/)
assert.match(draftsSource, /buildEliteHumanProspectDrafts/)
assert.match(draftsSource, /reviewEliteHumanCommunication/)
console.log("  ✓ Conversation intelligence wired into brief + drafts pipeline")

console.log("\nGE-AIOS-CONVERSATION-INTELLIGENCE-1A certification PASSED")
