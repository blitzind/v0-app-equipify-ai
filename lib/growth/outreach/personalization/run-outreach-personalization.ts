import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthAiProvider } from "@/lib/growth/ai-copilot-provider"
import { growthAiCopilotModelSchema, mapGrowthAiCopilotModelOutput } from "@/lib/growth/ai-copilot-schema"
import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"
import {
  buildAllowedFactsFromContextPacket,
  buildOutreachContextPacket,
} from "@/lib/growth/outreach/personalization/context-packet-builder"
import {
  buildOutreachRefinementSystemPrompt,
  buildOutreachRefinementUserPrompt,
} from "@/lib/growth/outreach/personalization/ai-refinement-prompts"
import {
  collectAllowedFacts,
  sanitizeRefinedBody,
  validateOutreachRefinement,
} from "@/lib/growth/outreach/personalization/ai-refinement-guard"
import { buildPersonalizedOutreachDraft } from "@/lib/growth/outreach/personalization/assemble-draft"
import {
  OUTREACH_PERSONALIZATION_DEFAULT_MAX_WORDS,
  OUTREACH_PERSONALIZATION_STRATEGY_VERSION,
  type OutreachPersonalizationAudit,
} from "@/lib/growth/outreach/personalization/personalization-types"
import { extractPersonalizationSignals } from "@/lib/growth/outreach/personalization/signal-extraction"
import {
  buildPersonalizationWarnings,
  computePersonalizationConfidence,
} from "@/lib/growth/outreach/personalization/personalization-warnings"
import type { GrowthLead } from "@/lib/growth/types"

export type RunOutreachPersonalizationResult = {
  subject: string | null
  content: string
  audit: OutreachPersonalizationAudit
}

export async function runOutreachPersonalizationGeneration(
  admin: SupabaseClient,
  input: {
    lead: GrowthLead
    generationType: GrowthAiCopilotGenerationType
    actingUserId: string
    maxWords?: number
    aiRefinementEnabled?: boolean
  },
): Promise<RunOutreachPersonalizationResult> {
  void admin
  const maxWords = input.maxWords ?? OUTREACH_PERSONALIZATION_DEFAULT_MAX_WORDS
  const contextPacket = await buildOutreachContextPacket(admin, input.lead)
  const signals = extractPersonalizationSignals(contextPacket)
  const { strategy, draft } = buildPersonalizedOutreachDraft({
    leadId: input.lead.id,
    packet: contextPacket,
    signals,
    generationType: input.generationType,
    maxWords,
  })

  const confidence = computePersonalizationConfidence({
    packet: contextPacket,
    signals,
    strategy,
  })
  const warnings = buildPersonalizationWarnings({
    packet: contextPacket,
    signals,
    confidenceScore: confidence.score,
  })

  let finalSubject = draft.subject
  let finalBody = draft.body
  let refinedByAi = false

  if (input.aiRefinementEnabled !== false) {
    const provider = getGrowthAiProvider()
    const health = await provider.health()
    if (health.ok) {
      const allowedFacts = collectAllowedFacts(buildAllowedFactsFromContextPacket(contextPacket))
      const systemPrompt = buildOutreachRefinementSystemPrompt(maxWords)
      const userPrompt = buildOutreachRefinementUserPrompt({
        draft,
        blocks: strategy.blocks,
        allowedFacts,
        maxWords,
        avoidRepeatingTopics: contextPacket.memoryAvoidRepeating,
      })

      try {
        const aiResult = await provider.generate({
          generationType: input.generationType,
          promptVariant: "default",
          systemPrompt,
          userPrompt,
          actingUserId: input.actingUserId,
        })
        const parsed = growthAiCopilotModelSchema.parse(aiResult.output)
        const mapped = mapGrowthAiCopilotModelOutput(parsed, input.generationType)
        const guard = validateOutreachRefinement({
          refinedBody: mapped.generatedContent,
          refinedSubject: mapped.generatedSubject,
          deterministicBody: draft.body,
          allowedFacts,
          maxWords,
        })
        if (guard.ok) {
          finalSubject = mapped.generatedSubject?.trim() || draft.subject
          finalBody = sanitizeRefinedBody(mapped.generatedContent)
          refinedByAi = true
        } else {
          warnings.push({
            code: "weak_personalization",
            message: "AI refinement rejected — deterministic draft preserved.",
            severity: "info",
          })
        }
      } catch {
        warnings.push({
          code: "weak_personalization",
          message: "AI refinement unavailable — deterministic draft preserved.",
          severity: "info",
        })
      }
    }
  }

  const audit: OutreachPersonalizationAudit = {
    strategyVersion: OUTREACH_PERSONALIZATION_STRATEGY_VERSION,
    contextPacket,
    selectedBlocks: strategy.blocks,
    angle: strategy.angle,
    industry: strategy.industry,
    sourceSignals: strategy.sourceSignals,
    warnings,
    confidenceScore: confidence.score,
    confidenceLabel: confidence.label,
    variationKey: strategy.variationKey,
    deterministicDraft: draft,
    refinedByAi,
    generationType: input.generationType,
    maxWords,
  }

  return {
    subject: finalSubject,
    content: finalBody,
    audit,
  }
}
