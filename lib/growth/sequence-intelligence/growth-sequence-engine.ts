/** GS-AI-PLAYBOOK-4C — Sequence intelligence engine (client-safe). */

import type { OutreachContextPacket } from "@/lib/growth/outreach/personalization/personalization-types"
import {
  buildGrowthSequenceHistory,
  buildSequenceSignalsFromContextPacket,
} from "@/lib/growth/sequence-intelligence/growth-sequence-history-builder"
import {
  buildGrowthSequenceDiagnostics,
  buildGrowthSequenceGuidancePromptBlock,
  formatGrowthSequenceOperatorPreview,
} from "@/lib/growth/sequence-intelligence/growth-sequence-diagnostics"
import { buildGrowthSequenceGuidance } from "@/lib/growth/sequence-intelligence/growth-sequence-guidance"
import { buildGrowthSequenceMetrics } from "@/lib/growth/sequence-intelligence/growth-sequence-state"
import type {
  GrowthSequenceIntelligenceContext,
  GrowthSequenceSignalInput,
} from "@/lib/growth/sequence-intelligence/growth-sequence-state-types"

export {
  GROWTH_SEQUENCE_INTELLIGENCE_QA_MARKER,
} from "@/lib/growth/sequence-intelligence/growth-sequence-state-types"
export { formatGrowthSequenceOperatorPreview, buildGrowthSequenceGuidancePromptBlock } from "@/lib/growth/sequence-intelligence/growth-sequence-diagnostics"
export { buildSequenceSignalsFromContextPacket } from "@/lib/growth/sequence-intelligence/growth-sequence-history-builder"

export function buildGrowthSequenceIntelligenceContext(input: {
  packet: OutreachContextPacket
  extras?: Partial<GrowthSequenceSignalInput>
}): GrowthSequenceIntelligenceContext {
  const signals = buildSequenceSignalsFromContextPacket(input.packet, input.extras)
  return buildGrowthSequenceIntelligenceFromSignals(signals)
}

export function buildGrowthSequenceIntelligenceFromSignals(
  signals: GrowthSequenceSignalInput,
): GrowthSequenceIntelligenceContext {
  const history = buildGrowthSequenceHistory(signals)
  const metrics = buildGrowthSequenceMetrics(signals)
  const diagnostics = buildGrowthSequenceDiagnostics(signals)
  return { metrics, history, diagnostics }
}

export function buildGrowthSequenceIntelligenceFromIndustryInput(input: {
  priorTouchCount?: number
  priorOutboundSubjects?: string[]
  researchPainPoints?: string[]
  engagementScore?: number | null
  industryContext?: { buyerJourneyContext?: { buyingStage: { stage: string }; conversationState: { state: string } } | null } | null
}): GrowthSequenceIntelligenceContext {
  const signals: GrowthSequenceSignalInput = {
    priorTouchCount: input.priorTouchCount ?? 0,
    priorOutboundSubjects: input.priorOutboundSubjects ?? [],
    priorTouchSummaries: input.priorOutboundSubjects ?? [],
    researchPainPoints: input.researchPainPoints,
    engagementScore: input.engagementScore ?? null,
    buyingStage: input.industryContext?.buyerJourneyContext?.buyingStage.stage ?? null,
    conversationState: input.industryContext?.buyerJourneyContext?.conversationState.state ?? null,
  }
  return buildGrowthSequenceIntelligenceFromSignals(signals)
}

export function buildGrowthSequenceGuidanceFromPacket(input: {
  packet: OutreachContextPacket
  extras?: Partial<GrowthSequenceSignalInput>
}) {
  const signals = buildSequenceSignalsFromContextPacket(input.packet, input.extras)
  return buildGrowthSequenceGuidance(signals)
}
