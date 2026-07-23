import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getGrowthAiProvider } from "@/lib/growth/ai-copilot-provider"
import { growthAiCopilotModelSchema, mapGrowthAiCopilotModelOutput } from "@/lib/growth/ai-copilot-schema"
import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"
import { buildOutreachContextPacket } from "@/lib/growth/outreach/personalization/context-packet-builder"
import {
  buildAllowedFactsFromContextPacket,
  buildIndustryFactsFromContextPacket,
  buildVerifiedFactsFromContextPacket,
} from "@/lib/growth/outreach/personalization/allowed-facts-from-context-packet"
import {
  buildOutreachRefinementSystemPrompt,
  buildOutreachRefinementUserPrompt,
} from "@/lib/growth/outreach/personalization/ai-refinement-prompts"
import {
  collectAllowedFacts,
  sanitizeRefinedBody,
  validateOutreachRefinement,
} from "@/lib/growth/outreach/personalization/ai-refinement-guard"
import { applyGrowthPersonalizationQualityPassWithIndustryContext } from "@/lib/growth/personalization/quality/growth-personalization-quality-engine"
import { buildPersonalizedOutreachDraft } from "@/lib/growth/outreach/personalization/assemble-draft"
import { buildGrowthReasoningContext } from "@/lib/growth/reasoning/growth-reasoning-engine"
import { buildGrowthSequenceIntelligenceContext } from "@/lib/growth/sequence-intelligence/growth-sequence-engine"
import type { GrowthAiCopilotPlaybookResolvedRule } from "@/lib/growth/ai-copilot-playbook-types"
import {
  OUTREACH_INDUSTRY_PLAYBOOK_INTEGRATION_QA_MARKER,
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
import type { GrowthOutboundIdentityContext } from "@/lib/growth/signatures/outbound-identity-types"

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
    playbookRules?: GrowthAiCopilotPlaybookResolvedRule[]
    outboundIdentity?: GrowthOutboundIdentityContext | null
  },
): Promise<RunOutreachPersonalizationResult> {
  const maxWords = input.maxWords ?? OUTREACH_PERSONALIZATION_DEFAULT_MAX_WORDS
  const contextPacket = await buildOutreachContextPacket(admin, input.lead)
  const sequenceIntelligenceContext = buildGrowthSequenceIntelligenceContext({ packet: contextPacket })
  if (contextPacket.industryContext) {
    contextPacket.industryContext = {
      ...contextPacket.industryContext,
      sequenceIntelligenceContext,
    }
  }
  const reasoningContext = buildGrowthReasoningContext({ packet: contextPacket, channel: "EMAIL" })
  if (contextPacket.industryContext) {
    contextPacket.industryContext = {
      ...contextPacket.industryContext,
      reasoningContext,
    }
  }
  const signals = extractPersonalizationSignals(contextPacket)
  const { strategy, draft, contextQuality, memoryQuality } = buildPersonalizedOutreachDraft({
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
      const systemPrompt = buildOutreachRefinementSystemPrompt(
        maxWords,
        input.outboundIdentity,
        contextPacket.organizationKnowledge,
      )
      const userPrompt = buildOutreachRefinementUserPrompt({
        draft,
        blocks: strategy.blocks,
        allowedFacts,
        verifiedFacts: buildVerifiedFactsFromContextPacket(contextPacket),
        industryFacts: buildIndustryFactsFromContextPacket(contextPacket),
        industryContext: contextPacket.industryContext,
        playbookRules: input.playbookRules,
        generationType: input.generationType,
        maxWords,
        avoidRepeatingTopics: contextPacket.memoryAvoidRepeating,
        outboundIdentity: input.outboundIdentity,
        organizationKnowledge: contextPacket.organizationKnowledge,
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

  const allowedFacts = collectAllowedFacts(buildAllowedFactsFromContextPacket(contextPacket))
  const qualityPass = applyGrowthPersonalizationQualityPassWithIndustryContext({
    channel: "EMAIL",
    subject: finalSubject,
    body: finalBody,
    companyName: contextPacket.companyName,
    contactName: contextPacket.decisionMakerName,
    allowedFacts,
    industryContext: contextPacket.industryContext,
    reasoningDiagnostics: reasoningContext.diagnostics,
    sequenceDiagnostics: sequenceIntelligenceContext.diagnostics,
    maxWords,
  })
  finalSubject = qualityPass.subject
  finalBody = qualityPass.body

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
    subjectIntelligence: strategy.subjectIntelligence,
    ctaIntelligence: strategy.ctaIntelligence,
    contextQuality,
    memoryQuality,
    researchOpener: strategy.researchOpener,
    memoryOpener: strategy.memoryOpener,
    memoryInfluence: strategy.memoryInfluence,
    communicationStyle: strategy.communicationStyle,
    industryPlaybookApplied: Boolean(contextPacket.industryContext?.playbookApplied),
    industryContextQaMarker: OUTREACH_INDUSTRY_PLAYBOOK_INTEGRATION_QA_MARKER,
    qualityDiagnostics: qualityPass.diagnostics,
    qualityApplied: qualityPass.qualityApplied,
    outcomeGuidanceDiagnostics: contextPacket.industryContext?.outcomeGuidanceContext?.diagnostics,
    outcomeGuidanceApplied: contextPacket.industryContext?.outcomeGuidanceContext?.diagnostics.guidanceApplied,
    buyerJourneyDiagnostics: contextPacket.industryContext?.buyerJourneyContext?.diagnostics,
    buyerJourneyApplied: contextPacket.industryContext?.buyerJourneyContext?.diagnostics.guidanceApplied,
    reasoningDiagnostics: reasoningContext.diagnostics,
    reasoningApplied: reasoningContext.diagnostics.topInsights.length > 0,
    sequenceDiagnostics: sequenceIntelligenceContext.diagnostics,
    sequenceGuidanceApplied: sequenceIntelligenceContext.diagnostics.guidanceApplied,
  }

  return {
    subject: finalSubject,
    content: finalBody,
    audit,
  }
}
