/** Assemble deterministic outreach draft from selected blocks (slice 6.15B). */

import { countWords } from "@/lib/growth/outreach/personalization/message-variability"
import { applyCtaIntelligence, buildIntelligentCta } from "@/lib/growth/outreach/personalization/cta-intelligence"
import { selectMessageStrategy } from "@/lib/growth/outreach/personalization/message-strategy"
import { buildIntelligentSubject } from "@/lib/growth/outreach/personalization/subject-intelligence"
import { computeContextUtilization } from "@/lib/growth/outreach/personalization/context-utilization"
import { buildMemoryContextOpener } from "@/lib/growth/outreach/personalization/memory-strategy"
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
  memoryOpener?: string | null
}): OutreachPersonalizationDraft {
  const ordered = ["opening", "pain", "industry", "proof", "cta"] as const
  const blockText = ordered
    .map((key) => input.strategy.blocks.find((block) => block.key === key)?.text)
    .filter(Boolean)
    .join(" ")
  const opener = input.memoryOpener?.trim()
  const body = opener ? `${opener} ${blockText}` : blockText
  const trimmed = trimToMaxWords(body, input.maxWords)
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
} {
  const strategy = selectMessageStrategy({
    leadId: input.leadId,
    packet: input.packet,
    signals: input.signals,
    generationType: input.generationType,
  })
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
  const enrichedStrategy = applyCtaIntelligence(
    {
      ...strategy,
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
  const draft = assembleDeterministicOutreachDraft({
    strategy: enrichedStrategy,
    subject: subjectResult.subject,
    maxWords: input.maxWords,
    memoryOpener: buildMemoryContextOpener(input.packet),
  })
  const contextQuality = computeContextUtilization({
    packet: input.packet,
    strategy: enrichedStrategy,
  })
  return { strategy: enrichedStrategy, draft, contextQuality }
}
