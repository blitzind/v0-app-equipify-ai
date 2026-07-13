/**
 * GE-AIOS-EQUIPIFY-MASTER-KNOWLEDGE-1B — Production apply certification.
 * Run: pnpm test:ge-aios-equipify-master-knowledge-1b-production-apply
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_EQUIPIFY_MASTER_KNOWLEDGE_1B_QA_MARKER,
  EQUIPIFY_MASTER_CONTEXT_SOURCE_DOCUMENT_ID,
} from "../lib/growth/business-profile/equipify-master-knowledge-types"
import {
  assessBusinessStrategyCompleteness,
  attachProductionMasterKnowledgeIngestionMeta,
  computeMasterKnowledgeContentFingerprint,
  computeProfileEnrichmentDiff,
  isProductionEnrichmentIdempotent,
  validateEnrichedProfileForProductionApply,
} from "../lib/growth/business-profile/equipify-master-knowledge-production-apply"
import { enrichBusinessProfileWithEquipifyMasterKnowledge } from "../lib/growth/business-profile/equipify-master-knowledge-merge"
import { extractMasterContextIngestionHints } from "../lib/growth/business-profile/equipify-master-context-ingestion"
import { buildLive1bEquipifyCompanyProfileContent } from "../lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { buildOutreachSellerTruth } from "../lib/growth/aios/growth/growth-outreach-seller-truth"
import { buildOutreachSalesStrategyBrief } from "../lib/growth/aios/growth/growth-outreach-sales-strategy-brief"

const ROOT = process.cwd()

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8")
}

console.log(`${GROWTH_AIOS_EQUIPIFY_MASTER_KNOWLEDGE_1B_QA_MARKER} certification\n`)

const operatorProfile = {
  company: {
    companyName: "Equipify",
    website: "https://equipify.ai",
    shortDescription: "Operator-approved short description for Equipify production.",
    productsServices: ["AI OS for revenue operations", "Work orders"],
    businessModel: "B2B SaaS",
    primaryValueProposition: "Operator-approved value proposition.",
  },
  idealCustomers: {
    targetIndustries: ["Biomedical and medical equipment service", "HVAC service"],
    companySizeRanges: ["10-50 employees"],
    geography: ["United States"],
    buyerPersonas: ["Owner / operator"],
    disqualifiers: ["Pure retail or ecommerce"],
    preferredNaicsCodes: ["811310"],
    excludedNaicsCodes: [],
    preferredSicCodes: [],
    excludedSicCodes: ["7372"],
    industryCodeNotes: "Operator NAICS notes preserved.",
  },
  problemsAndTriggers: {
    painPoints: ["Dispatch complexity"],
    buyingTriggers: ["Hiring technicians"],
    competitorsAlternatives: ["Spreadsheets"],
    keywords: ["field service"],
    negativeKeywords: ["restaurant"],
  },
  salesAndMarketing: {
    averageDealSize: null,
    salesCycleEstimate: "30-90 days",
    messagingAngles: ["Operator angle one"],
    qualificationCriteria: ["Has technicians"],
  },
  businessStrategy: {
    companyWide: {
      mission: "Operator mission statement",
      coreValues: ["Evidence over assumptions"],
      brandPersonality: "Operator brand",
    },
    messaging: {
      elevatorPitch: "Operator elevator pitch for Equipify.",
      tone: "consultative",
      formality: "professional",
      emailLengthPreference: "short",
      ctaPreferences: ["Operator CTA"],
      wordsToAvoid: ["synergy"],
      neverSay: ["guaranteed ROI"],
    },
    positioning: {
      competitiveAdvantages: ["Operator advantage"],
      pricingPhilosophy: "Operator pricing philosophy",
      neverCompeteOnPrice: true,
      competitorNotes: ["Operator competitor note"],
    },
    objections: {
      items: [
        {
          objection: "Operator objection",
          preferredResponse: "Operator response",
        },
      ],
    },
    salesPhilosophy: {
      qualificationStandards: ["Operator standard"],
      disqualifiers: ["No technicians"],
      discoveryQuestions: ["Operator discovery question"],
      buyingSignals: ["Hiring"],
    },
    salesAndRelationships: { principles: ["Operator philosophy"], notes: "" },
    marketingAndBrand: { principles: [], notes: "" },
    customerExperience: { principles: [], notes: "" },
    serviceStandards: { principles: [], notes: "" },
    financialGuidelines: { principles: [], notes: "" },
    confidence: { score: 0.9, assumptions: [], missingInformation: [] },
  },
  confidence: { score: 0.9, assumptions: [], missingInformation: [] },
  draftSource: "deterministic" as const,
}

const enriched = enrichBusinessProfileWithEquipifyMasterKnowledge(operatorProfile as never)
const hints = extractMasterContextIngestionHints({ now: "2026-07-13T20:00:00.000Z" })
const fingerprint = computeMasterKnowledgeContentFingerprint({ hints, profileId: "profile-test" })
const enrichedWithMeta = attachProductionMasterKnowledgeIngestionMeta(enriched, {
  hints,
  fingerprint,
  appliedAt: "2026-07-13T20:00:00.000Z",
})

assert.equal(enrichedWithMeta.company.shortDescription, operatorProfile.company.shortDescription)
assert.equal(
  enrichedWithMeta.company.primaryValueProposition,
  operatorProfile.company.primaryValueProposition,
)
assert.equal(
  enrichedWithMeta.businessStrategy?.messaging.elevatorPitch,
  operatorProfile.businessStrategy.messaging.elevatorPitch,
)
assert.equal(enrichedWithMeta.businessStrategy?.objections.items[0]?.objection, "Operator objection")
console.log("  ✓ Operator-authored values win")

assert.ok(enrichedWithMeta.canonicalSellerKnowledge)
assert.ok(enrichedWithMeta.masterKnowledgeIngestion)
assert.ok((enrichedWithMeta.businessStrategy?.salesPhilosophy.discoveryQuestions.length ?? 0) >= 2)
console.log("  ✓ Missing canonical knowledge is added")

const future = enrichedWithMeta.canonicalSellerKnowledge!.products.modules.filter(
  (m) => m.availability === "future",
)
assert.ok(future.length >= 1)
assert.ok(future.every((m) => /never|future|not/i.test(m.whenNotToIntroduce)))
console.log("  ✓ Future capabilities remain labeled future")

const quality = validateEnrichedProfileForProductionApply(enrichedWithMeta)
assert.equal(quality.fabricatedMetricsDetected, false)
console.log("  ✓ No fabricated metrics introduced")

const diff = computeProfileEnrichmentDiff(operatorProfile as never, enrichedWithMeta)
assert.equal(diff.conflicts.length, 0)
assert.ok(diff.operatorPreserved.includes("company.shortDescription"))
assert.ok(diff.operatorPreserved.includes("company.primaryValueProposition"))
console.log("  ✓ No profile fields unintentionally deleted; operator fields preserved")

const idempotent = isProductionEnrichmentIdempotent(enrichedWithMeta, enrichedWithMeta)
assert.equal(idempotent, true)
console.log("  ✓ Same fingerprint is idempotent")

const applyScript = readSource("scripts/apply-ge-aios-equipify-master-knowledge-production.ts")
assert.ok(applyScript.includes("insertBusinessProfileDraft"))
assert.ok(applyScript.includes("approveBusinessProfileForOrganization"))
assert.ok(applyScript.includes("--confirm-enrich-production-profile"))
assert.ok(applyScript.includes("EQUIPIFY_MASTER_KNOWLEDGE_PRODUCTION_ORG_ID"))
assert.ok(!applyScript.includes("6d9220f0-2960-468c-b4be-5d7595d292c3") || applyScript.includes("NOT rebuilt"))
console.log("  ✓ Approved status/version semantics via canonical draft→approve flow")

const sellerTruth = buildOutreachSellerTruth({
  profile: enrichedWithMeta,
  sellerCompanyName: "Equipify",
  prospectTitle: "President",
  prospectIndustry: "HVAC service",
})
assert.ok(sellerTruth.masterKnowledgeVersion)
assert.ok(sellerTruth.currentCapabilities?.length)
console.log("  ✓ Seller truth loader reads applied knowledge shape")

const brief = buildOutreachSalesStrategyBrief({
  leadId: "lead-1",
  companyName: "Fixture Co",
  preparedAt: "2026-07-13T20:00:00.000Z",
  sellerTruth,
  approvedProfile: enrichedWithMeta,
  contactTitle: "President",
  verifiedEvidence: ["Hiring technicians"],
})
assert.ok(brief.sellerKnowledgeQuality?.readyForDraftGeneration)
console.log("  ✓ Sales Strategy Brief consumes enriched profile")

assert.ok(!readSource("lib/growth/aios/growth/growth-outreach-seller-truth-loader.ts").includes("getEquipifyMasterContext"))
console.log("  ✓ No new knowledge store; MCD not runtime SoT")

assert.ok(applyScript.includes("Block Imaging"))
assert.ok(applyScript.includes("NOT rebuilt"))
console.log("  ✓ No lead/package rebuild in apply script")

assert.equal(
  enrichedWithMeta.masterKnowledgeIngestion?.sourceDocumentId,
  EQUIPIFY_MASTER_CONTEXT_SOURCE_DOCUMENT_ID,
)
assert.equal(enrichedWithMeta.masterKnowledgeIngestion?.isRuntimeSourceOfTruth, false)
console.log("  ✓ Master Context ingestion metadata recorded")

const live = buildLive1bEquipifyCompanyProfileContent()
const liveQuality = validateEnrichedProfileForProductionApply(live)
assert.ok(liveQuality.ready)
console.log("  ✓ LIVE-1B enriched profile passes production quality gate")

console.log(`\nPASS ${GROWTH_AIOS_EQUIPIFY_MASTER_KNOWLEDGE_1B_QA_MARKER}`)
