/** GS-AI-PLAYBOOK-4B — Reasoning engine orchestrator (client-safe). */

import type { GrowthIndustryContext } from "@/lib/growth/playbooks/growth-industry-context-types"
import type { OutreachContextPacket } from "@/lib/growth/outreach/personalization/personalization-types"
import { buildGrowthNarrativeBrief } from "@/lib/growth/reasoning/growth-message-brief"
import { buildGrowthMessagePlan } from "@/lib/growth/reasoning/growth-message-planner"
import { buildGrowthReasoningObservations } from "@/lib/growth/reasoning/growth-observation-builder"
import {
  buildGrowthReasoningDiagnostics,
  formatGrowthReasoningOperatorPreview,
} from "@/lib/growth/reasoning/growth-reasoning-diagnostics"
import { prioritizeGrowthReasoningObservations } from "@/lib/growth/reasoning/growth-priority-engine"
import { buildGrowthSequenceIntelligenceContext } from "@/lib/growth/sequence-intelligence/growth-sequence-engine"
import type {
  GrowthReasoningChannel,
  GrowthReasoningContext,
  GrowthReasoningDiagnostics,
} from "@/lib/growth/reasoning/growth-reasoning-types"

export { formatGrowthReasoningOperatorPreview } from "@/lib/growth/reasoning/growth-reasoning-diagnostics"
export { GROWTH_REASONING_QA_MARKER } from "@/lib/growth/reasoning/growth-reasoning-types"

function emptyOutreachContextPacket(
  overrides: Partial<OutreachContextPacket> & Pick<OutreachContextPacket, "companyName">,
): OutreachContextPacket {
  return {
    industryLabel: null,
    website: null,
    employeeSize: null,
    location: null,
    decisionMakerName: null,
    decisionMakerTitle: null,
    fitScore: null,
    engagementScore: null,
    opportunityReadinessTier: null,
    buyingIntent: null,
    competitorPressure: null,
    capacitySignals: [],
    websiteSummary: null,
    websiteTextExcerpt: null,
    websiteFindings: [],
    hiringSignals: [],
    enrichmentFindings: [],
    researchRecommendedNextAction: null,
    priorTouchSummaries: [],
    priorReplySummaries: [],
    objectionSummaries: [],
    sequenceHistorySummaries: [],
    timelineEventSummaries: [],
    researchConfidence: null,
    researchPainPoints: [],
    equipmentServiceIndicators: [],
    companySummary: null,
    outreachAngles: [],
    priorOutboundSubjects: [],
    priorTouchCount: 0,
    hasWebsiteResearch: false,
    hasDecisionMaker: false,
    memoryAvailable: false,
    memoryCoverageScore: null,
    relationshipStage: null,
    relationshipSummary: null,
    memoryPreferenceSummaries: [],
    memoryInteractionSummaries: [],
    memoryCommitmentSummaries: [],
    memoryAvoidRepeating: [],
    memoryRiskFlags: [],
    memoryCommitteeSummaries: [],
    memoryOpenLoopSummaries: [],
    memoryEngagementTrend: null,
    memoryProgressionScore: null,
    memoryUnresolvedObjectionCount: 0,
    leadEngineGuidance: null,
    industryContext: null,
    ...overrides,
  }
}

export function buildMinimalOutreachContextPacketForReasoning(input: {
  industryContext: GrowthIndustryContext | null
  companyName?: string | null
  contactName?: string | null
  verifiedFacts?: string[]
  researchPainPoints?: string[]
  priorTouchCount?: number
  engagementScore?: number | null
}): OutreachContextPacket {
  const companyName = input.companyName?.trim() || "Prospect company"
  const industryContext = input.industryContext
    ? {
        ...input.industryContext,
        verifiedFacts: input.verifiedFacts?.length
          ? input.verifiedFacts
          : input.industryContext.verifiedFacts,
      }
    : null

  return emptyOutreachContextPacket({
    companyName,
    decisionMakerName: input.contactName ?? null,
    hasDecisionMaker: Boolean(input.contactName?.trim()),
    researchPainPoints: input.researchPainPoints ?? [],
    priorTouchCount: input.priorTouchCount ?? 0,
    engagementScore: input.engagementScore ?? null,
    industryContext,
  })
}

export function buildGrowthReasoningContext(input: {
  packet: OutreachContextPacket
  channel: GrowthReasoningChannel
}): GrowthReasoningContext {
  const diagnostics = buildGrowthReasoningDiagnosticsFromPacket(input)
  return {
    channel: input.channel,
    diagnostics,
  }
}

export function buildGrowthReasoningDiagnosticsFromIndustryInput(input: {
  channel: GrowthReasoningChannel
  industryContext: GrowthIndustryContext | null
  companyName?: string | null
  contactName?: string | null
  verifiedFacts?: string[]
  researchPainPoints?: string[]
  priorTouchCount?: number
  engagementScore?: number | null
}): GrowthReasoningDiagnostics {
  const packet = buildMinimalOutreachContextPacketForReasoning(input)
  return buildGrowthReasoningDiagnosticsFromPacket({ packet, channel: input.channel })
}

export function buildGrowthReasoningDiagnosticsFromPacket(input: {
  packet: OutreachContextPacket
  channel: GrowthReasoningChannel
}): GrowthReasoningDiagnostics {
  const { packet, channel } = input
  const industryContext = packet.industryContext
  const sequenceContext = buildGrowthSequenceIntelligenceContext({ packet })
  const buyingStage = industryContext?.buyerJourneyContext?.buyingStage.stage ?? null

  const observations = buildGrowthReasoningObservations({
    packet,
    channel,
    sequenceGuidance: sequenceContext.diagnostics.guidance,
  })
  const { topInsights, secondaryInsights, ignoredInsights } = prioritizeGrowthReasoningObservations({
    observations,
    channel,
    buyingStage,
  })

  const messagePlan = buildGrowthMessagePlan({
    topInsights,
    industryContext: industryContext
      ? { ...industryContext, sequenceIntelligenceContext: sequenceContext }
      : null,
  })
  const narrativeBrief = buildGrowthNarrativeBrief({
    topInsights,
    messagePlan,
    industryContext,
    companyName: packet.companyName,
    contactName: packet.decisionMakerName,
  })

  return buildGrowthReasoningDiagnostics({
    observations,
    topInsights,
    secondaryInsights,
    ignoredInsights,
    messagePlan,
    narrativeBrief,
    sequenceDiagnostics: sequenceContext.diagnostics,
  })
}
