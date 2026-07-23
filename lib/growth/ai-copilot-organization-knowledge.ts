/** AIOS-TRAINING-KNOWLEDGE-INTEGRATION-1A — Approved profile projection for Growth Copilot prompts (client-safe). */

import type { GrowthOutreachSellerTruth } from "@/lib/growth/aios/growth/growth-outreach-seller-truth"

export const AIOS_TRAINING_KNOWLEDGE_INTEGRATION_1A_QA_MARKER =
  "aios-training-knowledge-integration-1a-v1" as const

export type GrowthAiCopilotOrganizationKnowledgeBlock = {
  source: GrowthOutreachSellerTruth["source"]
  companyName: string | null
  mission: string | null
  elevatorPitch: string | null
  tone: string | null
  wordsToAvoid: string[]
  neverSay: string[]
  positioning: string[]
  pricingPhilosophy: string[]
  qualificationStandards: string[]
  discoveryQuestions: string[]
  objections: Array<{ objection: string; response: string }>
  disqualifiers: string[]
}

export function buildGrowthAiCopilotOrganizationKnowledgeBlock(
  sellerTruth: GrowthOutreachSellerTruth,
): GrowthAiCopilotOrganizationKnowledgeBlock {
  return {
    source: sellerTruth.source,
    companyName: sellerTruth.sellerCompanyName,
    mission: sellerTruth.mission,
    elevatorPitch: sellerTruth.elevatorPitch,
    tone: sellerTruth.tonePreference,
    wordsToAvoid: sellerTruth.wordsToAvoid,
    neverSay: sellerTruth.neverSay,
    positioning: sellerTruth.differentiators,
    pricingPhilosophy: sellerTruth.commercialGuidance ?? [],
    qualificationStandards: sellerTruth.salesPhilosophy,
    discoveryQuestions: sellerTruth.discoveryQuestions,
    objections: sellerTruth.objections,
    disqualifiers: sellerTruth.disqualifiers,
  }
}
