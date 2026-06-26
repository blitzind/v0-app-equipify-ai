/** GE-AIOS-2H — Default evidence collector (client-safe, rule-based). */

import type { AiDecisionEvidenceRef } from "@/lib/growth/aios/ai-decision-record-types"
import type {
  AiDecisionEngineEvidenceCollectInput,
  AiDecisionEngineEvidenceCollector,
} from "@/lib/growth/aios/ai-decision-engine-types"

const MIN_SNIPPET_LENGTH = 8

function evidenceFromPayload(payload: Record<string, unknown>): AiDecisionEvidenceRef[] {
  const refs: AiDecisionEvidenceRef[] = []

  for (const [key, value] of Object.entries(payload)) {
    if (key.startsWith("_")) continue
    const text = typeof value === "string" ? value.trim() : JSON.stringify(value ?? "")
    if (text.length < MIN_SNIPPET_LENGTH) continue
    refs.push({
      evidenceKey: `work_order.payload.${key}`,
      sourceKey: "ai_work_order",
      snippet: text.slice(0, 240),
      trust: 70,
      weight: 1,
    })
  }

  return refs
}

function evidenceFromMemoryRefs(
  memoryRefs: AiDecisionEngineEvidenceCollectInput["memoryRefs"],
): AiDecisionEvidenceRef[] {
  return memoryRefs.map((ref) => ({
    evidenceKey: `memory.${ref.memoryType}`,
    sourceKey: ref.sourceSystem ?? "ai_memory_registry",
    snippet: `${ref.sourceTable ?? ref.memoryType}:${ref.memoryId}`,
    trust: 75,
    weight: 1.2,
    metadata: {
      memory_id: ref.memoryId,
      memory_type: ref.memoryType,
      source_table: ref.sourceTable ?? null,
    },
  }))
}

export const defaultAiDecisionEngineEvidenceCollector: AiDecisionEngineEvidenceCollector = {
  collect(input: AiDecisionEngineEvidenceCollectInput): AiDecisionEvidenceRef[] {
    const bundle = [
      ...evidenceFromPayload(input.workOrderPayload),
      ...evidenceFromMemoryRefs(input.memoryRefs),
      ...(input.additionalEvidence ?? []),
    ]

    const seen = new Set<string>()
    return bundle.filter((ref) => {
      const key = `${ref.evidenceKey}:${ref.sourceKey ?? ""}`
      if (seen.has(key)) return false
      seen.add(key)
      return ref.evidenceKey.length > 0
    })
  },
}

export function collectAiDecisionEngineEvidence(
  input: AiDecisionEngineEvidenceCollectInput,
  collector: AiDecisionEngineEvidenceCollector = defaultAiDecisionEngineEvidenceCollector,
): AiDecisionEvidenceRef[] {
  return collector.collect(input)
}
