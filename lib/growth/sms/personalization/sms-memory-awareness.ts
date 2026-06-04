/** Memory-aware SMS tone (Phase 5.3E). Client-safe. */

import type { OutreachContextPacket } from "@/lib/growth/outreach/personalization/personalization-types"
import { memoryMeetsOutreachThreshold } from "@/lib/growth/outreach/personalization/memory-strategy"

const SMS_BLAST_PATTERNS =
  /\b(touching base|just checking in|hope you'?re well|wanted to reach out|following up on my email|dear |best regards|sincerely|unsubscribe|click here|limited time offer)\b/i

export function hasSmsBlastLanguage(text: string): boolean {
  return SMS_BLAST_PATTERNS.test(text)
}

export function summarizeSmsMemoryContinuity(packet: OutreachContextPacket): string[] {
  if (!memoryMeetsOutreachThreshold(packet)) return []

  const lines: string[] = []
  if (packet.memoryCommitmentSummaries[0]) {
    lines.push(`Commitment: ${packet.memoryCommitmentSummaries[0]}`)
  }
  if (packet.memoryOpenLoopSummaries[0]) {
    lines.push(`Open loop: ${packet.memoryOpenLoopSummaries[0]}`)
  }
  if (packet.objectionSummaries[0]) {
    lines.push(`Objection: ${packet.objectionSummaries[0]}`)
  }
  if (packet.memoryPreferenceSummaries[0]) {
    lines.push(`Preference: ${packet.memoryPreferenceSummaries[0]}`)
  }
  if (packet.priorReplySummaries[0]) {
    lines.push(`Prior reply: ${packet.priorReplySummaries[0]}`)
  }
  return lines
}

export function smsFeelsLikeOngoingConversation(packet: OutreachContextPacket, priorSmsCount: number): boolean {
  return (
    priorSmsCount > 0 ||
    packet.priorReplySummaries.length > 0 ||
    packet.memoryInteractionSummaries.length > 0 ||
    packet.memoryCommitmentSummaries.length > 0
  )
}
