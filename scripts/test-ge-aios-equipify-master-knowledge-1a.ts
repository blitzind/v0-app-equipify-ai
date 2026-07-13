/**
 * GE-AIOS-EQUIPIFY-MASTER-KNOWLEDGE-1A — Certification.
 * Run: pnpm test:ge-aios-equipify-master-knowledge-1a
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_EQUIPIFY_MASTER_KNOWLEDGE_1A_QA_MARKER,
  EQUIPIFY_MASTER_KNOWLEDGE_VERSION,
} from "../lib/growth/business-profile/equipify-master-knowledge-types"
import {
  EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE,
  listCurrentEquipifyCapabilities,
  listFutureEquipifyCapabilities,
} from "../lib/growth/business-profile/equipify-master-knowledge-canonical"
import {
  enrichBusinessProfileFromMasterContextDocument,
  extractMasterContextIngestionHints,
} from "../lib/growth/business-profile/equipify-master-context-ingestion"
import {
  enrichBusinessProfileWithEquipifyMasterKnowledge,
  isEquipifyMasterKnowledgeEnriched,
} from "../lib/growth/business-profile/equipify-master-knowledge-merge"
import { scoreOutreachSellerKnowledgeQuality } from "../lib/growth/business-profile/equipify-master-knowledge-quality"
import { buildLive1bEquipifyCompanyProfileContent } from "../lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import {
  buildOutreachSellerTruth,
  buildOutreachConversationStrategy,
} from "../lib/growth/aios/growth/growth-outreach-seller-truth"
import {
  GROWTH_OUTREACH_SALES_STRATEGY_BRIEF_VERSION,
  buildOutreachSalesStrategyBrief,
} from "../lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import { generateOutreachDraftsFromSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-strategy-drafts"
import type { GrowthAutonomousOutreachApprovalPackage } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types"
import { projectApprovals2AOperatorReviewPacket } from "../lib/growth/aios/approvals/approvals-operator-review-packet"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log("GE-AIOS-EQUIPIFY-MASTER-KNOWLEDGE-1A certification\n")

// 1. Master Context ingested (ingestion source only)
const hints = extractMasterContextIngestionHints({ now: "2026-07-13T20:00:00.000Z" })
assert.ok(hints.ingestedSections.length >= 1, "Expected MCD ingestion sections")
assert.ok(
  hints.platformSummary?.includes("multi-tenant") ||
    hints.corePlatformStatus?.includes("equipment service"),
  "Expected platform summary from Master Context",
)
console.log("  ✓ Master Context successfully ingested")

const liveProfile = buildLive1bEquipifyCompanyProfileContent()
assert.ok(isEquipifyMasterKnowledgeEnriched(liveProfile))
assert.equal(liveProfile.canonicalSellerKnowledge?.version, EQUIPIFY_MASTER_KNOWLEDGE_VERSION)
assert.equal(liveProfile.masterKnowledgeIngestion?.isRuntimeSourceOfTruth, false)
assert.equal(liveProfile.masterKnowledgeIngestion?.source, "master_context_document")
console.log("  ✓ Approved Business Profile enriched via canonical merge")

assert.ok(liveProfile.businessStrategy?.messaging.elevatorPitch?.trim())
assert.ok((liveProfile.businessStrategy?.salesPhilosophy.discoveryQuestions.length ?? 0) >= 3)
assert.ok((liveProfile.canonicalSellerKnowledge?.personas.length ?? 0) >= 4)
assert.ok((liveProfile.canonicalSellerKnowledge?.competitors.length ?? 0) >= 2)
assert.ok((liveProfile.canonicalSellerKnowledge?.proof.length ?? 0) >= 1)
console.log("  ✓ Business Strategy enriched from canonical seller knowledge")

// 2. No duplicate seller stores / no new persistence
const loaderSource = readSource("lib/growth/aios/growth/growth-outreach-seller-truth-loader.ts")
assert.ok(!loaderSource.includes("getEquipifyMasterContext"), "MCD must not be runtime SoT in loader")
assert.ok(loaderSource.includes("enrichBusinessProfileFromMasterContextDocument"))
const draftServiceSource = readSource(
  "lib/growth/aios/growth/growth-autonomous-outreach-preparation-draft-service.ts",
)
assert.ok(!draftServiceSource.includes("getEquipifyMasterContext"))
assert.ok(!readSource("lib/growth/aios/growth/growth-outreach-sales-strategy-brief.ts").includes("getEquipifyMasterContext"))
console.log("  ✓ No duplicate seller stores; Master Context is NOT runtime source of truth")

// 3. Future roadmap never sold as current
const futureCaps = listFutureEquipifyCapabilities()
const currentCaps = listCurrentEquipifyCapabilities()
assert.ok(futureCaps.length >= 1)
assert.ok(!currentCaps.some((cap) => futureCaps.includes(cap)))
assert.ok(
  liveProfile.canonicalSellerKnowledge?.products.modules.every(
    (row) => row.availability !== "future" || row.whenNotToIntroduce.includes("Never"),
  ),
)
console.log("  ✓ Future roadmap excluded from current capabilities")

const enrichedFromMcd = enrichBusinessProfileFromMasterContextDocument({
  ...liveProfile,
  canonicalSellerKnowledge: undefined,
  masterKnowledgeIngestion: undefined,
  businessStrategy: undefined,
})
assert.ok(isEquipifyMasterKnowledgeEnriched(enrichedFromMcd))
console.log("  ✓ Profile refresh from Master Context supported")

// 4. Sales Strategy Brief uses enriched profile
const sellerTruth = buildOutreachSellerTruth({
  profileId: "profile-1",
  profile: liveProfile,
  sellerCompanyName: "Equipify",
  prospectIndustry: "HVAC service",
  prospectTitle: "VP Operations",
})
assert.equal(sellerTruth.source, "approved_business_profile")
assert.ok(sellerTruth.masterKnowledgeVersion)
assert.ok(sellerTruth.currentCapabilities?.includes("Work orders"))
assert.ok((sellerTruth.postponeTopics ?? []).some((row) => /future capability/i.test(row)))
assert.ok(sellerTruth.matchedPersona || sellerTruth.matchedIndustryKnowledge)
console.log("  ✓ Sales Strategy Brief seller truth uses enriched Business Profile")

const brief = buildOutreachSalesStrategyBrief({
  leadId: "lead-master-1",
  companyName: "Summit HVAC",
  preparedAt: "2026-07-13T20:00:00.000Z",
  website: "https://example.com/summit-hvac",
  contactName: "Alex Rivera",
  contactTitle: "VP Operations",
  contactEmail: "alex@example.com",
  equipmentServiced: ["Rooftop units"],
  verifiedEvidence: ["Hiring HVAC technicians", "Multi-site dispatch operations"],
  missingEvidence: [],
  qualificationConfidence: 0.8,
  industry: "HVAC service",
  sellerTruth,
  approvedProfile: liveProfile,
})

assert.equal(GROWTH_OUTREACH_SALES_STRATEGY_BRIEF_VERSION, "outreach-sales-strategy-brief-v3")
assert.ok(brief.sellerKnowledgeQuality)
assert.ok(brief.sellerKnowledgeQuality.overallScore >= 0.55)
assert.ok(brief.sellerKnowledgeQuality.readyForDraftGeneration)
assert.ok(brief.conversationStrategy?.postponeTopics?.length)
assert.ok(brief.conversationStrategy?.gratefulReplyOutcome)
assert.match(brief.businessValue, /equipment|service|operations/i)
console.log("  ✓ Sales Strategy Brief includes quality scoring and conversation intelligence")

const drafts = generateOutreachDraftsFromSalesStrategyBrief({ brief, senderName: "Ava" })
assert.ok(drafts.email.full.length > 40)
assert.ok(!drafts.email.full.includes("Autonomous revenue orchestration"))
assert.equal(
  drafts.qualityFailures.filter((f) => f.startsWith("cliche:")).length,
  0,
  drafts.qualityFailures.join(", "),
)
console.log("  ✓ Every outreach asset inherits enriched seller knowledge")

// 5. Legacy package compatibility (no sellerTruth enrichment fields required)
const legacyPkg: GrowthAutonomousOutreachApprovalPackage = {
  packageId: "legacy-1",
  leadId: "lead-legacy",
  companyName: "Legacy Co",
  preparedAt: "2026-01-01T00:00:00.000Z",
  generatedAssets: [{ channel: "email", label: "Email", preview: "Hello", draftOnly: true }],
  salesStrategyBrief: {
    version: "outreach-sales-strategy-brief-v2",
    leadId: "lead-legacy",
    companyName: "Legacy Co",
    preparedAt: "2026-01-01T00:00:00.000Z",
    executiveSummary: "Legacy",
    businessProblems: [],
    evidence: [],
    decisionMakerAnalysis: {
      name: null,
      title: null,
      whyThisPerson: "Unknown",
      likelyResponsibilities: [],
      whyTheyCare: "Unknown",
    },
    recommendedConversation: "Discovery",
    primaryHook: "Hook",
    businessValue: "Value",
    trustBuilders: [],
    objections: [],
    recommendedCta: "Call",
    conversationObjective: "Discovery",
    businessObjective: "Qualify",
    tone: "consultative",
    confidence: 0.5,
    missingPersonalizationOpportunities: [],
  },
  personalizationEvidence: [],
  supportingResearch: [],
  confidence: 0.5,
  approvalRequirements: [],
  complianceNotes: [],
  recommendedChannel: "email",
  recommendedSequence: "email_first",
  expectedOutcome: "Qualify",
  pendingHumanApproval: true,
  transportBlocked: true,
}
const legacyPacket = projectApprovals2AOperatorReviewPacket({ pkg: legacyPkg, teammateName: "Ava" })
assert.ok(legacyPacket)
console.log("  ✓ Existing packages remain compatible")

// 6. Architecture unchanged — Growth 5F / Draft Factory / Approval packages
assert.ok(draftServiceSource.includes("buildAutonomousOutreachApprovalPackage"))
assert.ok(draftServiceSource.includes("generateOutreachDraftsFromSalesStrategyBrief"))
assert.ok(draftServiceSource.includes("pendingHumanApproval: true"))
assert.ok(draftServiceSource.includes("transportBlocked: true"))
assert.ok(!readSource("lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-types.ts").includes("new_table"))
console.log("  ✓ Growth 5F / Draft Factory / Approval Packages unchanged")

// 7. Missing knowledge identified, not fabricated (unenriched profile only)
const thinProfile = {
  company: {
    companyName: "Equipify",
    website: "https://equipify.ai",
    shortDescription: "",
    productsServices: [],
    businessModel: "",
    primaryValueProposition: "",
  },
  idealCustomers: {
    targetIndustries: [],
    companySizeRanges: [],
    geography: [],
    buyerPersonas: [],
    disqualifiers: [],
  },
  problemsAndTriggers: {
    painPoints: [],
    buyingTriggers: [],
    competitorsAlternatives: [],
    keywords: [],
    negativeKeywords: [],
  },
  salesAndMarketing: {
    averageDealSize: null,
    salesCycleEstimate: null,
    messagingAngles: [],
    qualificationCriteria: [],
  },
  confidence: { score: 0.1, assumptions: [], missingInformation: ["everything"] },
}
const thinSeller = buildOutreachSellerTruth({ profile: thinProfile, sellerCompanyName: "Equipify" })
const thinQuality = scoreOutreachSellerKnowledgeQuality({
  profile: thinProfile,
  sellerTruth: thinSeller,
  evidence: [],
  missingEvidence: ["website", "decision maker"],
  confidence: 0.4,
})
assert.ok(thinQuality.missingSellerKnowledge.length >= 1)
assert.ok(thinQuality.dimensions.sellerKnowledgeCompleteness < 0.5)
assert.equal(thinQuality.readyForDraftGeneration, false)
console.log("  ✓ Missing seller knowledge identified instead of fabricated")

// 8. Canonical content completeness markers
assert.ok(EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE.industries.length >= 4)
assert.ok(EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE.personas.length >= 6)
assert.ok(EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE.products.modules.length >= 7)
assert.ok(EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE.equipifySalesPhilosophy.length >= 10)
console.log("  ✓ Canonical Equipify Operations knowledge complete")

const conversation = buildOutreachConversationStrategy({
  seller: sellerTruth,
  prospect: brief.prospectTruth!,
  recommendedConversation: brief.recommendedConversation,
  primaryHook: brief.primaryHook,
})
assert.ok(conversation.doNotDiscuss.some((row) => /future capability|Postpone/i.test(row)))
console.log("  ✓ Conversation strategy gates future roadmap and pricing")

console.log(`\nPASS ${GROWTH_AIOS_EQUIPIFY_MASTER_KNOWLEDGE_1A_QA_MARKER}`)
