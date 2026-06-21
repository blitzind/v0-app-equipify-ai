/** Assemble personalized SMS draft (Phase 5.3). Client-safe. */

import { buildIndustryContextSmsDraft } from "@/lib/growth/playbooks/growth-industry-context"
import { computeContextUtilization } from "@/lib/growth/outreach/personalization/context-utilization"
import { computeMemoryUtilization } from "@/lib/growth/outreach/personalization/memory-utilization"
import { buildPersonalizationVariationKey } from "@/lib/growth/outreach/personalization/message-variability"
import {
  computePersonalizationConfidence,
  buildPersonalizationWarnings,
} from "@/lib/growth/outreach/personalization/personalization-warnings"
import { extractPersonalizationSignals } from "@/lib/growth/outreach/personalization/signal-extraction"
import { inferSmsMessageType } from "@/lib/growth/sms/personalization/sms-message-type"
import { buildSmsCta } from "@/lib/growth/sms/personalization/sms-cta-intelligence"
import { selectSmsOpeningHook } from "@/lib/growth/sms/personalization/sms-opening-hooks"
import {
  assembleSmsBody,
  scoreSmsPersonalizationQuality,
  estimateSmsSegments,
  trimSmsToMaxChars,
} from "@/lib/growth/sms/personalization/sms-quality-scoring"
import { applyGrowthPersonalizationQualityPassWithIndustryContext } from "@/lib/growth/personalization/quality/growth-personalization-quality-engine"
import { buildAllowedFactsFromContextPacket } from "@/lib/growth/outreach/personalization/allowed-facts-from-context-packet"
import { collectAllowedFacts } from "@/lib/growth/outreach/personalization/ai-refinement-guard"
import { buildGrowthReasoningContext } from "@/lib/growth/reasoning/growth-reasoning-engine"
import { buildGrowthSequenceIntelligenceContext } from "@/lib/growth/sequence-intelligence/growth-sequence-engine"
import type {
  SmsMessageType,
  SmsPersonalizationAudit,
  SmsPersonalizationContext,
  SmsPersonalizationDraft,
} from "@/lib/growth/sms/personalization/sms-personalization-types"
import { SMS_PERSONALIZATION_DEFAULT_MAX_CHARS, SMS_PERSONALIZATION_STRATEGY_VERSION } from "@/lib/growth/sms/personalization/sms-personalization-types"

export function buildPersonalizedSmsDraft(input: {
  leadId: string
  context: SmsPersonalizationContext
  messageType?: SmsMessageType
  draftType?: "outbound" | "reply"
  maxChars?: number
}): { audit: SmsPersonalizationAudit; draft: SmsPersonalizationDraft } {
  const maxChars = input.maxChars ?? SMS_PERSONALIZATION_DEFAULT_MAX_CHARS
  const packet = input.context.packet
  const sequenceIntelligenceContext = buildGrowthSequenceIntelligenceContext({ packet })
  if (packet.industryContext) {
    packet.industryContext = {
      ...packet.industryContext,
      sequenceIntelligenceContext,
    }
  }
  const reasoningContext = buildGrowthReasoningContext({ packet, channel: "SMS" })
  if (packet.industryContext) {
    packet.industryContext = {
      ...packet.industryContext,
      reasoningContext,
    }
  }
  const signals = extractPersonalizationSignals(packet)
  const messageType =
    input.messageType ??
    inferSmsMessageType({
      packet,
      draftType: input.draftType,
      priorSmsCount: input.context.priorSmsCount,
    })

  const variationKey = buildPersonalizationVariationKey({
    leadId: input.leadId,
    angle: messageType,
    industry: packet.industryContext?.industryId ?? "general",
    blockIds: [messageType],
  })

  const playbookSms = packet.industryContext?.playbookApplied
    ? buildIndustryContextSmsDraft(packet.industryContext)
    : null
  const hook = playbookSms
    ? {
        strategy: "industry_playbook" as const,
        evidence: packet.industryContext?.industryFacts[0] ?? null,
        evidenceSource: "industry_playbook" as const,
        text: playbookSms,
      }
    : selectSmsOpeningHook({ packet, messageType, variationKey })
  const cta = buildSmsCta({ packet, signals, messageType, variationKey })
  let draft = playbookSms
    ? (() => {
        const body = trimSmsToMaxChars(playbookSms, maxChars)
        return { body, charCount: body.length, segmentCount: estimateSmsSegments(body.length) }
      })()
    : assembleSmsBody(hook.text, cta.text, maxChars)

  const pseudoStrategy = {
    blocks: [
      { key: "opening" as const, blockId: `sms_${hook.strategy}`, label: hook.strategy, text: hook.text },
      { key: "cta" as const, blockId: `sms_${cta.category}`, label: cta.category, text: cta.text },
    ],
    researchOpener: hook.researchOpener,
    memoryOpener: hook.memoryOpener,
    subjectIntelligence: undefined,
    ctaIntelligence: {
      category: cta.category,
      evidence: cta.evidence,
      evidenceSource: cta.evidenceSource,
    },
    sourceSignals: signals,
    memoryInfluence: undefined,
  }

  const contextQuality = computeContextUtilization({ packet, strategy: pseudoStrategy as never })
  const memoryQuality = computeMemoryUtilization({ packet, strategy: pseudoStrategy as never })
  const qualityScore = scoreSmsPersonalizationQuality({
    draft,
    hookText: hook.text,
    maxChars,
    contextQuality,
    memoryQuality,
  })

  const confidence = computePersonalizationConfidence({
    packet,
    signals,
    strategy: { blocks: pseudoStrategy.blocks } as never,
  })
  const warnings = buildPersonalizationWarnings({
    packet,
    signals,
    confidenceScore: confidence.score,
  })

  const qualityPass = applyGrowthPersonalizationQualityPassWithIndustryContext({
    channel: "SMS",
    body: draft.body,
    companyName: packet.companyName,
    contactName: packet.decisionMakerName,
    allowedFacts: collectAllowedFacts(buildAllowedFactsFromContextPacket(packet)),
    industryContext: packet.industryContext,
    reasoningDiagnostics: reasoningContext.diagnostics,
    sequenceDiagnostics: sequenceIntelligenceContext.diagnostics,
    maxChars,
  })
  draft = {
    body: qualityPass.body,
    charCount: qualityPass.body.length,
    segmentCount: estimateSmsSegments(qualityPass.body.length),
  }

  const audit: SmsPersonalizationAudit = {
    strategyVersion: SMS_PERSONALIZATION_STRATEGY_VERSION,
    messageType,
    context: input.context,
    openingHook: {
      strategy: hook.strategy,
      evidence: hook.evidence,
      evidenceSource: hook.evidenceSource,
      researchOpener: hook.researchOpener,
      memoryOpener: hook.memoryOpener,
    },
    cta: {
      category: cta.category,
      evidence: cta.evidence,
      evidenceSource: cta.evidenceSource,
      selectionReason: cta.selectionReason,
    },
    sourceSignals: signals,
    warnings,
    confidenceScore: confidence.score,
    confidenceLabel: confidence.label,
    variationKey,
    deterministicDraft: draft,
    maxChars,
    contextQuality,
    memoryQuality,
    qualityScore,
    qualityDiagnostics: qualityPass.diagnostics,
    qualityApplied: qualityPass.qualityApplied,
    reasoningDiagnostics: reasoningContext.diagnostics,
    reasoningApplied: reasoningContext.diagnostics.topInsights.length > 0,
    sequenceDiagnostics: sequenceIntelligenceContext.diagnostics,
    sequenceGuidanceApplied: sequenceIntelligenceContext.diagnostics.guidanceApplied,
  }

  return { audit, draft }
}
