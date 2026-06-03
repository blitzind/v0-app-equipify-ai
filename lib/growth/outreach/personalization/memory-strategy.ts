/** Deterministic outreach strategy influence from lead memory (Sprint 3 verification fixes). */

import type { OutreachContextPacket } from "@/lib/growth/outreach/personalization/personalization-types"

function memoryHaystack(packet: OutreachContextPacket): string {
  return [
    ...packet.objectionSummaries,
    ...packet.memoryPreferenceSummaries,
    ...packet.memoryAvoidRepeating,
    ...packet.memoryRiskFlags,
    packet.relationshipSummary ?? "",
    ...packet.memoryInteractionSummaries,
  ]
    .join(" ")
    .toLowerCase()
}

export function resolveMemoryInfluencedPainId(packet: OutreachContextPacket): string | null {
  if (!packet.memoryAvailable) return null
  const hay = memoryHaystack(packet)

  if (/\b(budget|price|cost|expensive|afford|roi)\b/.test(hay)) return "capacity_strain"
  if (/\b(dispatch|manual|spreadsheet|whiteboard|route)\b/.test(hay)) return "dispatch_manual"
  if (/\b(schedul|calendar|booking|no online|scheduler)\b/.test(hay)) return "scheduling_gaps"
  if (/\b(capacity|backlog|growth|expansion|strained)\b/.test(hay)) return "capacity_strain"
  if (packet.objectionSummaries.length > 0) return "service_visibility"

  return null
}

export function shouldAvoidPainBlock(painId: string, packet: OutreachContextPacket): boolean {
  if (!packet.memoryAvoidRepeating.length) return false
  const avoid = packet.memoryAvoidRepeating.join(" ").toLowerCase()

  if (painId === "scheduling_gaps" && /\b(schedul|calendar|demo|meeting|booking)\b/.test(avoid)) return true
  if (painId === "dispatch_manual" && /\b(dispatch|workflow|process)\b/.test(avoid)) return true
  if (painId === "capacity_strain" && /\b(budget|capacity|timing|timeline|price)\b/.test(avoid)) return true
  if (painId === "service_visibility" && /\b(visibility|workflow|process|tool)\b/.test(avoid)) return true

  return false
}

export function prefersConciseOutreach(packet: OutreachContextPacket): boolean {
  if (!packet.memoryAvailable) return false
  const prefs = packet.memoryPreferenceSummaries.join(" ").toLowerCase()
  return /\b(email|async|brief|concise|short|written)\b/.test(prefs)
}

export function hasMemoryRelationshipEngagement(packet: OutreachContextPacket): boolean {
  return (
    packet.memoryAvailable &&
    (packet.memoryInteractionSummaries.length > 0 ||
      packet.memoryCommitmentSummaries.length > 0 ||
      packet.priorReplySummaries.length > 0)
  )
}

export function hasCompetitiveMemoryRisk(packet: OutreachContextPacket): boolean {
  if (!packet.memoryAvailable) return false
  const hay = [...packet.memoryRiskFlags, ...packet.objectionSummaries].join(" ").toLowerCase()
  return /\b(competitor|competitive|incumbent|existing vendor|alternative)\b/.test(hay)
}

export function buildMemoryContextOpener(packet: OutreachContextPacket): string | null {
  if (!packet.memoryAvailable) return null
  if (packet.relationshipSummary?.trim()) {
    return `Picking up from our prior conversation — ${packet.relationshipSummary.trim().slice(0, 120)}`
  }
  if (packet.memoryCommitmentSummaries[0]?.trim()) {
    return `Following through on what we discussed — ${packet.memoryCommitmentSummaries[0].trim().slice(0, 100)}`
  }
  if (packet.memoryInteractionSummaries[0]?.trim()) {
    return `Building on your earlier note — ${packet.memoryInteractionSummaries[0].trim().slice(0, 100)}`
  }
  return null
}
