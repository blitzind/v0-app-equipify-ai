/** GS-AI-PLAYBOOK-1C/2B/2C — Industry context prompt sections (client-safe). */

import {
  buildRegenerationFeedbackDirectives,
  type GrowthIndustryContext,
} from "@/lib/growth/playbooks/growth-industry-context"
import { buildGrowthPlaybookOrchestratedPromptBlock } from "@/lib/growth/playbooks/narrative/growth-playbook-prompt-orchestrator"
import type { GrowthPlaybookPromptChannel } from "@/lib/growth/playbooks/narrative/growth-playbook-narrative-types"

export function buildIndustryContextPromptSections(context: GrowthIndustryContext | null): string[] {
  if (!context?.playbookApplied) return []

  const orchestrated = buildGrowthPlaybookOrchestratedPromptBlock({
    industryContext: context,
    narrativeContext: context.narrativeContext,
    channel: "page",
  })
  if (orchestrated) {
    return [orchestrated]
  }

  const sections: string[] = [
    `Industry playbook: ${context.playbook?.displayName ?? context.industryId ?? "general"}`,
    "Use industry context with phrasing like 'Teams in this space often…' or 'Companies like yours often…'.",
    "Never claim unverified company-specific pain unless listed under verified company facts.",
  ]

  if (context.industryFacts.length > 0) {
    sections.push(`Industry context (not verified for this company):\n- ${context.industryFacts.join("\n- ")}`)
  }
  if (context.verifiedFacts.length > 0) {
    sections.push(`Verified company facts (safe to reference):\n- ${context.verifiedFacts.join("\n- ")}`)
  }

  const feedbackDirectives = buildRegenerationFeedbackDirectives(context.regenerationFeedback)
  if (feedbackDirectives.length > 0) {
    sections.push(`Operator regeneration feedback:\n- ${feedbackDirectives.join("\n- ")}`)
  }

  return sections
}

export function buildIndustryContextPromptBlock(
  context: GrowthIndustryContext | null,
  channel: GrowthPlaybookPromptChannel = "page",
): string {
  if (!context?.playbookApplied) return ""
  const orchestrated = buildGrowthPlaybookOrchestratedPromptBlock({
    industryContext: context,
    narrativeContext: context.narrativeContext,
    channel,
  })
  if (orchestrated) return orchestrated
  const sections = buildIndustryContextPromptSections(context)
  if (sections.length === 0) return ""
  return sections.join("\n\n")
}
