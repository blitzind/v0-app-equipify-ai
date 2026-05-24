/** Assemble deterministic outreach draft from selected blocks (slice 6.15B). */

import { countWords } from "@/lib/growth/outreach/personalization/message-variability"
import { buildDeterministicSubject, selectMessageStrategy } from "@/lib/growth/outreach/personalization/message-strategy"
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
  const body = ordered
    .map((key) => input.strategy.blocks.find((block) => block.key === key)?.text)
    .filter(Boolean)
    .join(" ")
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
  const subject = buildDeterministicSubject({ packet: input.packet, strategy })
  const draft = assembleDeterministicOutreachDraft({ strategy, subject, maxWords: input.maxWords })
  return { strategy, draft }
}
