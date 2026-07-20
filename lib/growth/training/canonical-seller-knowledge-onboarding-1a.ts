/**
 * GE-AIOS-FIRST-CUSTOMER-SALES-READINESS-1A — Idempotent canonical seller knowledge onboarding.
 * Merges approved sources into Business Profile without overwriting operator edits.
 */

import { createHash } from "node:crypto"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import type {
  CanonicalSellerKnowledge,
  CanonicalSellerKnowledgeIngestionRecord,
  CanonicalSellerKnowledgeIngestionSource,
} from "@/lib/growth/business-profile/canonical-seller-knowledge-types"
import { GROWTH_AIOS_CANONICAL_SELLER_KNOWLEDGE_1A_QA_MARKER } from "@/lib/growth/business-profile/canonical-seller-knowledge-types"
import {
  resolveBusinessStrategyContent,
  type BusinessStrategyContent,
} from "@/lib/growth/training/growth-business-strategy-types"
import { SUPPORTED_SERVICE_VERTICALS_REGISTRY } from "@/lib/growth/business-profile/supported-service-verticals"

export type CanonicalSellerKnowledgeOnboardingSource = {
  source: CanonicalSellerKnowledgeIngestionSource
  sourceDocumentId?: string | null
  /** Seed knowledge from an org-specific provider (e.g. Equipify first customer). */
  canonicalSeed?: CanonicalSellerKnowledge | null
  /** Website/pricing hints extracted externally — enrichment only. */
  websiteSummary?: string | null
  pricingPhilosophyHint?: string | null
  mergedSections?: string[]
}

export type CanonicalSellerKnowledgeOnboardingResult = {
  profile: BusinessProfileDraftContent
  ingestion: CanonicalSellerKnowledgeIngestionRecord
  idempotent: boolean
  operatorPreserved: string[]
  mergedSections: string[]
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

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim())
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort())
}

export function computeCanonicalSellerKnowledgeFingerprint(input: {
  organizationId: string
  seedVersion?: string | null
  sources: CanonicalSellerKnowledgeOnboardingSource[]
}): string {
  const payload = {
    organizationId: input.organizationId,
    seedVersion: input.seedVersion ?? null,
    sources: input.sources.map((row) => ({
      source: row.source,
      sourceDocumentId: row.sourceDocumentId ?? null,
      mergedSections: [...(row.mergedSections ?? [])].sort(),
    })),
  }
  return createHash("sha256").update(stableJson(payload)).digest("hex").slice(0, 16)
}

function mergeBusinessStrategyFromCanonical(
  existing: BusinessStrategyContent | undefined,
  canonical: CanonicalSellerKnowledge,
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
        canonical.competitors.map((row) => `${row.name}: ${row.positioning}`),
        6,
      ),
    },
    salesPhilosophy: {
      ...base.salesPhilosophy,
      qualificationStandards: mergeStringArray(
        base.salesPhilosophy.qualificationStandards,
        [company.targetCustomer],
        6,
      ),
      disqualifiers: mergeStringArray(
        base.salesPhilosophy.disqualifiers,
        company.whenNotToRecommend,
        8,
      ),
      discoveryQuestions: mergeStringArray(
        base.salesPhilosophy.discoveryQuestions,
        canonical.discovery.diagnosticOrder,
        8,
      ),
      buyingSignals: mergeStringArray(
        base.salesPhilosophy.buyingSignals,
        canonical.industries.flatMap((row) => row.buyingTriggers).slice(0, 4),
        6,
      ),
    },
    objections: {
      items:
        base.objections.items.length > 0
          ? base.objections.items
          : canonical.personas
              .flatMap((persona) =>
                persona.objections.slice(0, 1).map((objection) => ({
                  objection,
                  preferredResponse:
                    "Acknowledge the concern, align to their desired business outcome, and keep the next step proportional.",
                })),
              )
              .slice(0, 4),
    },
    salesAndRelationships: {
      ...base.salesAndRelationships,
      principles: mergeStringArray(
        base.salesAndRelationships.principles,
        canonical.salesPhilosophyPrinciples.slice(0, 6),
        8,
      ),
    },
  }
}

function mergeProfileFromCanonical(
  profile: BusinessProfileDraftContent,
  canonical: CanonicalSellerKnowledge,
  input: CanonicalSellerKnowledgeOnboardingSource,
): { profile: BusinessProfileDraftContent; operatorPreserved: string[] } {
  const operatorPreserved: string[] = []
  const company = canonical.company

  const shortDescription = hasText(profile.company.shortDescription)
    ? (operatorPreserved.push("company.shortDescription"), profile.company.shortDescription)
    : company.mission

  const primaryValueProposition = hasText(profile.company.primaryValueProposition)
    ? (operatorPreserved.push("company.primaryValueProposition"), profile.company.primaryValueProposition)
    : company.differentiators[0] ?? profile.company.primaryValueProposition

  const supportedServiceVerticals =
    (profile.idealCustomers.supportedServiceVerticals?.length ?? 0) > 0
      ? (operatorPreserved.push("idealCustomers.supportedServiceVerticals"), profile.idealCustomers.supportedServiceVerticals)
      : SUPPORTED_SERVICE_VERTICALS_REGISTRY.map((vertical) => ({
          id: vertical.id,
          label: vertical.label,
        }))

  return {
    operatorPreserved,
    profile: {
      ...profile,
      company: {
        ...profile.company,
        shortDescription,
        primaryValueProposition,
        productsServices: mergeStringArray(
          profile.company.productsServices,
          canonical.products.modules
            .filter((m) => m.availability === "current")
            .map((m) => m.feature),
          12,
        ),
      },
      idealCustomers: {
        ...profile.idealCustomers,
        supportedServiceVerticals,
        targetIndustries: mergeStringArray(
          profile.idealCustomers.targetIndustries,
          canonical.industries.map((row) => row.industry),
          12,
        ),
        buyerPersonas: mergeStringArray(
          profile.idealCustomers.buyerPersonas,
          canonical.personas.map((row) => row.persona),
          8,
        ),
        disqualifiers: mergeStringArray(
          profile.idealCustomers.disqualifiers,
          company.whenNotToRecommend,
          10,
        ),
      },
      problemsAndTriggers: {
        ...profile.problemsAndTriggers,
        painPoints: mergeStringArray(
          profile.problemsAndTriggers.painPoints,
          company.operationalImprovements,
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
      websiteContextSummary:
        profile.websiteContextSummary?.trim() ||
        input.websiteSummary?.trim() ||
        GROWTH_AIOS_CANONICAL_SELLER_KNOWLEDGE_1A_QA_MARKER,
    },
  }
}

export function isCanonicalSellerKnowledgeEnriched(
  profile: BusinessProfileDraftContent | null | undefined,
): boolean {
  return Boolean(
    profile?.canonicalSellerKnowledge?.version &&
      profile?.masterKnowledgeIngestion?.isRuntimeSourceOfTruth === false,
  )
}

export function isCanonicalSellerKnowledgeOnboardingIdempotent(
  stored: BusinessProfileDraftContent,
  fingerprint: string,
): boolean {
  return Boolean(
    isCanonicalSellerKnowledgeEnriched(stored) &&
      stored.masterKnowledgeIngestion?.contentFingerprint === fingerprint,
  )
}

export function onboardCanonicalSellerKnowledge(input: {
  organizationId: string
  profile: BusinessProfileDraftContent
  sources: CanonicalSellerKnowledgeOnboardingSource[]
  ingestedAt?: string
}): CanonicalSellerKnowledgeOnboardingResult {
  const seedSource = input.sources.find((row) => row.canonicalSeed)
  const canonical = seedSource?.canonicalSeed
  if (!canonical) {
    throw new Error("Canonical seller knowledge onboarding requires a canonicalSeed source")
  }

  const ingestedAt = input.ingestedAt ?? new Date().toISOString()
  const fingerprint = computeCanonicalSellerKnowledgeFingerprint({
    organizationId: input.organizationId,
    seedVersion: canonical.version,
    sources: input.sources,
  })

  if (isCanonicalSellerKnowledgeOnboardingIdempotent(input.profile, fingerprint)) {
    return {
      profile: input.profile,
      ingestion: input.profile.masterKnowledgeIngestion!,
      idempotent: true,
      operatorPreserved: [],
      mergedSections: input.profile.masterKnowledgeIngestion?.mergedSections ?? [],
    }
  }

  const { profile: mergedProfile, operatorPreserved } = mergeProfileFromCanonical(
    input.profile,
    canonical,
    seedSource,
  )
  const businessStrategy = mergeBusinessStrategyFromCanonical(
    mergedProfile.businessStrategy,
    canonical,
  )

  const mergedSections = mergeStringArray(
    input.sources.flatMap((row) => row.mergedSections ?? [row.source]),
    ["canonical_seller_knowledge", "business_strategy", "company_profile_sections"],
    16,
  )

  const ingestion: CanonicalSellerKnowledgeIngestionRecord = {
    source: seedSource.source,
    sourceDocumentId: seedSource.sourceDocumentId ?? null,
    ingestionVersion: GROWTH_AIOS_CANONICAL_SELLER_KNOWLEDGE_1A_QA_MARKER,
    contentFingerprint: fingerprint,
    ingestedAt,
    appliedAt: ingestedAt,
    mergedSections,
    isRuntimeSourceOfTruth: false,
  }

  const profile: BusinessProfileDraftContent = {
    ...mergedProfile,
    businessStrategy,
    canonicalSellerKnowledge: canonical,
    masterKnowledgeIngestion: ingestion,
    confidence: {
      ...mergedProfile.confidence,
      score: Math.max(mergedProfile.confidence.score, 0.9),
      missingInformation: mergedProfile.confidence.missingInformation.filter(
        (row) => !/business strategy|seller knowledge|master context/i.test(row),
      ),
    },
  }

  return {
    profile,
    ingestion,
    idempotent: false,
    operatorPreserved,
    mergedSections,
  }
}
