/**
 * GE-AIOS-EQUIPIFY-MASTER-KNOWLEDGE-1B — Production profile enrichment apply helpers (client-safe).
 */

import { createHash } from "node:crypto"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import {
  EQUIPIFY_MASTER_CONTEXT_SOURCE_DOCUMENT_ID,
  EQUIPIFY_MASTER_KNOWLEDGE_VERSION,
  GROWTH_AIOS_EQUIPIFY_MASTER_KNOWLEDGE_1B_QA_MARKER,
  type EquipifyMasterKnowledgeIngestionMeta,
} from "@/lib/growth/business-profile/equipify-master-knowledge-types"
import type { MasterContextIngestionHints } from "@/lib/growth/business-profile/equipify-master-knowledge-merge"
import { isEquipifyMasterKnowledgeEnriched } from "@/lib/growth/business-profile/equipify-master-knowledge-merge"
import { listFutureEquipifyCapabilities } from "@/lib/growth/business-profile/equipify-master-knowledge-canonical"

export const EQUIPIFY_MASTER_KNOWLEDGE_PRODUCTION_ORG_ID =
  "5876176a-61ec-4532-ad99-0c31482d5a91" as const

export type ProfileEnrichmentDiffCategory = {
  added: string[]
  updated: string[]
  unchanged: string[]
  conflicts: string[]
  futureRoadmapItems: string[]
  operatorPreserved: string[]
}

export type BusinessStrategyCompletenessReport = {
  score: number
  present: string[]
  missing: string[]
}

export type EnrichedProfileQualityReport = {
  ready: boolean
  completeness: BusinessStrategyCompletenessReport
  remainingGaps: string[]
  futureCapabilitiesLabeled: boolean
  fabricatedMetricsDetected: boolean
}

const QUALITY_CHECKS: Array<{ key: string; test: (profile: BusinessProfileDraftContent) => boolean }> =
  [
    {
      key: "Equipify Operations product definition",
      test: (p) => Boolean(p.company.shortDescription?.trim() && p.company.productsServices.length >= 3),
    },
    {
      key: "Current modules/workflows",
      test: (p) =>
        (p.canonicalSellerKnowledge?.products.modules.filter((m) => m.availability === "current").length ??
          0) >= 5,
    },
    {
      key: "Current vs future capability boundaries",
      test: (p) =>
        Boolean(
          p.canonicalSellerKnowledge?.products.modules.some((m) => m.availability === "future") &&
            p.canonicalSellerKnowledge?.company.futureRoadmapNote?.includes("never"),
        ),
    },
    { key: "ICP and disqualifiers", test: (p) => p.idealCustomers.disqualifiers.length >= 3 },
    {
      key: "Industries",
      test: (p) =>
        (p.canonicalSellerKnowledge?.industries.length ?? 0) >= 3 ||
        p.idealCustomers.targetIndustries.length >= 3,
    },
    {
      key: "Personas",
      test: (p) => (p.canonicalSellerKnowledge?.personas.length ?? 0) >= 4,
    },
    {
      key: "Positioning",
      test: (p) =>
        (p.businessStrategy?.positioning.competitiveAdvantages.length ?? 0) >= 1 ||
        (p.canonicalSellerKnowledge?.company.differentiators.length ?? 0) >= 1,
    },
    {
      key: "Primary value proposition",
      test: (p) => Boolean(p.company.primaryValueProposition?.trim()),
    },
    {
      key: "Elevator pitch",
      test: (p) => Boolean(p.businessStrategy?.messaging.elevatorPitch?.trim()),
    },
    {
      key: "Discovery philosophy",
      test: (p) =>
        (p.canonicalSellerKnowledge?.discovery.principles.length ?? 0) >= 3 ||
        (p.businessStrategy?.salesPhilosophy.discoveryQuestions.length ?? 0) >= 3,
    },
    {
      key: "Sales philosophy",
      test: (p) =>
        (p.canonicalSellerKnowledge?.equipifySalesPhilosophy.length ?? 0) >= 5 ||
        (p.businessStrategy?.salesAndRelationships.principles.length ?? 0) >= 3,
    },
    {
      key: "CTA preferences",
      test: (p) => (p.businessStrategy?.messaging.ctaPreferences.length ?? 0) >= 1,
    },
    {
      key: "Words to avoid / never-say",
      test: (p) =>
        (p.businessStrategy?.messaging.wordsToAvoid.length ?? 0) >= 1 &&
        (p.businessStrategy?.messaging.neverSay.length ?? 0) >= 1,
    },
    {
      key: "Objections and responses",
      test: (p) => (p.businessStrategy?.objections.items.length ?? 0) >= 1,
    },
    {
      key: "Competitive positioning",
      test: (p) => (p.canonicalSellerKnowledge?.competitors.length ?? 0) >= 2,
    },
    {
      key: "Proof limitations (no fabricated metrics)",
      test: (p) =>
        (p.canonicalSellerKnowledge?.proof ?? []).every(
          (row) => !/\d+%|\$\d|guaranteed roi/i.test(row.evidenceNote + row.businessOutcome),
        ),
    },
    {
      key: "Pricing/commercial guidance",
      test: (p) => Boolean(p.canonicalSellerKnowledge?.commercial.pricingPhilosophy?.trim()),
    },
    {
      key: "Implementation/integration guidance",
      test: (p) => Boolean(p.canonicalSellerKnowledge?.commercial.implementationExpectations?.trim()),
    },
    {
      key: "Buying psychology",
      test: (p) => (p.canonicalSellerKnowledge?.buyingPsychology.length ?? 0) >= 3,
    },
    {
      key: "When not to recommend Equipify",
      test: (p) =>
        (p.canonicalSellerKnowledge?.company.whenNotToRecommend.length ?? 0) >= 3 ||
        p.idealCustomers.disqualifiers.length >= 3,
    },
  ]

function stableJson(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort())
}

export function computeMasterKnowledgeContentFingerprint(input: {
  hints: MasterContextIngestionHints
  canonicalVersion?: string
  profileId?: string | null
}): string {
  const payload = {
    sourceDocumentId: EQUIPIFY_MASTER_CONTEXT_SOURCE_DOCUMENT_ID,
    ingestionVersion: GROWTH_AIOS_EQUIPIFY_MASTER_KNOWLEDGE_1B_QA_MARKER,
    canonicalVersion: input.canonicalVersion ?? EQUIPIFY_MASTER_KNOWLEDGE_VERSION,
    hints: {
      ingestedSections: [...input.hints.ingestedSections].sort(),
      platformSummary: input.hints.platformSummary,
      corePlatformStatus: input.hints.corePlatformStatus,
      staffAppAudience: input.hints.staffAppAudience,
    },
    profileId: input.profileId ?? null,
  }
  return createHash("sha256").update(stableJson(payload)).digest("hex").slice(0, 16)
}

export function attachProductionMasterKnowledgeIngestionMeta(
  profile: BusinessProfileDraftContent,
  input: {
    hints: MasterContextIngestionHints
    fingerprint: string
    appliedAt: string
  },
): BusinessProfileDraftContent {
  const meta: EquipifyMasterKnowledgeIngestionMeta = {
    source: "master_context_document",
    sourceDocumentId: EQUIPIFY_MASTER_CONTEXT_SOURCE_DOCUMENT_ID,
    ingestionVersion: GROWTH_AIOS_EQUIPIFY_MASTER_KNOWLEDGE_1B_QA_MARKER,
    contentFingerprint: input.fingerprint,
    ingestedAt: input.appliedAt,
    appliedAt: input.appliedAt,
    sourceMarker: input.hints.sourceMarker,
    isRuntimeSourceOfTruth: false,
    mergedSections: profile.masterKnowledgeIngestion?.mergedSections ?? [],
  }
  return { ...profile, masterKnowledgeIngestion: meta }
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim())
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const norm = (rows: string[]) => rows.map((r) => r.trim().toLowerCase()).sort()
  const left = norm(a)
  const right = norm(b)
  return left.every((row, idx) => row === right[idx])
}

export function computeProfileEnrichmentDiff(
  before: BusinessProfileDraftContent,
  after: BusinessProfileDraftContent,
): ProfileEnrichmentDiffCategory {
  const diff: ProfileEnrichmentDiffCategory = {
    added: [],
    updated: [],
    unchanged: [],
    conflicts: [],
    futureRoadmapItems: [],
    operatorPreserved: [],
  }

  if (!before.canonicalSellerKnowledge && after.canonicalSellerKnowledge) {
    diff.added.push("canonicalSellerKnowledge")
  } else if (before.canonicalSellerKnowledge && after.canonicalSellerKnowledge) {
    if (
      before.canonicalSellerKnowledge.version !== after.canonicalSellerKnowledge.version
    ) {
      diff.updated.push("canonicalSellerKnowledge.version")
    } else {
      diff.unchanged.push("canonicalSellerKnowledge.version")
    }
  }

  if (!before.masterKnowledgeIngestion && after.masterKnowledgeIngestion) {
    diff.added.push("masterKnowledgeIngestion")
  } else if (
    before.masterKnowledgeIngestion?.contentFingerprint &&
    after.masterKnowledgeIngestion?.contentFingerprint &&
    before.masterKnowledgeIngestion.contentFingerprint !==
      after.masterKnowledgeIngestion.contentFingerprint
  ) {
    diff.updated.push("masterKnowledgeIngestion.contentFingerprint")
  }

  if (!before.businessStrategy && after.businessStrategy) {
    diff.added.push("businessStrategy")
  } else if (before.businessStrategy && after.businessStrategy) {
    const beforePitch = before.businessStrategy.messaging.elevatorPitch.trim()
    const afterPitch = after.businessStrategy.messaging.elevatorPitch.trim()
    if (!beforePitch && afterPitch) diff.added.push("businessStrategy.messaging.elevatorPitch")
    else if (beforePitch && afterPitch === beforePitch) {
      diff.operatorPreserved.push("businessStrategy.messaging.elevatorPitch")
      diff.unchanged.push("businessStrategy.messaging.elevatorPitch")
    } else if (beforePitch && afterPitch !== beforePitch) {
      diff.updated.push("businessStrategy.messaging.elevatorPitch")
    }

    if (
      (after.businessStrategy.salesPhilosophy.discoveryQuestions.length ?? 0) >
      (before.businessStrategy.salesPhilosophy.discoveryQuestions.length ?? 0)
    ) {
      diff.updated.push("businessStrategy.salesPhilosophy.discoveryQuestions")
    }
  } else if (!after.businessStrategy) {
    diff.conflicts.push("businessStrategy missing after enrichment")
  }

  const operatorFields: Array<{ path: string; before: string; after: string }> = [
    {
      path: "company.shortDescription",
      before: before.company.shortDescription,
      after: after.company.shortDescription,
    },
    {
      path: "company.primaryValueProposition",
      before: before.company.primaryValueProposition,
      after: after.company.primaryValueProposition,
    },
  ]

  for (const field of operatorFields) {
    if (hasText(field.before)) {
      if (field.before.trim() === field.after.trim()) {
        diff.operatorPreserved.push(field.path)
        diff.unchanged.push(field.path)
      } else {
        diff.conflicts.push(`${field.path} would change operator-authored value`)
      }
    } else if (hasText(field.after)) {
      diff.added.push(field.path)
    }
  }

  if (
    after.idealCustomers.targetIndustries.length > before.idealCustomers.targetIndustries.length
  ) {
    diff.unchanged.push("idealCustomers.targetIndustries (operator list preserved; no shrink)")
  } else {
    diff.unchanged.push("idealCustomers.targetIndustries")
  }

  if (!arraysEqual(before.idealCustomers.disqualifiers, after.idealCustomers.disqualifiers)) {
    if (after.idealCustomers.disqualifiers.length >= before.idealCustomers.disqualifiers.length) {
      diff.updated.push("idealCustomers.disqualifiers")
    }
  } else {
    diff.unchanged.push("idealCustomers.disqualifiers")
  }

  const futureModules =
    after.canonicalSellerKnowledge?.products.modules.filter((m) => m.availability === "future") ??
    []
  for (const module of futureModules) {
    diff.futureRoadmapItems.push(`${module.feature} (${module.availability})`)
  }
  for (const cap of listFutureEquipifyCapabilities(after.canonicalSellerKnowledge)) {
    if (!diff.futureRoadmapItems.some((row) => row.includes(cap))) {
      diff.futureRoadmapItems.push(`${cap} (future)`)
    }
  }

  if (after.company.productsServices.length > before.company.productsServices.length) {
    diff.updated.push("company.productsServices")
  }

  return diff
}

export function assessBusinessStrategyCompleteness(
  profile: BusinessProfileDraftContent,
): BusinessStrategyCompletenessReport {
  const strategy = profile.businessStrategy
  const checks = [
    { key: "elevatorPitch", ok: Boolean(strategy?.messaging.elevatorPitch?.trim()) },
    { key: "discoveryQuestions", ok: (strategy?.salesPhilosophy.discoveryQuestions.length ?? 0) >= 3 },
    { key: "ctaPreferences", ok: (strategy?.messaging.ctaPreferences.length ?? 0) >= 1 },
    { key: "objections", ok: (strategy?.objections.items.length ?? 0) >= 1 },
    { key: "competitiveAdvantages", ok: (strategy?.positioning.competitiveAdvantages.length ?? 0) >= 1 },
    { key: "salesPhilosophy", ok: (strategy?.salesAndRelationships.principles.length ?? 0) >= 3 },
    { key: "canonicalSellerKnowledge", ok: isEquipifyMasterKnowledgeEnriched(profile) },
  ]
  const present = checks.filter((c) => c.ok).map((c) => c.key)
  const missing = checks.filter((c) => !c.ok).map((c) => c.key)
  return {
    score: present.length / checks.length,
    present,
    missing,
  }
}

export function validateEnrichedProfileForProductionApply(
  profile: BusinessProfileDraftContent,
): EnrichedProfileQualityReport {
  const present: string[] = []
  const missing: string[] = []
  for (const check of QUALITY_CHECKS) {
    if (check.test(profile)) present.push(check.key)
    else missing.push(check.key)
  }

  const fabricatedMetricsDetected = (profile.canonicalSellerKnowledge?.proof ?? []).some((row) =>
    /\d+%|\$\d|guaranteed roi/i.test(`${row.evidenceNote} ${row.businessOutcome}`),
  )

  const futureCapabilitiesLabeled =
    (profile.canonicalSellerKnowledge?.products.modules ?? [])
      .filter((m) => m.availability === "future")
      .every((m) => /never|future|not/i.test(m.whenNotToIntroduce)) &&
    !profile.company.productsServices.some((cap) =>
      listFutureEquipifyCapabilities().some(
        (future) => future.toLowerCase() === cap.toLowerCase(),
      ),
    )

  return {
    ready: missing.length <= 2 && !fabricatedMetricsDetected && futureCapabilitiesLabeled,
    completeness: {
      score: present.length / QUALITY_CHECKS.length,
      present,
      missing,
    },
    remainingGaps: missing,
    futureCapabilitiesLabeled,
    fabricatedMetricsDetected,
  }
}

export function profilesAreEnrichmentIdentical(
  before: BusinessProfileDraftContent,
  after: BusinessProfileDraftContent,
): boolean {
  const beforeFp = before.masterKnowledgeIngestion?.contentFingerprint
  const afterFp = after.masterKnowledgeIngestion?.contentFingerprint
  if (beforeFp && afterFp && beforeFp === afterFp && isEquipifyMasterKnowledgeEnriched(before)) {
    return true
  }
  return stableJson({
    canonical: before.canonicalSellerKnowledge?.version,
    strategyPitch: before.businessStrategy?.messaging.elevatorPitch,
    ingestion: before.masterKnowledgeIngestion?.contentFingerprint,
  }) ===
    stableJson({
      canonical: after.canonicalSellerKnowledge?.version,
      strategyPitch: after.businessStrategy?.messaging.elevatorPitch,
      ingestion: after.masterKnowledgeIngestion?.contentFingerprint,
    })
}

export function isProductionEnrichmentIdempotent(
  stored: BusinessProfileDraftContent,
  enriched: BusinessProfileDraftContent,
): boolean {
  if (!isEquipifyMasterKnowledgeEnriched(stored)) return false
  const storedFp = stored.masterKnowledgeIngestion?.contentFingerprint
  const enrichedFp = enriched.masterKnowledgeIngestion?.contentFingerprint
  return Boolean(storedFp && enrichedFp && storedFp === enrichedFp)
}
