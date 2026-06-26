/** GE-AIOS-3B — Decision Intelligence Bridge types (client-safe). */

import type { AiDecisionEvidenceRef } from "@/lib/growth/aios/ai-decision-record-types"
import type { AiOsProviderNormalizedResponse } from "@/lib/growth/aios/ai-provider-types"

export const GROWTH_AIOS_3B_PHASE = "GE-AIOS-3B" as const

export const GROWTH_AI_DECISION_INTELLIGENCE_BRIDGE_QA_MARKER =
  "growth-aios-3b-decision-intelligence-bridge-v1" as const

export const AI_DECISION_INTELLIGENCE_PURPOSE = "decision_intelligence" as const

/** Trust weight for AI provider output — evidence only, not authoritative. */
export const AI_DECISION_INTELLIGENCE_EVIDENCE_TRUST = 55

export const AI_DECISION_INTELLIGENCE_EVIDENCE_WEIGHT = 0.8

export type AiDecisionIntelligenceBridgeInput = {
  organizationId: string
  workOrderId: string
  missionId: string
  enabled?: boolean
  preferredProvider?: import("@/lib/growth/aios/ai-provider-types").AiOsProviderId
  source?: string
}

export type AiDecisionIntelligenceBridgeResult = {
  aiEvidence: AiDecisionEvidenceRef[]
  used: boolean
  failed: boolean
  contextPackageId: string | null
  providerRequestId: string | null
  failureReason: string | null
}

export function buildAiDecisionEvidenceFromProviderResponse(input: {
  response: AiOsProviderNormalizedResponse
  contextPackageId: string
  providerRequestId: string
}): AiDecisionEvidenceRef[] {
  const snippet = input.response.text.trim().slice(0, 480)
  if (!snippet) return []

  return [
    {
      evidenceKey: "ai_provider.intelligence",
      sourceKey: "ai_os_provider_gateway",
      snippet,
      trust: AI_DECISION_INTELLIGENCE_EVIDENCE_TRUST,
      weight: AI_DECISION_INTELLIGENCE_EVIDENCE_WEIGHT,
      metadata: {
        advisory_only: true,
        authoritative: false,
        context_package_id: input.contextPackageId,
        provider_request_id: input.providerRequestId,
        provider_id: input.response.providerId,
        model_id: input.response.modelId,
        failover_count: input.response.failoverCount,
      },
    },
  ]
}

/** AI output enriches evidence — the rule-based Decision Engine remains authoritative. */
export const AI_DECISION_INTELLIGENCE_BRIDGE_RUNTIME_RULE =
  "Decision Intelligence Bridge optionally adds normalized AI provider output as Decision Record evidence — it does not execute Work Orders, send outbound, or override deterministic rule evaluation." as const
