/** Memory utilization audit (Phase 4.5G). */

import type {
  MemoryQualityMetadata,
  MemorySignalKey,
  OutreachContextPacket,
  SelectedMessageStrategy,
} from "@/lib/growth/outreach/personalization/personalization-types"

export { OUTREACH_MEMORY_SIGNAL_KEYS } from "@/lib/growth/outreach/personalization/personalization-types"

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim())
}

function hasItems(values: string[] | undefined): boolean {
  return Boolean(values?.some((entry) => entry.trim().length > 0))
}

export function listAvailableMemorySignals(packet: OutreachContextPacket): MemorySignalKey[] {
  if (!packet.memoryAvailable) return []

  const available: MemorySignalKey[] = []
  if (hasText(packet.relationshipStage)) available.push("relationship_stage")
  if (hasText(packet.relationshipSummary)) available.push("relationship_summary")
  if (packet.memoryCoverageScore != null) available.push("memory_coverage")
  if (hasItems(packet.memoryCommitmentSummaries)) available.push("commitments")
  if (hasItems(packet.memoryInteractionSummaries)) available.push("prior_interactions")
  if (hasItems(packet.memoryPreferenceSummaries)) available.push("preferences")
  if (hasItems(packet.objectionSummaries)) available.push("objections")
  if (hasItems(packet.memoryAvoidRepeating)) available.push("avoid_repeating")
  if (hasItems(packet.memoryRiskFlags)) available.push("risk_flags")
  if (hasItems(packet.memoryCommitteeSummaries)) available.push("committee_context")
  if (hasText(packet.memoryEngagementTrend)) available.push("engagement_trend")
  if (packet.memoryProgressionScore != null) available.push("progression_score")
  if (hasItems(packet.memoryOpenLoopSummaries)) available.push("open_loops")

  return available
}

function memoryOpenerSourceToSignal(source: string | undefined): MemorySignalKey | null {
  switch (source) {
    case "memory_commitment":
      return "commitments"
    case "memory_interaction":
      return "prior_interactions"
    case "memory_open_loop":
      return "open_loops"
    case "memory_objection":
      return "objections"
    case "memory_preference":
      return "preferences"
    case "relationship_summary":
      return "relationship_summary"
    case "relationship_stage":
      return "relationship_stage"
    default:
      return null
  }
}

function subjectSourceToMemorySignal(source: string | undefined): MemorySignalKey | null {
  switch (source) {
    case "memory_commitment":
      return "commitments"
    case "memory_interaction":
      return "prior_interactions"
    case "memory_objection":
      return "objections"
    case "memory_open_loop":
      return "open_loops"
    case "memory_preference":
      return "preferences"
    case "relationship_stage":
      return "relationship_stage"
    default:
      return null
  }
}

function ctaSourceToMemorySignal(source: string | undefined): MemorySignalKey | null {
  switch (source) {
    case "memory_commitment":
      return "commitments"
    case "memory_interaction":
      return "prior_interactions"
    case "memory_preference":
      return "preferences"
    case "memory_objection":
      return "objections"
    case "relationship_stage":
      return "relationship_stage"
    default:
      return null
  }
}

export function listUsedMemorySignals(
  packet: OutreachContextPacket,
  strategy: SelectedMessageStrategy,
): MemorySignalKey[] {
  if (!packet.memoryAvailable) return []

  const used = new Set<MemorySignalKey>()

  const openerSignal = memoryOpenerSourceToSignal(strategy.memoryOpener?.source)
  if (openerSignal) used.add(openerSignal)

  if (strategy.memoryOpener) {
    if (hasItems(packet.memoryInteractionSummaries)) used.add("prior_interactions")
    if (hasText(packet.relationshipStage)) used.add("relationship_stage")
    if (hasText(packet.memoryEngagementTrend)) used.add("engagement_trend")
    if (packet.memoryProgressionScore != null) used.add("progression_score")
  }

  const subjectSignal = subjectSourceToMemorySignal(strategy.subjectIntelligence?.evidenceSource)
  if (subjectSignal) used.add(subjectSignal)

  const ctaSignal = ctaSourceToMemorySignal(strategy.ctaIntelligence?.evidenceSource)
  if (ctaSignal) used.add(ctaSignal)

  if (strategy.memoryInfluence?.painInfluenced) used.add("objections")
  if (strategy.memoryInfluence?.objectionAware) used.add("objections")
  if (strategy.memoryInfluence?.styleApplied) {
    if (hasItems(packet.memoryPreferenceSummaries)) used.add("preferences")
    if (hasText(packet.relationshipStage)) used.add("relationship_stage")
  }
  if (strategy.memoryInfluence?.avoidedTopics?.length) used.add("avoid_repeating")
  if (strategy.memoryInfluence?.committeeReferenced && hasItems(packet.memoryCommitteeSummaries)) {
    used.add("committee_context")
  }

  if (packet.memoryCoverageScore != null && used.size > 0) used.add("memory_coverage")

  return [...used].filter((key) => listAvailableMemorySignals(packet).includes(key))
}

export function computeMemoryUtilization(input: {
  packet: OutreachContextPacket
  strategy: SelectedMessageStrategy
}): MemoryQualityMetadata {
  const memorySignalsAvailable = listAvailableMemorySignals(input.packet)
  const memorySignalsUsed = listUsedMemorySignals(input.packet, input.strategy)
  const memoryUtilizationPercentage =
    memorySignalsAvailable.length === 0
      ? 0
      : Math.round((memorySignalsUsed.length / memorySignalsAvailable.length) * 100)

  return {
    memorySignalsAvailable,
    memorySignalsUsed,
    memoryUtilizationPercentage,
  }
}
