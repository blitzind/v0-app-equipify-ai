/** GE-AIOS-3A — Context Package → provider prompt (client-safe). */

import type { AiContextPackage } from "@/lib/growth/aios/ai-context-assembly-types"
import type { AiChatMessage } from "@/lib/ai/types"

const DEFAULT_SYSTEM_PROMPT = [
  "You are the Equipify AI OS intelligence layer.",
  "Respond using only the supplied Context Package.",
  "Do not invent facts outside the provided context.",
  "Return concise, actionable output.",
].join(" ")

const RESEARCH_COMPANY_SYSTEM_PROMPT = [
  "You are an internal Equipify Growth Engine research assistant.",
  "Use only facts from the supplied Context Package (lead, website excerpt, evidence).",
  "Return JSON only with snake_case keys:",
  "company_summary, website_summary, likely_service_category, service_area_clues, company_size_estimate,",
  "equipment_service_indicators, equipify_pain_points, equipify_fit_score (0-100 integer),",
  "outreach_angles, recommended_next_action, research_confidence (0-1 number), source_urls, caveats,",
  "decision_maker_candidates, estimated_annual_revenue, estimated_employee_count, fleet_size_estimate,",
  "crm_detected, field_service_stack_detected.",
  "Do not return markdown or prose outside the JSON object.",
].join(" ")

function resolveSystemPrompt(purpose: string): string {
  return purpose === "research_company" ? RESEARCH_COMPANY_SYSTEM_PROMPT : DEFAULT_SYSTEM_PROMPT
}

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
    { role: "system", content: resolveSystemPrompt(input.purpose) },
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
