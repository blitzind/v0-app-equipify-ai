/** GE-AIOS-2H — Decision Engine types (client-safe). Constitutional §7, §13. */

import type {
  AiDecisionActionRef,
  AiDecisionEvidenceRef,
} from "@/lib/growth/aios/ai-decision-record-types"
import type { AiWorkOrderType } from "@/lib/growth/aios/ai-work-order-types"

export const GROWTH_AIOS_2H_PHASE = "GE-AIOS-2H" as const

export const GROWTH_AI_DECISION_ENGINE_QA_MARKER = "growth-aios-2h-decision-engine-v1" as const

export const GROWTH_AI_DECISION_ENGINE_SCHEMA_MIGRATION =
  "20271001180000_growth_aios_2h_decision_engine.sql" as const

export const AI_DECISION_ENGINE_REQUEST_STATUSES = [
  "pending",
  "evaluated",
  "insufficient_evidence",
  "failed",
] as const

export type AiDecisionEngineRequestStatus = (typeof AI_DECISION_ENGINE_REQUEST_STATUSES)[number]

/** Constitutional confidence bands (§13.2) — labels only; calculators are deterministic. */
export const AI_DECISION_CONFIDENCE_BANDS = {
  high: { min: 85, max: 100, label: "high" },
  medium: { min: 65, max: 84, label: "medium" },
  low: { min: 45, max: 64, label: "low" },
  insufficient: { min: 0, max: 44, label: "insufficient" },
} as const

export type AiDecisionConfidenceBand = keyof typeof AI_DECISION_CONFIDENCE_BANDS

export type AiDecisionEngineRequest = {
  id: string
  organizationId: string
  missionId: string
  workOrderId: string
  decisionKey: string
  requestStatus: AiDecisionEngineRequestStatus
  evidenceBundle: AiDecisionEvidenceRef[]
  evaluation: Record<string, unknown>
  recommendation: AiDecisionEngineRecommendation
  confidence: number
  riskScore: number
  expectedCostUsd: number
  decisionRecordId: string | null
  degradedMode: boolean
  qaMarker: string
  createdAt: string
}

export type AiDecisionEngineRuntime = {
  id: string
  organizationId: string
  degraded: boolean
  degradedReason: string | null
  evaluationCount: number
  insufficientEvidenceCount: number
  lastEvaluationAt: string | null
  lastSuccessAt: string | null
  metadata: Record<string, unknown>
  qaMarker: string
  createdAt: string
  updatedAt: string
}

export type AiDecisionEngineRecommendation = {
  chosenAction: AiDecisionActionRef
  rejectedActions: AiDecisionActionRef[]
  explanation: string
  confidenceBand: AiDecisionConfidenceBand
  proceed: boolean
}

export type AiDecisionEngineEvaluateInput = {
  organizationId: string
  workOrderId: string
  decisionKey?: string
  additionalEvidence?: AiDecisionEvidenceRef[]
  memoryRegistryIds?: string[]
  metadata?: Record<string, unknown>
  /** When true, optionally enrich evidence via Decision Intelligence Bridge (GE-AIOS-3B). */
  enableAiEvidence?: boolean
  preferredAiProvider?: import("@/lib/growth/aios/ai-provider-types").AiOsProviderId
}

export type AiDecisionEngineEvaluationResult = {
  requestStatus: AiDecisionEngineRequestStatus
  decisionKey: string
  evidenceBundle: AiDecisionEvidenceRef[]
  confidence: number
  riskScore: number
  expectedCostUsd: number
  expectedValueUsd: number | null
  recommendation: AiDecisionEngineRecommendation
  evaluation: Record<string, unknown>
}

export type AiDecisionEngineEvidenceCollectInput = {
  workOrderPayload: Record<string, unknown>
  memoryRefs: Array<{ memoryType: string; memoryId: string; sourceSystem?: string; sourceTable?: string }>
  additionalEvidence?: AiDecisionEvidenceRef[]
}

export type AiDecisionEngineEvidenceCollector = {
  collect(input: AiDecisionEngineEvidenceCollectInput): AiDecisionEvidenceRef[]
}

export function resolveDecisionConfidenceBand(confidence: number): AiDecisionConfidenceBand {
  if (confidence >= AI_DECISION_CONFIDENCE_BANDS.high.min) return "high"
  if (confidence >= AI_DECISION_CONFIDENCE_BANDS.medium.min) return "medium"
  if (confidence >= AI_DECISION_CONFIDENCE_BANDS.low.min) return "low"
  return "insufficient"
}

/** Decision Engine evaluates rules and creates Decision Records — it does not execute, delegate, or call providers directly. */
export const AI_DECISION_ENGINE_RUNTIME_RULE =
  "Decision Engine evaluates evidence and produces Decision Records — it does not execute Work Orders, delegate, or call providers directly; optional AI evidence flows through the Decision Intelligence Bridge (GE-AIOS-3B)." as const

export type AiDecisionEngineWorkOrderBinding = {
  workOrderType: AiWorkOrderType
  decisionKey: string
  defaultActionKey: string
}
