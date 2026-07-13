/**
 * GE-AIOS-SALES-PLAYBOOK-1B — Canonical seller knowledge wiring certification.
 * Run: pnpm test:ge-aios-sales-playbook-1b-canonical-seller-knowledge-wiring
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_SALES_PLAYBOOK_1B_QA_MARKER,
  buildOutreachSellerTruth,
  deriveOutreachRelationshipStage,
  extractBusinessIntelligenceEnrichmentLines,
} from "../lib/growth/aios/growth/growth-outreach-seller-truth"
import {
  GROWTH_OUTREACH_SALES_STRATEGY_BRIEF_VERSION,
  buildOutreachSalesStrategyBrief,
} from "../lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import { generateOutreachDraftsFromSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-strategy-drafts"
import { projectApprovals2AOperatorReviewPacket } from "../lib/growth/aios/approvals/approvals-operator-review-packet"
import type { BusinessProfileDraftContent } from "../lib/growth/business-profile/business-profile-types"
import type { GrowthIndustryPlaybook } from "../lib/growth/playbooks/industry-playbook-types"
import type { GrowthAutonomousOutreachApprovalPackage } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

const sampleProfile = (): BusinessProfileDraftContent => ({
  company: {
    companyName: "Equipify",
    website: "https://equipify.ai",
    shortDescription: "Service operations platform for equipment-centric businesses",
    productsServices: ["Work orders", "Dispatch", "Maintenance plans"],
    businessModel: "B2B SaaS",
    primaryValueProposition:
      "Reduce operational complexity for companies that maintain and service physical equipment.",
  },
  idealCustomers: {
    targetIndustries: ["Medical equipment service", "Field service"],
    companySizeRanges: ["20-200"],
    geography: ["United States"],
    buyerPersonas: ["Operations leaders", "Service directors"],
    disqualifiers: ["Pure software companies with no field service"],
  },
  problemsAndTriggers: {
    painPoints: ["Scattered handoffs", "Poor service visibility"],
    buyingTriggers: ["Hiring technicians", "Multi-site expansion"],
    competitorsAlternatives: ["Spreadsheets", "Generic FSM tools"],
    keywords: ["service operations"],
    negativeKeywords: [],
  },
  salesAndMarketing: {
    averageDealSize: null,
    salesCycleEstimate: null,
    messagingAngles: ["Outcome-first service visibility"],
    qualificationCriteria: ["Has field or depot service work"],
  },
  businessStrategy: {
    companyWide: {
      mission: "Help equipment businesses run cleaner service operations",
      coreValues: ["Evidence over assumptions"],
      brandPersonality: "Practical and consultative",
    },
    messaging: {
      elevatorPitch:
        "Equipify helps service teams replace scattered handoffs with a clearer operating rhythm.",
      tone: "consultative",
      formality: "professional",
      emailLengthPreference: "short",
      ctaPreferences: ["15-minute workflow review"],
      wordsToAvoid: ["synergy"],
      neverSay: ["guaranteed ROI"],
    },
    positioning: {
      competitiveAdvantages: ["Built for equipment-centric service operators"],
      pricingPhilosophy: "Value over discounting",
      neverCompeteOnPrice: true,
      competitorNotes: ["Do not lead with competitor attacks"],
    },
    objections: {
      items: [
        {
          objection: "We already have a system.",
          preferredResponse:
            "Understood — the useful question is whether handoffs and visibility are still creating quiet delay.",
        },
      ],
    },
    salesPhilosophy: {
      qualificationStandards: ["Evidence of service operations complexity"],
      disqualifiers: ["No physical equipment service motion"],
      discoveryQuestions: [
        "Where do service handoffs still break down?",
        "What does a clean service week look like for your team?",
      ],
      buyingSignals: ["Hiring technicians", "Depot expansion"],
    },
    salesAndRelationships: { principles: ["Discovery before pitch"], notes: "" },
    marketingAndBrand: { principles: [], notes: "" },
    customerExperience: { principles: [], notes: "" },
    serviceStandards: { principles: [], notes: "" },
    financialGuidelines: { principles: [], notes: "" },
    confidence: { score: 0.8, assumptions: [], missingInformation: [] },
  },
  confidence: { score: 0.8, assumptions: [], missingInformation: [] },
})

const thinPlaybook = (): GrowthIndustryPlaybook =>
  ({
    id: "medical_equipment",
    industryId: "medical_equipment",
    displayName: "Medical equipment",
    overview: "Medical equipment service operators",
    pains: ["Aging fleet downtime"],
    discoveryQuestions: ["PLAYBOOK_ONLY_DISCOVERY"],
    objections: ["PLAYBOOK_ONLY_OBJECTION"],
    proofPoints: [],
    capabilityMappings: [],
    videoStorylines: [],
    sharePageStorylines: [],
    recommendedCtas: ["PLAYBOOK_ONLY_CTA"],
    keywords: [],
  }) as GrowthIndustryPlaybook

console.log(
  `[${GROWTH_AIOS_SALES_PLAYBOOK_1B_QA_MARKER}] Canonical seller knowledge wiring certification`,
)

assert.equal(
  GROWTH_AIOS_SALES_PLAYBOOK_1B_QA_MARKER,
  "ge-aios-sales-playbook-1b-canonical-seller-knowledge-wiring-v1",
)
assert.equal(GROWTH_OUTREACH_SALES_STRATEGY_BRIEF_VERSION, "outreach-sales-strategy-brief-v3")

const seller = buildOutreachSellerTruth({
  profileId: "profile-1",
  profile: sampleProfile(),
  sellerCompanyName: "Equipify",
  biEnrichmentLines: extractBusinessIntelligenceEnrichmentLines({
    sections: {
      company: {
        differentiators: { value: "BI-only differentiator" },
      },
      sales_and_growth: {
        likely_pain_points: { value: ["BI pain"] },
      },
    },
  }),
  organizationalKnowledge: [
    {
      knowledge_id: "k1",
      organization_id: "org",
      source: "bi_review",
      specialist: null,
      category: "messaging",
      finding: "Validated messaging: lead with service visibility",
      confidence: 0.9,
      supporting_event_count: 3,
      first_observed_at: "2026-07-01T00:00:00.000Z",
      last_confirmed_at: "2026-07-10T00:00:00.000Z",
      superseded_by: null,
      active: true,
      metadata: {},
    },
  ],
  knowledgeCenterLines: ["case_study: Depot repair visibility"],
  industryPlaybook: thinPlaybook(),
})

assert.equal(seller.source, "approved_business_profile")
assert.match(seller.primaryValueProposition ?? "", /Reduce operational complexity/)
assert.match(seller.elevatorPitch ?? "", /clearer operating rhythm/)
assert.equal(seller.ctaPreferences[0], "15-minute workflow review")
assert.equal(seller.objections[0]?.objection, "We already have a system.")
assert.ok(seller.discoveryQuestions.some((q) => /handoffs still break down/i.test(q)))
assert.equal(seller.industryPlaybookUsedAsFallback, false)
assert.ok(!seller.discoveryQuestions.includes("PLAYBOOK_ONLY_DISCOVERY"))
assert.ok(seller.biUsedAsEnrichmentOnly)
assert.ok(seller.enrichments.fromKnowledgeCenter[0]?.includes("case_study"))
assert.ok(seller.enrichments.fromOrganizationalKnowledge.some((line) => /Validated messaging/i.test(line)))
console.log("  ✓ Business Profile + Strategy loaded as seller SoT; playbook not overriding")

const fallbackSeller = buildOutreachSellerTruth({
  profile: null,
  industryPlaybook: thinPlaybook(),
})
assert.equal(fallbackSeller.source, "fallback_defaults")
assert.equal(fallbackSeller.industryPlaybookUsedAsFallback, true)
assert.ok(fallbackSeller.discoveryQuestions.includes("PLAYBOOK_ONLY_DISCOVERY"))
console.log("  ✓ Industry Playbook used only as fallback when profile absent")

assert.equal(deriveOutreachRelationshipStage({ contactTemperature: "cold" }), "Cold")
assert.equal(
  deriveOutreachRelationshipStage({ relationshipStrengthTier: "trusted" }),
  "Engaged",
)
assert.equal(deriveOutreachRelationshipStage({ leadStatus: "converted" }), "Customer")
console.log("  ✓ Relationship stage derives conservatively from existing runtime")

const brief = buildOutreachSalesStrategyBrief({
  leadId: "lead-1",
  companyName: "block imaging",
  preparedAt: "2026-07-13T16:40:40.229Z",
  website: "https://example.com/block-imaging",
  contactName: "Josh Block",
  contactTitle: "President",
  contactEmail: "josh@example.com",
  contactPhone: "+15555550100",
  equipmentServiced: ["MRI", "CT"],
  verifiedEvidence: [
    "Company summary: Nationwide depot repair for imaging systems",
    "Hiring biomedical technicians",
  ],
  missingEvidence: [],
  opportunitySummary: "Strong imaging service fit",
  fitReason: "Fits approved ICP",
  qualificationConfidence: 0.78,
  sellerTruth: seller,
  relationshipStrengthTier: "developing",
  contactTemperature: "warming",
})

assert.ok(brief.sellerTruth)
assert.ok(brief.prospectTruth)
assert.ok(brief.conversationStrategy)
assert.ok(brief.conversationJustification)
assert.match(brief.businessValue, /clearer operating rhythm|Reduce operational complexity/)
assert.equal(brief.recommendedCta, "15-minute workflow review")
assert.equal(brief.objections[0]?.objection, "We already have a system.")
assert.equal(brief.relationshipStage, "Aware")
assert.ok(!/Equipify helps field-service and equipment teams replace scattered handoffs/i.test(brief.businessValue))
console.log("  ✓ Seller + Prospect + Conversation Strategy generated; hardcoded value replaced")

const drafts = generateOutreachDraftsFromSalesStrategyBrief({
  brief,
  senderName: "Jordan",
})
assert.match(drafts.email.full, /Conversation justification|earning a reply|workflow/i)
assert.match(drafts.callGuide, /Conversation justification/)
assert.match(drafts.callGuide, /Relationship stage/)
assert.equal(
  drafts.qualityFailures.filter((f) => f.startsWith("cliche:")).length,
  0,
  drafts.qualityFailures.join(", "),
)
console.log("  ✓ All channel drafts inherit one strategy including conversation justification")

const pkg: GrowthAutonomousOutreachApprovalPackage = {
  packageId: "outreach-prep:lead-1:2026-07-13T16:40:40.229Z",
  leadId: "lead-1",
  companyName: "block imaging",
  preparedAt: brief.preparedAt,
  generatedAssets: [
    { channel: "email", label: "Email", preview: drafts.email.full, draftOnly: true },
    { channel: "linkedin", label: "LinkedIn", preview: drafts.linkedIn, draftOnly: true },
    { channel: "sms", label: "SMS", preview: drafts.sms, draftOnly: true },
    { channel: "call", label: "Call guide", preview: drafts.callGuide, draftOnly: true },
    { channel: "sendr", label: "Personalized Video", preview: drafts.personalizedVideo, draftOnly: true },
    { channel: "follow_up", label: "Follow-up sequence", preview: drafts.followUpSequence, draftOnly: true },
  ],
  salesStrategyBrief: brief,
  personalizationEvidence: [`Seller source: ${seller.source}`],
  supportingResearch: brief.evidence.map((row) => row.detail).slice(0, 3),
  confidence: brief.confidence,
  approvalRequirements: ["operator_outbound_approval"],
  complianceNotes: ["Draft-only"],
  recommendedChannel: "email",
  recommendedSequence: "email_first_multichannel",
  expectedOutcome: brief.businessObjective,
  pendingHumanApproval: true,
  transportBlocked: true,
}

const packet = projectApprovals2AOperatorReviewPacket({
  pkg,
  teammateName: "Jordan",
})
assert.ok(packet.knowledgeLayers.sellerTruth.some((line) => /Approved Business Profile/i.test(line)))
assert.ok(packet.knowledgeLayers.prospectTruth.some((line) => /block imaging/i.test(line)))
assert.ok(
  packet.knowledgeLayers.conversationStrategy.some((line) => /Justification|Why this/i.test(line)),
)
console.log("  ✓ Approval packet distinguishes Seller / Prospect / Conversation layers")

const draftService = readSource(
  "lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts",
)
assert.match(draftService, /loadOutreachSellerTruthForOrganization/)
assert.match(draftService, /getActiveApprovedBusinessProfile|loadOutreachSellerTruth/)
assert.equal(draftService.includes("createTable"), false)
assert.match(
  readSource("lib/growth/aios/growth/growth-outreach-seller-truth-loader.ts"),
  /getActiveApprovedBusinessProfile/,
)
assert.match(
  readSource("lib/growth/aios/growth/growth-outreach-seller-truth-loader.ts"),
  /fetchLatestBusinessIntelligenceReport/,
)
assert.match(
  readSource("lib/growth/aios/growth/growth-outreach-seller-truth-loader.ts"),
  /fetchOrganizationKnowledgeStore/,
)
assert.match(
  readSource("lib/growth/aios/growth/growth-outreach-seller-truth-loader.ts"),
  /runKnowledgeRetrieval/,
)
assert.match(
  readSource("lib/growth/aios/growth/growth-outreach-seller-truth-loader.ts"),
  /resolveIndustryPlaybook/,
)
console.log("  ✓ Loader reuses profile / BI / org knowledge / KC / playbooks — no new store")

const card = readSource(
  "components/growth/ai-os/approvals/growth-ava-completed-outreach-package-card.tsx",
)
assert.match(card, /Seller truth/)
assert.match(card, /Prospect truth/)
assert.match(card, /Conversation strategy/)
assert.match(card, /Conversation justification/)

const pkgJson = readSource("package.json")
assert.ok(pkgJson.includes("test:ge-aios-sales-playbook-1b-canonical-seller-knowledge-wiring"))
assert.ok(
  readSource("lib/growth/draft-factory/draft-factory-durable-service.ts").includes("Growth 5F") ||
    readSource("lib/growth/draft-factory/draft-factory-service.ts").includes("Growth 5F"),
)
console.log("  ✓ UI explainability + package script; Draft Factory / Growth 5F architecture preserved")

// Legacy package without sellerTruth still projects.
const legacyPacket = projectApprovals2AOperatorReviewPacket({
  pkg: {
    ...pkg,
    salesStrategyBrief: undefined,
  },
  teammateName: "Jordan",
})
assert.ok(legacyPacket.knowledgeLayers)
assert.equal(legacyPacket.pendingHumanApproval, true)
assert.equal(legacyPacket.transportBlocked, true)
console.log("  ✓ Existing packages without sellerTruth continue working")

console.log(`\n[${GROWTH_AIOS_SALES_PLAYBOOK_1B_QA_MARKER}] PASS`)
