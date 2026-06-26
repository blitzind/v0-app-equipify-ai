/** GE-AIOS-3A — Context Package → provider prompt (client-safe). */

import type { AiContextPackage } from "@/lib/growth/aios/ai-context-assembly-types"
import type { AiChatMessage } from "@/lib/ai/types"

const SYSTEM_PROMPT = [
  "You are the Equipify AI OS intelligence layer.",
  "Respond using only the supplied Context Package.",
  "Do not invent facts outside the provided context.",
  "Return concise, actionable output.",
].join(" ")

export function buildAiOsProviderMessagesFromContextPackage(input: {
  contextPackage: AiContextPackage
  purpose: string
}): AiChatMessage[] {
  const contextPayload = {
    purpose: input.purpose,
    context_version: input.contextPackage.contextVersion,
    checksum: input.contextPackage.checksum,
    work_order: input.contextPackage.workOrderContext,
    mission: input.contextPackage.missionContext,
    decision_history: input.contextPackage.decisionHistory,
    memory_references: input.contextPackage.memoryReferences,
    related_events: input.contextPackage.relatedEvents,
    evidence_bundle: input.contextPackage.evidenceBundle,
    entity_metadata: input.contextPackage.entityMetadata,
    source_keys: input.contextPackage.sourceKeys,
  }

  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: JSON.stringify(contextPayload, null, 2),
    },
  ]
}

export function estimateAiOsProviderPromptChars(messages: AiChatMessage[]): number {
  return messages.reduce((total, message) => {
    if (typeof message.content === "string") return total + message.content.length
    return total + message.content.reduce((partTotal, part) => partTotal + part.text.length, 0)
  }, 0)
}
