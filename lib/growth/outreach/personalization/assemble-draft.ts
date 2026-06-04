/** Assemble deterministic outreach draft from selected blocks (slice 6.15B). */

import { countWords } from "@/lib/growth/outreach/personalization/message-variability"
import { applyCtaIntelligence, buildIntelligentCta } from "@/lib/growth/outreach/personalization/cta-intelligence"
import { computeContextUtilization } from "@/lib/growth/outreach/personalization/context-utilization"
import {
  applyMemoryCommunicationStyle,
  resolveMemoryCommunicationStyle,
} from "@/lib/growth/outreach/personalization/memory-communication-style"
import { computeMemoryUtilization } from "@/lib/growth/outreach/personalization/memory-utilization"
import { selectMessageStrategy } from "@/lib/growth/outreach/personalization/message-strategy"
import { buildIntelligentSubject } from "@/lib/growth/outreach/personalization/subject-intelligence"
import type {
  OutreachContextPacket,
  OutreachPersonalizationDraft,
  PersonalizationSignalKey,
  SelectedMessageStrategy,
} from "@/lib/growth/outreach/personalization/personalization-types"
import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"

function trimToMaxWords(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return words.join(" ")
  return `${words.slice(0, maxWords).join(" ")}…`
}

export function assembleDeterministicOutreachDraft(input: {
  strategy: SelectedMessageStrategy
  subject: string
  maxWords: number
}): OutreachPersonalizationDraft {
  const ordered = ["opening", "pain", "industry", "proof", "cta"] as const
  const blockText = ordered
    .map((key) => input.strategy.blocks.find((block) => block.key === key)?.text)
    .filter(Boolean)
    .join(" ")
  const trimmed = trimToMaxWords(blockText, input.maxWords)
  return {
    subject: input.subject,
    body: trimmed,
    wordCount: countWords(trimmed),
  }
}

export function buildPersonalizedOutreachDraft(input: {
  leadId: string
  packet: OutreachContextPacket
  signals: PersonalizationSignalKey[]
  generationType: GrowthAiCopilotGenerationType
  maxWords: number
}): {
  strategy: SelectedMessageStrategy
  draft: OutreachPersonalizationDraft
  contextQuality: ReturnType<typeof computeContextUtilization>
  memoryQuality: ReturnType<typeof computeMemoryUtilization>
} {
  const strategy = selectMessageStrategy({
    leadId: input.leadId,
    packet: input.packet,
    signals: input.signals,
    generationType: input.generationType,
  })
  const communicationStyle = resolveMemoryCommunicationStyle(input.packet)
  const effectiveMaxWords = communicationStyle.maxWordsOverride ?? input.maxWords

  const subjectResult = buildIntelligentSubject({
    packet: input.packet,
    strategy,
    generationType: input.generationType,
    variationSeed: strategy.variationKey,
  })
  const ctaResult = buildIntelligentCta({
    packet: input.packet,
    strategy,
    signals: input.signals,
    generationType: input.generationType,
    variationSeed: strategy.variationKey,
  })

  let enrichedStrategy = applyCtaIntelligence(
    {
      ...strategy,
      communicationStyle,
      memoryInfluence: strategy.memoryInfluence
        ? {
            ...strategy.memoryInfluence,
            styleApplied: communicationStyle.applied,
          }
        : communicationStyle.applied
          ? {
              painInfluenced: false,
              objectionAware: false,
              styleApplied: true,
              avoidedTopics: input.packet.memoryAvoidRepeating.slice(0, 3),
              committeeReferenced: input.packet.memoryCommitteeSummaries.length > 0,
            }
          : undefined,
      subjectIntelligence: {
        category: subjectResult.category,
        evidenceSource: subjectResult.evidenceSource,
        evidence: subjectResult.evidence,
        qualityScore: subjectResult.qualityScore,
        legacySubject: subjectResult.legacySubject,
      },
    },
    ctaResult,
  )

  const styled = applyMemoryCommunicationStyle({
    body: enrichedStrategy.blocks.map((block) => block.text).join(" "),
    blocks: enrichedStrategy.blocks,
    style: communicationStyle,
  })

  if (styled.blocks !== enrichedStrategy.blocks || styled.body !== enrichedStrategy.blocks.map((b) => b.text).join(" ")) {
    enrichedStrategy = {
      ...enrichedStrategy,
      blocks: styled.blocks,
    }
  }

  const draft = assembleDeterministicOutreachDraft({
    strategy: enrichedStrategy,
    subject: subjectResult.subject,
    maxWords: effectiveMaxWords,
  })

  const styledDraft = applyMemoryCommunicationStyle({
    body: draft.body,
    blocks: enrichedStrategy.blocks,
    style: communicationStyle,
  })

  const finalDraft: OutreachPersonalizationDraft = {
    subject: draft.subject,
    body: trimToMaxWords(styledDraft.body, effectiveMaxWords),
    wordCount: countWords(trimToMaxWords(styledDraft.body, effectiveMaxWords)),
  }

  const contextQuality = computeContextUtilization({
    packet: input.packet,
    strategy: enrichedStrategy,
  })
  const memoryQuality = computeMemoryUtilization({
    packet: input.packet,
    strategy: enrichedStrategy,
  })

  return { strategy: enrichedStrategy, draft: finalDraft, contextQuality, memoryQuality }
}
