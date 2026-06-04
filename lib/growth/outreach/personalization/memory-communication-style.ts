/** Memory-driven communication style adaptation (Phase 4.5E). */

import {
  hasMemoryRelationshipEngagement,
  isExistingCustomerRelationship,
  prefersConciseOutreach,
  prefersDetailOrientedOutreach,
  prefersExecutiveTone,
} from "@/lib/growth/outreach/personalization/memory-strategy"
import type {
  MemoryCommunicationStyle,
  OutreachContextPacket,
  SelectedMessageBlock,
} from "@/lib/growth/outreach/personalization/personalization-types"

const SHORT_SENTENCE_MAX_WORDS = 18

function shortenSentence(sentence: string): string {
  const words = sentence.trim().split(/\s+/).filter(Boolean)
  if (words.length <= SHORT_SENTENCE_MAX_WORDS) return sentence.trim()
  return `${words.slice(0, SHORT_SENTENCE_MAX_WORDS).join(" ")}…`
}

function applyShortSentences(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => shortenSentence(sentence))
    .join(" ")
}

function softenFormality(text: string): string {
  return text
    .replace(/\bI wanted to reach out\b/gi, "Quick note")
    .replace(/\breaching out about\b/gi, "following up on")
    .replace(/\bjust checking in\b/gi, "following up")
}

function tightenExecutiveTone(text: string): string {
  return text
    .replace(/\bHappy to share\b/gi, "I can share")
    .replace(/\bWould a short ops workflow review be helpful\?\b/gi, "Worth a brief ops review?")
    .replace(/\bOpen to a 15-minute walkthrough next week\?\b/gi, "Worth a 15-minute review?")
}

export function resolveMemoryCommunicationStyle(packet: OutreachContextPacket): MemoryCommunicationStyle {
  const concise = prefersConciseOutreach(packet)
  const executive = prefersExecutiveTone(packet)
  const detailOriented = prefersDetailOrientedOutreach(packet)
  const warm = hasMemoryRelationshipEngagement(packet)
  const customer = isExistingCustomerRelationship(packet)

  let maxWordsOverride: number | undefined
  if (concise) maxWordsOverride = warm ? 95 : 105
  else if (executive) maxWordsOverride = 110
  else if (customer && warm) maxWordsOverride = 115

  return {
    maxWordsOverride,
    preferShortSentences: concise || executive,
    formality: executive ? "executive" : warm ? "relationship" : "standard",
    omitProofBlock: concise && warm && !detailOriented,
    applied: concise || executive || detailOriented || customer,
  }
}

export function applyMemoryCommunicationStyle(input: {
  body: string
  blocks: SelectedMessageBlock[]
  style: MemoryCommunicationStyle
}): { body: string; blocks: SelectedMessageBlock[] } {
  if (!input.style.applied) {
    return { body: input.body, blocks: input.blocks }
  }

  let body = input.body
  if (input.style.preferShortSentences) {
    body = applyShortSentences(body)
  }
  if (input.style.formality === "executive") {
    body = tightenExecutiveTone(body)
  } else if (input.style.formality === "relationship") {
    body = softenFormality(body)
  }

  let blocks = input.blocks
  if (input.style.omitProofBlock) {
    blocks = blocks.filter((block) => block.key !== "proof")
    body = blocks.map((block) => block.text).join(" ")
  }

  return { body: body.trim(), blocks }
}
