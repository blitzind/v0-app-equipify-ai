/** Assemble deterministic outreach draft from selected blocks (slice 6.15B). */

import { countWords } from "@/lib/growth/outreach/personalization/message-variability"
import { selectMessageStrategy } from "@/lib/growth/outreach/personalization/message-strategy"
import { buildIntelligentSubject } from "@/lib/growth/outreach/personalization/subject-intelligence"
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
}): { strategy: SelectedMessageStrategy; draft: OutreachPersonalizationDraft } {
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
  const enrichedStrategy: SelectedMessageStrategy = {
    ...strategy,
    subjectIntelligence: {
      category: subjectResult.category,
      evidenceSource: subjectResult.evidenceSource,
      evidence: subjectResult.evidence,
      qualityScore: subjectResult.qualityScore,
      legacySubject: subjectResult.legacySubject,
    },
  }
  const draft = assembleDeterministicOutreachDraft({
    strategy: enrichedStrategy,
    subject: subjectResult.subject,
    maxWords: input.maxWords,
    memoryOpener: buildMemoryContextOpener(input.packet),
  })
  return { strategy: enrichedStrategy, draft }
}
