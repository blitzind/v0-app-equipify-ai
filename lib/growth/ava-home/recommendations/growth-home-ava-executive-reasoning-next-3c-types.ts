/** GE-AIOS-NEXT-3C — Evidence-backed executive reasoning types (client-safe). */

export const GROWTH_AIOS_NEXT_3C_EXECUTIVE_REASONING_QA_MARKER =
  "ge-aios-next-3c-evidence-backed-executive-reasoning-v1" as const

export const GROWTH_AIOS_NEXT_3C_EXECUTIVE_REASONING_PRINCIPLE =
  "Synthesize existing evidence into executive reasoning — observation, evidence, confidence, alternatives, recommendation, and impact." as const

export type GrowthHomeAvaExecutiveReasoningConfidence =
  | "high"
  | "moderate"
  | "low"
  | "insufficient_evidence"
  | "unknown"

export type GrowthHomeAvaExecutiveReasoningBlock = {
  topic: string
  observation: string
  evidence: string[]
  confidence: GrowthHomeAvaExecutiveReasoningConfidence
  confidenceReason: string
  alternativeExplanations: string[]
  recommendation: string | null
  expectedImpact: string | null
  evidenceSources: string[]
}

export type GrowthHomeAvaExecutiveReasoningPayload = {
  qaMarker: typeof GROWTH_AIOS_NEXT_3C_EXECUTIVE_REASONING_QA_MARKER
  principle: typeof GROWTH_AIOS_NEXT_3C_EXECUTIVE_REASONING_PRINCIPLE
  primary: GrowthHomeAvaExecutiveReasoningBlock | null
  supporting: GrowthHomeAvaExecutiveReasoningBlock[]
  synthesisSummary: string | null
}

export type GrowthHomeAvaExecutiveReasoningInput = {
  /** Full evidence completeness snapshot when available (NEXT-3B). */
  evidenceCompleteness?: import("@/lib/growth/organizational-effectiveness/growth-organizational-evidence-completeness-next-3b-types").GrowthOrganizationalEvidenceCompletenessSnapshot | null
  missionDiscovery?: import("@/lib/growth/mission-center/growth-home-mission-discovery-snapshot").GrowthHomeMissionDiscoverySnapshot | null
  pendingApprovals?: number
  outboundDisabled?: boolean
  businessObjectiveTitle?: string | null
  recommendationAcceptanceRate?: number | null
}
