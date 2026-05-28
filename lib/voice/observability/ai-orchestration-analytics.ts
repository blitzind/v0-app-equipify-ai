/** AI orchestration analytics — Phase 5B. Factual aggregates, no hidden scoring. */

import type { VoiceObservabilityAiOrchestrationSnapshot } from "@/lib/voice/observability/types"
import { VOICE_OBSERVABILITY_QA_MARKER } from "@/lib/voice/observability/types"

export type AiOrchestrationSourceCounts = {
  suggestionVolume: number
  suggestionsCopied: number
  suggestionsAdopted: number
  escalationCount: number
  operatorTakeoverCount: number
  aiFallbackCount: number
  voicemailCompleted: number
  voicemailAttempted: number
  qualificationCompleted: number
  qualificationStarted: number
  schedulingRequests: number
  optOutTerminations: number
  phaseCounts: Map<string, number>
}

export function buildAiOrchestrationSnapshot(
  counts: AiOrchestrationSourceCounts,
): VoiceObservabilityAiOrchestrationSnapshot {
  const adoptionDenom = Math.max(counts.suggestionVolume, 1)
  const adoptionRate =
    Math.round(((counts.suggestionsCopied + counts.suggestionsAdopted) / adoptionDenom) * 1000) / 10

  const voicemailDenom = Math.max(counts.voicemailAttempted, 1)
  const voicemailCompletionRate = Math.round((counts.voicemailCompleted / voicemailDenom) * 1000) / 10

  const qualDenom = Math.max(counts.qualificationStarted, 1)
  const qualificationCompletionRate = Math.round((counts.qualificationCompleted / qualDenom) * 1000) / 10

  return {
    qaMarker: VOICE_OBSERVABILITY_QA_MARKER,
    generatedAt: new Date().toISOString(),
    suggestionVolume24h: counts.suggestionVolume,
    suggestionAdoptionRate: adoptionRate,
    escalationFrequency24h: counts.escalationCount,
    operatorTakeoverFrequency24h: counts.operatorTakeoverCount,
    aiFallbackFrequency24h: counts.aiFallbackCount,
    voicemailCompletionRate,
    qualificationCompletionRate,
    schedulingRequestCount24h: counts.schedulingRequests,
    optOutTerminationCount24h: counts.optOutTerminations,
    phaseDistribution: [...counts.phaseCounts.entries()]
      .map(([phase, count]) => ({ phase, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    message: "AI orchestration analytics — factual aggregates only. No autonomous optimization.",
  }
}

export function emptyAiOrchestrationCounts(): AiOrchestrationSourceCounts {
  return {
    suggestionVolume: 0,
    suggestionsCopied: 0,
    suggestionsAdopted: 0,
    escalationCount: 0,
    operatorTakeoverCount: 0,
    aiFallbackCount: 0,
    voicemailCompleted: 0,
    voicemailAttempted: 0,
    qualificationCompleted: 0,
    qualificationStarted: 0,
    schedulingRequests: 0,
    optOutTerminations: 0,
    phaseCounts: new Map(),
  }
}
