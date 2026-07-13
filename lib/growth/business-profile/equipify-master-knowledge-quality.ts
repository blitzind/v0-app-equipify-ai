/**
 * GE-AIOS-EQUIPIFY-MASTER-KNOWLEDGE-1A — Pre-draft seller knowledge quality scoring.
 */

import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"
import { isEquipifyMasterKnowledgeEnriched } from "@/lib/growth/business-profile/equipify-master-knowledge-merge"
import type { GrowthOutreachEvidenceCitation } from "@/lib/growth/aios/growth/growth-outreach-seller-truth"
import type { GrowthOutreachSellerTruth } from "@/lib/growth/aios/growth/growth-outreach-seller-truth"

export const GROWTH_OUTREACH_SELLER_KNOWLEDGE_QUALITY_DIMENSIONS = [
  "researchCompleteness",
  "sellerKnowledgeCompleteness",
  "evidenceQuality",
  "personaUnderstanding",
  "conversationQuality",
  "personalization",
  "messagingQuality",
  "confidence",
] as const

export type GrowthOutreachSellerKnowledgeQualityDimension =
  (typeof GROWTH_OUTREACH_SELLER_KNOWLEDGE_QUALITY_DIMENSIONS)[number]

export type GrowthOutreachSellerKnowledgeQuality = {
  overallScore: number
  dimensions: Record<GrowthOutreachSellerKnowledgeQualityDimension, number>
  missingSellerKnowledge: string[]
  readyForDraftGeneration: boolean
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function scoreSellerKnowledgeCompleteness(
  profile: BusinessProfileDraftContent | null | undefined,
  sellerTruth: GrowthOutreachSellerTruth,
): { score: number; missing: string[] } {
  const missing: string[] = []
  let points = 0
  let max = 10

  if (sellerTruth.source === "approved_business_profile") points += 2
  else missing.push("Approved Business Profile")

  if (isEquipifyMasterKnowledgeEnriched(profile)) points += 2
  else missing.push("Equipify master knowledge enrichment")

  if (profile?.businessStrategy?.messaging.elevatorPitch?.trim()) points += 1
  else missing.push("Business Strategy elevator pitch")

  if ((profile?.canonicalSellerKnowledge?.personas.length ?? 0) >= 4) points += 1
  else missing.push("Buyer persona library")

  if ((profile?.canonicalSellerKnowledge?.products.modules.length ?? 0) >= 5) points += 1
  else missing.push("Product capability library")

  if ((profile?.canonicalSellerKnowledge?.competitors.length ?? 0) >= 2) points += 1
  else missing.push("Competitive intelligence")

  if ((profile?.canonicalSellerKnowledge?.proof.length ?? 0) >= 1) points += 1
  else missing.push("Proof library")

  if (sellerTruth.discoveryQuestions.length >= 3) points += 1
  else missing.push("Discovery questions")

  if (sellerTruth.objections.length >= 2) points += 1
  else missing.push("Objection handling")

  return { score: clamp01(points / max), missing }
}

function scoreResearchCompleteness(input: {
  evidence: GrowthOutreachEvidenceCitation[]
  missingEvidence: string[]
}): number {
  const evidenceCount = input.evidence.length
  const missingCount = input.missingEvidence.length
  if (evidenceCount >= 5 && missingCount <= 2) return 0.9
  if (evidenceCount >= 3 && missingCount <= 4) return 0.7
  if (evidenceCount >= 1) return 0.5
  return 0.3
}

function scoreEvidenceQuality(evidence: GrowthOutreachEvidenceCitation[]): number {
  if (evidence.length === 0) return 0.2
  const diverseSources = new Set(evidence.map((row) => row.source)).size
  const hasDm = evidence.some((row) => /decision maker/i.test(row.source))
  const hasEquipment = evidence.some((row) => /equipment/i.test(row.source))
  let score = 0.4
  if (diverseSources >= 3) score += 0.25
  if (hasDm) score += 0.15
  if (hasEquipment) score += 0.15
  return clamp01(score)
}

function scorePersonaUnderstanding(input: {
  contactTitle: string | null | undefined
  profile: BusinessProfileDraftContent | null | undefined
}): number {
  const title = input.contactTitle?.trim().toLowerCase() ?? ""
  const personas = input.profile?.canonicalSellerKnowledge?.personas ?? []
  if (!title) return personas.length >= 4 ? 0.55 : 0.35
  const matched = personas.some((row) => title.includes(row.persona.toLowerCase().split("/")[0].trim()))
  if (matched) return 0.9
  if (/owner|president|ceo|coo|ops|service|dispatch|cfo|controller|manager|director/i.test(title)) {
    return 0.75
  }
  return 0.5
}

export function scoreOutreachSellerKnowledgeQuality(input: {
  profile: BusinessProfileDraftContent | null | undefined
  sellerTruth: GrowthOutreachSellerTruth
  evidence: GrowthOutreachEvidenceCitation[]
  missingEvidence: string[]
  contactTitle?: string | null
  conversationJustification?: string | null
  primaryHook?: string | null
  confidence?: number
}): GrowthOutreachSellerKnowledgeQuality {
  const seller = scoreSellerKnowledgeCompleteness(input.profile, input.sellerTruth)

  const dimensions: Record<GrowthOutreachSellerKnowledgeQualityDimension, number> = {
    researchCompleteness: scoreResearchCompleteness({
      evidence: input.evidence,
      missingEvidence: input.missingEvidence,
    }),
    sellerKnowledgeCompleteness: seller.score,
    evidenceQuality: scoreEvidenceQuality(input.evidence),
    personaUnderstanding: scorePersonaUnderstanding({
      contactTitle: input.contactTitle,
      profile: input.profile,
    }),
    conversationQuality: input.conversationJustification?.trim() ? 0.85 : 0.55,
    personalization: input.primaryHook?.trim() ? 0.8 : 0.45,
    messagingQuality:
      input.sellerTruth.source === "approved_business_profile" &&
      input.sellerTruth.messagingAngles.length > 0
        ? 0.85
        : 0.5,
    confidence: clamp01(input.confidence ?? 0.5),
  }

  const overallScore = clamp01(
    Object.values(dimensions).reduce((sum, value) => sum + value, 0) /
      GROWTH_OUTREACH_SELLER_KNOWLEDGE_QUALITY_DIMENSIONS.length,
  )

  return {
    overallScore,
    dimensions,
    missingSellerKnowledge: seller.missing,
    readyForDraftGeneration: seller.missing.length <= 2 && overallScore >= 0.55,
  }
}
