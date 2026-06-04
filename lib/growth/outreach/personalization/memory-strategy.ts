/** Deterministic outreach strategy influence from lead memory (Sprint 3 + Phase 4.5). */

import type { GrowthAiCopilotGenerationType } from "@/lib/growth/ai-copilot-types"
import type { OutreachContextPacket } from "@/lib/growth/outreach/personalization/personalization-types"

export const MEMORY_OUTREACH_CONFIDENCE_THRESHOLD = 50

const OPEN_LOOP_PATTERN =
  /\b(asked|requested|pricing|breakdown|routing|proposal|send|share|wondering|question|follow up on|technician|scheduling|dispatch workflow)\b/i

function memoryHaystack(packet: OutreachContextPacket): string {
  return [
    ...packet.objectionSummaries,
    ...packet.memoryPreferenceSummaries,
    ...packet.memoryAvoidRepeating,
    ...packet.memoryRiskFlags,
    packet.relationshipSummary ?? "",
    ...packet.memoryInteractionSummaries,
    ...packet.memoryOpenLoopSummaries,
  ]
    .join(" ")
    .toLowerCase()
}

export function memoryMeetsOutreachThreshold(packet: OutreachContextPacket): boolean {
  if (!packet.memoryAvailable) return false
  if ((packet.memoryCoverageScore ?? 0) >= MEMORY_OUTREACH_CONFIDENCE_THRESHOLD) return true
  return (
    packet.memoryCommitmentSummaries.length > 0 ||
    packet.memoryInteractionSummaries.length > 0 ||
    packet.objectionSummaries.length > 0 ||
    packet.memoryOpenLoopSummaries.length > 0
  )
}

export function extractMemoryOpenLoop(packet: OutreachContextPacket): string | null {
  for (const entry of packet.memoryOpenLoopSummaries) {
    if (entry.trim()) return entry.trim()
  }

  for (const entry of [...packet.memoryInteractionSummaries, ...packet.priorReplySummaries]) {
    if (OPEN_LOOP_PATTERN.test(entry)) return entry.trim()
  }

  return null
}

export type MemoryObjectionCategory = "pricing" | "timing" | "implementation" | "staffing" | "general"

export function classifyMemoryObjection(packet: OutreachContextPacket): MemoryObjectionCategory | null {
  if (!packet.objectionSummaries.length) return null
  const hay = packet.objectionSummaries.join(" ").toLowerCase()

  if (/\b(price|pricing|budget|cost|expensive|afford|roi)\b/.test(hay)) return "pricing"
  if (/\b(timing|timeline|later|not now|next quarter|busy season|wait)\b/.test(hay)) return "timing"
  if (/\b(implement|rollout|migration|integration|setup|deploy|change management)\b/.test(hay)) {
    return "implementation"
  }
  if (/\b(staff|staffing|technician|headcount|hiring|capacity|bandwidth)\b/.test(hay)) return "staffing"

  return "general"
}

export function isExistingCustomerRelationship(packet: OutreachContextPacket): boolean {
  const stage = packet.relationshipStage?.toLowerCase() ?? ""
  return stage === "customer" || stage === "opportunity"
}

export function prefersConciseOutreach(packet: OutreachContextPacket): boolean {
  if (!packet.memoryAvailable) return false
  const prefs = packet.memoryPreferenceSummaries.join(" ").toLowerCase()
  return /\b(email|async|brief|concise|short|written|text)\b/.test(prefs)
}

export function prefersExecutiveTone(packet: OutreachContextPacket): boolean {
  if (!packet.memoryAvailable) return false
  const hay = [
    ...packet.memoryPreferenceSummaries,
    packet.decisionMakerTitle ?? "",
    packet.relationshipStage ?? "",
  ]
    .join(" ")
    .toLowerCase()
  return (
    /\b(executive|c-suite|vp|director|president|owner|ceo|coo)\b/.test(hay) ||
    packet.relationshipStage === "evaluating"
  )
}

export function prefersDetailOrientedOutreach(packet: OutreachContextPacket): boolean {
  if (!packet.memoryAvailable) return false
  const prefs = packet.memoryPreferenceSummaries.join(" ").toLowerCase()
  return /\b(detail|detailed|thorough|documentation|write-up|summary|breakdown)\b/.test(prefs)
}

export function hasMemoryRelationshipEngagement(packet: OutreachContextPacket): boolean {
  return (
    packet.memoryAvailable &&
    (packet.memoryInteractionSummaries.length > 0 ||
      packet.memoryCommitmentSummaries.length > 0 ||
      packet.priorReplySummaries.length > 0 ||
      packet.memoryOpenLoopSummaries.length > 0)
  )
}

export function hasCompetitiveMemoryRisk(packet: OutreachContextPacket): boolean {
  if (!packet.memoryAvailable) return false
  const hay = [...packet.memoryRiskFlags, ...packet.objectionSummaries].join(" ").toLowerCase()
  return /\b(competitor|competitive|incumbent|existing vendor|alternative)\b/.test(hay)
}

export function shouldPreferMemoryOpener(
  packet: OutreachContextPacket,
  generationType: GrowthAiCopilotGenerationType,
): boolean {
  if (!memoryMeetsOutreachThreshold(packet)) return false

  if (
    generationType === "follow_up_email" ||
    generationType === "reengagement_email" ||
    generationType === "next_message" ||
    generationType === "response_draft"
  ) {
    return true
  }

  if (isExistingCustomerRelationship(packet)) return true

  if (hasMemoryRelationshipEngagement(packet)) return true

  if (packet.memoryCommitmentSummaries.length > 0) return true

  if (packet.objectionSummaries.length > 0 && (packet.memoryCoverageScore ?? 0) >= 40) return true

  return false
}

export function resolveMemoryInfluencedPainId(packet: OutreachContextPacket): string | null {
  if (!packet.memoryAvailable) return null
  const hay = memoryHaystack(packet)
  const objectionCategory = classifyMemoryObjection(packet)

  if (objectionCategory === "pricing" || objectionCategory === "timing") return "capacity_strain"
  if (objectionCategory === "staffing") return "capacity_strain"
  if (objectionCategory === "implementation") return "service_visibility"

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

export function buildMemoryContextOpener(packet: OutreachContextPacket): string | null {
  void packet
  return null
}
