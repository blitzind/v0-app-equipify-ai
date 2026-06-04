/** Memory-backed opener selection (Phase 4.5C). */

import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"
import { interpolateBlockText } from "@/lib/growth/outreach/personalization/message-blocks"
import { pickVariantIndex } from "@/lib/growth/outreach/personalization/message-variability"
import {
  extractMemoryOpenLoop,
  isExistingCustomerRelationship,
  memoryMeetsOutreachThreshold,
  shouldPreferMemoryOpener,
} from "@/lib/growth/outreach/personalization/memory-strategy"
import type {
  MemoryOpenerMetadata,
  MemoryOpenerSource,
  OutreachContextPacket,
} from "@/lib/growth/outreach/personalization/personalization-types"

export type MemoryBackedOpenerSelection = MemoryOpenerMetadata & {
  text: string
}

export type MemoryEvidenceCandidate = {
  source: MemoryOpenerSource
  evidence: string
  topic: string
}

function compactMemoryTopic(text: string, max = 72): string {
  let topic = text.trim().replace(/[.…]+$/, "")
  topic = topic.replace(/^(asked for|requested|mentioned|noted|discussed|promised to|send|share)\s+/i, "")
  if (topic.length <= max) return topic
  const cut = topic.slice(0, max - 1)
  const space = cut.lastIndexOf(" ")
  return `${(space > 24 ? cut.slice(0, space) : cut).trim()}…`
}

function lowercaseLeadIn(text: string): string {
  if (!text) return text
  return text.charAt(0).toLowerCase() + text.slice(1)
}

const MEMORY_OPENER_TEMPLATES: Record<MemoryOpenerSource, string[]> = {
  memory_commitment: [
    "{{contactName}}, following through on {{topic}} for {{companyName}}.",
    "Hi {{contactName}} — picking up {{topic}} as discussed with {{companyName}}.",
    "{{contactName}}, quick follow-up on {{topic}}.",
  ],
  memory_interaction: [
    "{{contactName}}, building on your note about {{topic}}.",
    "Hi {{contactName}} — you mentioned {{topic}}; one focused follow-up for {{companyName}}.",
    "{{contactName}}, circling back on {{topic}} for {{companyName}}.",
  ],
  memory_open_loop: [
    "{{contactName}}, following up on your question about {{topicLower}}.",
    "Hi {{contactName}} — wanted to close the loop on {{topicLower}} for {{companyName}}.",
    "{{contactName}}, picking up your request on {{topicLower}}.",
  ],
  memory_objection: [
    "{{contactName}}, keeping this focused on {{topicLower}} for {{companyName}}.",
    "Hi {{contactName}} — one brief note on {{topicLower}}, without rehashing the full pitch.",
    "{{contactName}}, addressing your concern about {{topicLower}} directly.",
  ],
  memory_preference: [
    "{{contactName}}, keeping this brief — one note on {{topicLower}} for {{companyName}}.",
    "Hi {{contactName}} — short follow-up on {{topicLower}} per your preference.",
  ],
  relationship_summary: [
    "{{contactName}}, picking up from our prior conversation about {{topicLower}}.",
    "Hi {{contactName}} — continuing from where we left off on {{topicLower}}.",
  ],
  relationship_stage: [
    "{{contactName}}, quick next-step note for {{companyName}} on {{topicLower}}.",
    "Hi {{contactName}} — following up on {{topicLower}} for {{companyName}}.",
  ],
}

export function selectMemoryEvidenceCandidate(packet: OutreachContextPacket): MemoryEvidenceCandidate | null {
  if (!memoryMeetsOutreachThreshold(packet)) return null

  if (packet.memoryCommitmentSummaries[0]?.trim()) {
    const evidence = packet.memoryCommitmentSummaries[0].trim()
    return {
      source: "memory_commitment",
      evidence,
      topic: compactMemoryTopic(evidence),
    }
  }

  const openLoop = extractMemoryOpenLoop(packet)
  if (openLoop) {
    return {
      source: "memory_open_loop",
      evidence: openLoop,
      topic: compactMemoryTopic(openLoop),
    }
  }

  if (packet.memoryInteractionSummaries[0]?.trim()) {
    const evidence = packet.memoryInteractionSummaries[0].trim()
    return {
      source: "memory_interaction",
      evidence,
      topic: compactMemoryTopic(evidence),
    }
  }

  if (packet.objectionSummaries[0]?.trim()) {
    const evidence = packet.objectionSummaries[0].trim()
    return {
      source: "memory_objection",
      evidence,
      topic: compactMemoryTopic(evidence.replace(/^[^:]+:\s*/i, "")),
    }
  }

  if (packet.memoryPreferenceSummaries[0]?.trim() && packet.relationshipSummary?.trim()) {
    return {
      source: "memory_preference",
      evidence: packet.memoryPreferenceSummaries[0],
      topic: compactMemoryTopic(packet.relationshipSummary),
    }
  }

  if (packet.relationshipSummary?.trim()) {
    const evidence = packet.relationshipSummary.trim()
    return {
      source: "relationship_summary",
      evidence,
      topic: compactMemoryTopic(evidence),
    }
  }

  if (isExistingCustomerRelationship(packet) && packet.memoryInteractionSummaries[0]?.trim()) {
    const evidence = packet.memoryInteractionSummaries[0].trim()
    return {
      source: "relationship_stage",
      evidence,
      topic: compactMemoryTopic(evidence),
    }
  }

  return null
}

function buildMemoryOpenerText(input: {
  candidate: MemoryEvidenceCandidate
  tokens: { companyName: string; contactName: string | null }
  variationSeed: string
}): string {
  const templates = MEMORY_OPENER_TEMPLATES[input.candidate.source]
  const templateIndex = pickVariantIndex(
    `${input.variationSeed}:memory_opener:${input.candidate.source}`,
    templates.length,
  )
  const template = templates[templateIndex] ?? templates[0]!
  const topic = input.candidate.topic
  const topicLower = lowercaseLeadIn(topic)

  return interpolateBlockText(
    template.replaceAll("{{topic}}", topic).replaceAll("{{topicLower}}", topicLower),
    input.tokens,
  )
}

export function buildMemoryBackedOpener(input: {
  packet: OutreachContextPacket
  generationType: GrowthAiCopilotGenerationType
  variationSeed: string
  tokens: { companyName: string; contactName: string | null }
}): MemoryBackedOpenerSelection | null {
  if (!shouldPreferMemoryOpener(input.packet, input.generationType)) return null

  const candidate = selectMemoryEvidenceCandidate(input.packet)
  if (!candidate) return null

  return {
    source: candidate.source,
    evidence: candidate.evidence,
    text: buildMemoryOpenerText({
      candidate,
      tokens: input.tokens,
      variationSeed: input.variationSeed,
    }),
  }
}
