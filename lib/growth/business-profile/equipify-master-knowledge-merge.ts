/**
 * GE-AIOS-EQUIPIFY-MASTER-KNOWLEDGE-1A — Profile merge (client-safe, no MCD file I/O).
 */

import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import {
  resolveBusinessStrategyContent,
  type BusinessStrategyContent,
} from "@/lib/growth/training/growth-business-strategy-types"
import {
  buildEquipifyCanonicalSellerKnowledge,
  EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE,
  listCurrentEquipifyCapabilities,
} from "@/lib/growth/business-profile/equipify-master-knowledge-canonical"
import {
  GROWTH_AIOS_EQUIPIFY_MASTER_KNOWLEDGE_1A_QA_MARKER,
  type EquipifyCanonicalSellerKnowledge,
  type EquipifyMasterKnowledgeIngestionMeta,
} from "@/lib/growth/business-profile/equipify-master-knowledge-types"

export type MasterContextIngestionHints = {
  platformSummary: string | null
  corePlatformStatus: string | null
  staffAppAudience: string | null
  ingestedSections: string[]
  sourceMarker: string
}

export const EMPTY_MASTER_CONTEXT_INGESTION_HINTS: MasterContextIngestionHints = {
  platformSummary: null,
  corePlatformStatus: null,
  staffAppAudience: null,
  ingestedSections: ["canonical_seller_knowledge"],
  sourceMarker: `${GROWTH_AIOS_EQUIPIFY_MASTER_KNOWLEDGE_1A_QA_MARKER}:canonical-only`,
}

function mergeStringArray(existing: string[], incoming: string[], limit = 12): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of [...existing, ...incoming]) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
    if (out.length >= limit) break
  }
  return out
}

function mergeBusinessStrategyFromCanonical(
  existing: BusinessStrategyContent | undefined,
  canonical: EquipifyCanonicalSellerKnowledge,
  hints: MasterContextIngestionHints,
): BusinessStrategyContent {
  const base = resolveBusinessStrategyContent(existing)
  const company = canonical.company

  return {
    ...base,
    companyWide: {
      ...base.companyWide,
      mission: base.companyWide.mission.trim() || company.mission,
      coreValues: mergeStringArray(base.companyWide.coreValues, company.values, 8),
      brandPersonality:
        base.companyWide.brandPersonality.trim() ||
        "Practical, consultative, evidence-led — never hype-driven.",
    },
    messaging: {
      ...base.messaging,
      elevatorPitch: base.messaging.elevatorPitch.trim() || company.mission,
      tone: base.messaging.tone.trim() || "consultative",
      formality: base.messaging.formality.trim() || "professional",
      emailLengthPreference: base.messaging.emailLengthPreference.trim() || "short",
      ctaPreferences: mergeStringArray(base.messaging.ctaPreferences, [
        "15-minute workflow review",
        "Short discovery conversation",
      ], 4),
      wordsToAvoid: mergeStringArray(base.messaging.wordsToAvoid, [
        "synergy",
        "guaranteed ROI",
        "game-changer",
        "cutting-edge",
      ], 8),
      neverSay: mergeStringArray(base.messaging.neverSay, [
        "guaranteed ROI",
        "we are the only solution",
      ], 8),
    },
    positioning: {
      ...base.positioning,
      competitiveAdvantages: mergeStringArray(
        base.positioning.competitiveAdvantages,
        company.differentiators,
        8,
      ),
      pricingPhilosophy:
        base.positioning.pricingPhilosophy.trim() || canonical.commercial.pricingPhilosophy,
      competitorNotes: mergeStringArray(
        base.positioning.competitorNotes,
        canonical.competitors.map((row) => row.professionalDiscussion),
        6,
      ),
    },
    objections: {
      items:
        base.objections.items.length > 0
          ? base.objections.items
          : canonical.industries
              .flatMap((row) => row.typicalObjections)
              .slice(0, 3)
              .map((objection) => ({
                objection,
                preferredResponse:
                  "Acknowledge the concern, return to the specific workflow outcome, and offer a proportional next step.",
              })),
    },
    salesPhilosophy: {
      ...base.salesPhilosophy,
      qualificationStandards: mergeStringArray(
        base.salesPhilosophy.qualificationStandards,
        company.businessPhilosophy,
        8,
      ),
      disqualifiers: mergeStringArray(
        base.salesPhilosophy.disqualifiers,
        company.whenNotToRecommend,
        10,
      ),
      discoveryQuestions: mergeStringArray(
        base.salesPhilosophy.discoveryQuestions,
        canonical.discovery.diagnosticOrder,
        6,
      ),
      buyingSignals: mergeStringArray(
        base.salesPhilosophy.buyingSignals,
        canonical.industries.flatMap((row) => row.buyingTriggers).slice(0, 6),
        6,
      ),
    },
    salesAndRelationships: {
      principles: mergeStringArray(
        base.salesAndRelationships.principles,
        canonical.equipifySalesPhilosophy,
        12,
      ),
      notes:
        base.salesAndRelationships.notes.trim() ||
        canonical.discovery.principles.join(" "),
    },
    marketingAndBrand: {
      ...base.marketingAndBrand,
      principles: mergeStringArray(
        base.marketingAndBrand.principles,
        company.businessPhilosophy.slice(0, 3),
        6,
      ),
    },
    customerExperience: {
      ...base.customerExperience,
      principles: mergeStringArray(
        base.customerExperience.principles,
        ["Respect prospect time", "Evidence-led first touch"],
        4,
      ),
    },
    serviceStandards: {
      ...base.serviceStandards,
      principles: mergeStringArray(
        base.serviceStandards.principles,
        company.operationalImprovements.slice(0, 3),
        4,
      ),
    },
    financialGuidelines: {
      ...base.financialGuidelines,
      principles: mergeStringArray(
        base.financialGuidelines.principles,
        [canonical.commercial.budgetConversation, canonical.commercial.whenNotToDiscussPricing],
        4,
      ),
    },
    confidence: {
      ...base.confidence,
      score: Math.max(base.confidence.score, 0.85),
      assumptions: mergeStringArray(base.confidence.assumptions, [
        "Canonical Equipify master knowledge merged into Approved Business Profile.",
        hints.platformSummary ? "Master Context platform summary ingested." : "Canonical seed applied without live MCD file hints.",
      ], 6),
      missingInformation: base.confidence.missingInformation,
    },
  }
}

function mergeProfileSectionsFromCanonical(
  profile: BusinessProfileDraftContent,
  canonical: EquipifyCanonicalSellerKnowledge,
  hints: MasterContextIngestionHints,
): BusinessProfileDraftContent {
  const company = canonical.company
  const currentCapabilities = listCurrentEquipifyCapabilities(canonical)

  return {
    ...profile,
    company: {
      ...profile.company,
      shortDescription:
        profile.company.shortDescription.trim() ||
        hints.platformSummary?.slice(0, 280) ||
        company.mission,
      productsServices: mergeStringArray(
        profile.company.productsServices,
        [
          ...currentCapabilities,
          "Customer portal",
          "QuickBooks integration",
          "AI OS for revenue operations",
        ],
        12,
      ),
      primaryValueProposition:
        profile.company.primaryValueProposition.trim() || company.mission,
      businessModel:
        profile.company.businessModel.trim() ||
        "B2B SaaS platform for equipment-service and field-operations companies",
    },
    idealCustomers: {
      ...profile.idealCustomers,
      buyerPersonas: mergeStringArray(
        profile.idealCustomers.buyerPersonas,
        canonical.personas.map((row) => row.persona),
        12,
      ),
      disqualifiers: mergeStringArray(
        profile.idealCustomers.disqualifiers,
        company.whenNotToRecommend,
        12,
      ),
    },
    problemsAndTriggers: {
      ...profile.problemsAndTriggers,
      painPoints: mergeStringArray(
        profile.problemsAndTriggers.painPoints,
        company.businessOutcomes,
        10,
      ),
      buyingTriggers: mergeStringArray(
        profile.problemsAndTriggers.buyingTriggers,
        canonical.industries.flatMap((row) => row.buyingTriggers).slice(0, 8),
        8,
      ),
      competitorsAlternatives: mergeStringArray(
        profile.problemsAndTriggers.competitorsAlternatives,
        canonical.competitors.map((row) => row.name),
        8,
      ),
      keywords: mergeStringArray(
        profile.problemsAndTriggers.keywords,
        ["work orders", "dispatch", "preventive maintenance", "equipment history", "field service"],
        16,
      ),
    },
    salesAndMarketing: {
      ...profile.salesAndMarketing,
      messagingAngles: mergeStringArray(
        profile.salesAndMarketing.messagingAngles,
        company.differentiators.slice(0, 3),
        6,
      ),
      qualificationCriteria: mergeStringArray(
        profile.salesAndMarketing.qualificationCriteria,
        [
          company.targetCustomer,
          ...company.whenNotToRecommend.map((row) => `Disqualify when: ${row}`),
        ],
        10,
      ),
    },
  }
}

export function buildMasterKnowledgeIngestionMeta(
  hints: MasterContextIngestionHints,
  ingestedAt: string,
): EquipifyMasterKnowledgeIngestionMeta {
  return {
    source: "master_context_document",
    ingestedAt,
    sourceMarker: hints.sourceMarker,
    isRuntimeSourceOfTruth: false,
    mergedSections: mergeStringArray(hints.ingestedSections, [
      "canonical_seller_knowledge",
      "business_strategy",
      "company_profile_sections",
    ], 12),
  }
}

export function enrichBusinessProfileWithEquipifyMasterKnowledge(
  profile: BusinessProfileDraftContent,
  options: {
    ingestedAt?: string
    canonical?: EquipifyCanonicalSellerKnowledge
    hints?: MasterContextIngestionHints
  } = {},
): BusinessProfileDraftContent {
  const canonical = options.canonical ?? buildEquipifyCanonicalSellerKnowledge()
  const hints = options.hints ?? EMPTY_MASTER_CONTEXT_INGESTION_HINTS
  const ingestedAt = options.ingestedAt ?? new Date().toISOString()

  const mergedProfile = mergeProfileSectionsFromCanonical(profile, canonical, hints)
  const mergedStrategy = mergeBusinessStrategyFromCanonical(
    mergedProfile.businessStrategy,
    canonical,
    hints,
  )

  return {
    ...mergedProfile,
    businessStrategy: mergedStrategy,
    canonicalSellerKnowledge: canonical,
    masterKnowledgeIngestion: buildMasterKnowledgeIngestionMeta(hints, ingestedAt),
    confidence: {
      ...mergedProfile.confidence,
      score: Math.max(mergedProfile.confidence.score, 0.9),
      missingInformation: mergedProfile.confidence.missingInformation.filter(
        (row) => !/business strategy|seller knowledge|master context/i.test(row),
      ),
    },
    websiteContextSummary:
      mergedProfile.websiteContextSummary?.trim() ||
      GROWTH_AIOS_EQUIPIFY_MASTER_KNOWLEDGE_1A_QA_MARKER,
  }
}

export function refreshBusinessProfileFromMasterContext(
  profile: BusinessProfileDraftContent,
  ingestedAt = new Date().toISOString(),
): BusinessProfileDraftContent {
  return enrichBusinessProfileWithEquipifyMasterKnowledge(profile, { ingestedAt })
}

export function isEquipifyMasterKnowledgeEnriched(
  profile: BusinessProfileDraftContent | null | undefined,
): boolean {
  return Boolean(
    profile?.canonicalSellerKnowledge?.version === EQUIPIFY_CANONICAL_SELLER_KNOWLEDGE.version &&
      profile?.masterKnowledgeIngestion?.isRuntimeSourceOfTruth === false,
  )
}
