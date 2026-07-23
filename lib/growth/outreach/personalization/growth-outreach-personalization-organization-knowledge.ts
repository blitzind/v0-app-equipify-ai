/** AIOS-TRAINING-KNOWLEDGE-INTEGRATION-1D — Approved seller-truth projection for outreach personalization (client-safe). */

import type { GrowthOutreachSellerTruth } from "@/lib/growth/aios/growth/growth-outreach-seller-truth"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"

export const AIOS_TRAINING_KNOWLEDGE_INTEGRATION_1D_QA_MARKER =
  "aios-training-knowledge-integration-1d-v1" as const

export type GrowthOutreachPersonalizationOrganizationKnowledgeBlock = {
  source: GrowthOutreachSellerTruth["source"]
  companyName: string | null
  productsServices: string[]
  primaryValueProposition: string | null
  elevatorPitch: string | null
  mission: string | null
  tone: string | null
  formality: string | null
  wordsToAvoid: string[]
  neverSay: string[]
  positioning: string[]
  qualificationStandards: string[]
  competitiveAdvantages: string[]
  objections: Array<{ objection: string; response: string }>
}

export function buildGrowthOutreachPersonalizationOrganizationKnowledgeBlock(
  sellerTruth: GrowthOutreachSellerTruth,
  approvedProfile?: BusinessProfileDraftContent | null,
): GrowthOutreachPersonalizationOrganizationKnowledgeBlock {
  return {
    source: sellerTruth.source,
    companyName: sellerTruth.sellerCompanyName,
    productsServices: sellerTruth.productsServices,
    primaryValueProposition: sellerTruth.primaryValueProposition,
    elevatorPitch: sellerTruth.elevatorPitch,
    mission: sellerTruth.mission,
    tone: sellerTruth.tonePreference,
    formality: approvedProfile?.businessStrategy?.messaging?.formality?.trim() || null,
    wordsToAvoid: sellerTruth.wordsToAvoid,
    neverSay: sellerTruth.neverSay,
    positioning: sellerTruth.positioning.length > 0 ? sellerTruth.positioning : sellerTruth.differentiators,
    qualificationStandards: sellerTruth.salesPhilosophy,
    competitiveAdvantages: sellerTruth.differentiators,
    objections: sellerTruth.objections,
  }
}

export function outreachPersonalizationPromptContainsHardcodedEquipifyBranding(source: string): boolean {
  return (
    /You refine pre-written B2B outreach copy for Equipify Growth Engine\./.test(source) ||
    /Capability mapping \(Equipify helps/.test(source) ||
    /Equipify helps teams centralize/.test(source) ||
    /Equipify centralizes/.test(source) ||
    /Equipify helps with/.test(source) ||
    /— Equipify \$\{/.test(source)
  )
}
