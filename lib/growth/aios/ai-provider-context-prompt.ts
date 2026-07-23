/** GE-AIOS-3A — Context Package → provider prompt (client-safe). */

import type { AiContextPackage } from "@/lib/growth/aios/ai-context-assembly-types"
import type { GrowthProspectResearchOrganizationContext } from "@/lib/growth/research/growth-prospect-research-organization-context"
import { buildGrowthProspectResearchOrganizationContextFallback } from "@/lib/growth/research/growth-prospect-research-organization-context"
import { buildGrowthProspectResearchSystemPrompt } from "@/lib/growth/research/growth-prospect-research-prompt-builder"
import type { AiChatMessage } from "@/lib/ai/types"

const DEFAULT_SYSTEM_PROMPT = [
  "You are the Equipify AI OS intelligence layer.",
  "Respond using only the supplied Context Package.",
  "Do not invent facts outside the provided context.",
  "Return concise, actionable output.",
].join(" ")

function resolveSystemPrompt(input: {
  purpose: string
  organizationContext?: GrowthProspectResearchOrganizationContext
}): string {
  if (input.purpose !== "research_company") return DEFAULT_SYSTEM_PROMPT

  return buildGrowthProspectResearchSystemPrompt({
    websiteContext: {
      fetchStatus: "skipped",
      normalizedUrl: null,
      excerpt: null,
      websiteEnabled: true,
    },
    organizationContext:
      input.organizationContext ?? buildGrowthProspectResearchOrganizationContextFallback(),
  })
}

export function buildAiOsProviderMessagesFromContextPackage(input: {
  contextPackage: AiContextPackage
  purpose: string
  organizationContext?: GrowthProspectResearchOrganizationContext
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
    {
      role: "system",
      content: resolveSystemPrompt({
        purpose: input.purpose,
        organizationContext: input.organizationContext,
      }),
    },
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
