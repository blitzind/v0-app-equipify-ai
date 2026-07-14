/** Build AI OS live reasoning snapshot from canonical outreach intelligence (client-safe). */

import {
  applyAdaptiveLoopToOutreachPreparation,
  applyLearningAdvisoryToRelationshipAssessment,
} from "@/lib/growth/aios/growth/growth-adaptive-loop-1a"
import type { AdaptiveProspectEvent } from "@/lib/growth/aios/growth/growth-adaptive-loop-1a-types"
import { enrichOutreachSalesStrategyBrief } from "@/lib/growth/aios/growth/growth-outreach-conversation-intelligence"
import type { GrowthOutreachLearningThemeWeight } from "@/lib/growth/aios/growth/growth-outreach-conversation-intelligence"
import type { GrowthOutreachSalesStrategyBrief } from "@/lib/growth/aios/growth/growth-outreach-sales-strategy-brief"
import type { RevenueStrategyBuyingCommitteeSnapshot } from "@/lib/growth/aios/growth/growth-outreach-revenue-strategy-intelligence"
import { buildRelationshipAssessment } from "@/lib/growth/aios/growth/growth-relationship-strategy-2a"
import type {
  RelationshipAssessmentContextSignals,
  RelationshipAssessmentLeadSignals,
} from "@/lib/growth/aios/growth/growth-relationship-strategy-2a-types"
import type { GrowthInstitutionalSalesIntelligence } from "@/lib/growth/aios/growth/growth-institutional-learning-1a-types"
import type { GrowthLeadMemoryInfluenceContext } from "@/lib/growth/lead-memory/memory-types"
import type { GrowthRealtimeLiveSnapshot } from "@/lib/growth/realtime/realtime-call-types"
import {
  deriveLiveAdaptiveEventsFromSnapshot,
  liveAnsweredDiscoveryThemes,
  mergeLiveSnapshotIntoRelationshipContext,
  resolveLatestProspectSequenceNumber,
} from "@/lib/growth/operator-assist/call-workspace-aios-live-signals"
import {
  GROWTH_CALL_WORKSPACE_AIOS_LIVE_REASONING_QA_MARKER,
  type CallWorkspaceAiosLiveReasoningSnapshot,
  type CallWorkspaceAiosSayThisNext,
  type CallWorkspaceAiosScenarioBranch,
} from "@/lib/growth/operator-assist/call-workspace-aios-live-reasoning-types"
import type { VoiceCallTranscriptSnapshot } from "@/lib/voice/media-streaming/types"
import type { GrowthCanonicalMeetingBrief } from "@/lib/growth/meeting-intelligence/growth-canonical-meeting-brief-types"
import { projectCanonicalMeetingBriefLiveContext } from "@/lib/growth/meeting-intelligence/growth-canonical-meeting-brief-builder"

export type BuildCallWorkspaceAiosLiveReasoningInput = {
  generatedAt: string
  leadId: string
  companyName: string
  brief: GrowthOutreachSalesStrategyBrief
  leadMemory: GrowthLeadMemoryInfluenceContext | null
  relationshipContext: RelationshipAssessmentContextSignals
  leadSignals: RelationshipAssessmentLeadSignals
  buyingCommitteeSnapshot: RevenueStrategyBuyingCommitteeSnapshot | null
  institutionalLearning: GrowthInstitutionalSalesIntelligence | null
  institutionalAdvice?: string[]
  learningWeights?: GrowthOutreachLearningThemeWeight[] | null
  adaptiveEvents?: AdaptiveProspectEvent[]
  liveSnapshot: GrowthRealtimeLiveSnapshot | null
  voiceTranscript: VoiceCallTranscriptSnapshot | null
  transcriptText?: string
  meetingBrief?: GrowthCanonicalMeetingBrief | null
  agendaStepIndex?: number | null
}

function buildScenarioBranches(input: {
  objections: Array<{ objection: string; response: string }>
  consultantHypothesis: string | null
  conversationApproach: string | null
}): CallWorkspaceAiosScenarioBranch[] {
  const branches: CallWorkspaceAiosScenarioBranch[] = []

  for (const row of input.objections.slice(0, 4)) {
    branches.push({
      trigger: `If prospect objects: ${row.objection}`,
      response: row.response,
    })
  }

  if (input.consultantHypothesis) {
    branches.push({
      trigger: "If prospect agrees",
      response: input.conversationApproach ?? "Confirm the next step and propose a concrete follow-up time.",
    })
  }

  const pricingObjection = input.objections.find((row) => /pricing|budget|cost/i.test(row.objection))
  if (pricingObjection) {
    branches.push({
      trigger: "If prospect asks about pricing",
      response: pricingObjection.response,
    })
  }

  const competitorObjection = input.objections.find((row) => /competitor|vendor|incumbent/i.test(row.objection))
  if (competitorObjection) {
    branches.push({
      trigger: "If prospect asks about competitors",
      response: competitorObjection.response,
    })
  }

  branches.push({
    trigger: "If silence occurs",
    response: "Pause briefly, then ask one focused discovery question about their current operational pressure.",
  })

  return branches.slice(0, 8)
}

function buildSayThisNext(input: {
  enriched: ReturnType<typeof enrichOutreachSalesStrategyBrief>
  liveSnapshot: GrowthRealtimeLiveSnapshot | null
}): CallWorkspaceAiosSayThisNext {
  const discovery = input.enriched.consultantDiscoveryIntelligence
  const revenue = input.enriched.revenueStrategyIntelligence
  const reasoning = input.enriched.operatorReasoning

  const liveQuestion = input.liveSnapshot?.recommendedNextQuestion?.trim()
  const recommendedNextSentence =
    liveQuestion ||
    discovery?.recommendedFirstQuestion?.trim() ||
    revenue?.conversationApproach?.trim() ||
    input.enriched.recommendedCta?.trim() ||
    input.enriched.primaryHook?.trim() ||
    "Ask one focused question about the operational pressure you heard."

  const topObjection = input.enriched.objections[0] ?? null
  const recoveryResponse = topObjection?.response ?? discovery?.conversationAngle ?? null
  const alternativeResponse =
    discovery?.rankedDiscoveryQuestions[1]?.question ??
    input.enriched.trustBuilders[0] ??
    null

  return {
    currentObjective:
      reasoning.conversationGoal ||
      input.enriched.conversationObjective ||
      "Advance the conversation with one clear next step.",
    recommendedNextSentence,
    why: reasoning.reasonForCta || discovery?.consultantHypothesis || reasoning.primaryInsight || "AI OS live reasoning",
    confidence: revenue?.confidenceScore ?? input.enriched.confidence ?? 0.65,
    businessPressure: discovery?.primaryBusinessPressure?.label ?? discovery?.operationalBottleneck ?? null,
    expectedOutcome: revenue?.recommendationSummary ?? reasoning.smallestCommitment ?? null,
    alternativeResponse,
    recoveryResponse,
    scenarioBranches: buildScenarioBranches({
      objections: input.enriched.objections,
      consultantHypothesis: discovery?.consultantHypothesis ?? null,
      conversationApproach: revenue?.conversationApproach ?? null,
    }),
  }
}

export function buildCallWorkspaceAiosLiveReasoningSnapshot(
  input: BuildCallWorkspaceAiosLiveReasoningInput,
): CallWorkspaceAiosLiveReasoningSnapshot {
  const transcriptText = input.transcriptText ?? ""
  const mergedContext = mergeLiveSnapshotIntoRelationshipContext({
    base: input.relationshipContext,
    liveSnapshot: input.liveSnapshot,
    transcriptText,
  })

  const liveAdaptiveEvents = deriveLiveAdaptiveEventsFromSnapshot(input.liveSnapshot)
  const adaptiveEvents = [...(input.adaptiveEvents ?? []), ...liveAdaptiveEvents]

  const adaptive = applyAdaptiveLoopToOutreachPreparation({
    events: adaptiveEvents,
    memory: input.leadMemory,
    context: mergedContext,
    lead: input.leadSignals,
    committee: input.buyingCommitteeSnapshot,
    assessmentInput: {
      companyName: input.companyName,
      institutionalAdvice: input.institutionalAdvice ?? [],
      refreshReasons: ["live_call_transcript_update"],
    },
    learningWeights: input.learningWeights,
    previousAssessment: input.brief.relationshipAssessment,
    previousRevenue: input.brief.revenueStrategyIntelligence,
    extraRefreshReasons: ["call_workspace_live_reasoning"],
  })

  let relationshipAssessment = applyLearningAdvisoryToRelationshipAssessment(
    adaptive.relationshipAssessment,
    input.learningWeights,
  )

  const answeredThemes = uniqueLines([
    ...liveAnsweredDiscoveryThemes(input.liveSnapshot),
    ...(relationshipAssessment.answeredThemes ?? []),
    ...(input.leadMemory?.avoidRepeating ?? []),
  ])

  relationshipAssessment = buildRelationshipAssessment({
    companyName: input.companyName,
    memory: adaptive.memory,
    context: adaptive.context,
    lead: adaptive.lead,
    institutionalAdvice: input.institutionalAdvice ?? [],
    refreshReasons: adaptive.refreshReasons,
    previousRecommendation: input.brief.revenueStrategyIntelligence?.recommendation ?? null,
    previousConfidence: input.brief.revenueStrategyIntelligence?.confidenceScore ?? null,
    currentRecommendation: null,
    currentConfidence: null,
  })

  relationshipAssessment = {
    ...relationshipAssessment,
    answeredThemes,
  }

  const enriched = enrichOutreachSalesStrategyBrief({
    brief: input.brief,
    approvedProfile: input.brief.sellerTruth ? undefined : null,
    website: null,
    contactTitle: input.brief.decisionMakerAnalysis.title,
    equipmentServiced: [],
    industryHint: input.brief.sellerTruth?.matchedIndustryKnowledge ?? null,
    prospectKnowledgePack: null,
    learningWeights: input.learningWeights,
    relationshipStrengthTier: input.leadSignals.relationshipStrengthTier ?? null,
    opportunityReadinessScore: input.leadSignals.relationshipStrengthScore ?? null,
    decisionMakers: [
      {
        name: input.brief.decisionMakerAnalysis.name,
        title: input.brief.decisionMakerAnalysis.title,
        isPrimary: true,
      },
    ],
    buyingCommitteeSnapshot: adaptive.committee,
    communicationChannelHint: "call",
    relationshipAssessment,
    leadMemory: adaptive.memory,
    institutionalLearning: input.institutionalLearning,
  })

  const discovery = enriched.consultantDiscoveryIntelligence
  const revenue = enriched.revenueStrategyIntelligence
  let sayThisNext = buildSayThisNext({ enriched, liveSnapshot: input.liveSnapshot })

  if (input.meetingBrief) {
    const live = projectCanonicalMeetingBriefLiveContext(
      input.meetingBrief,
      input.agendaStepIndex ?? input.liveSnapshot?.discovery.covered.length ?? 0,
    )
    sayThisNext = {
      ...sayThisNext,
      currentObjective: live.currentObjective ?? sayThisNext.currentObjective,
      recommendedNextSentence: live.questionToAskNext ?? sayThisNext.recommendedNextSentence,
      why: live.pursuitOutcome ?? sayThisNext.why,
      recoveryResponse: live.offTrackRecovery ?? sayThisNext.recoveryResponse,
      expectedOutcome: live.commitmentToObtain ?? sayThisNext.expectedOutcome,
    }
  }

  const discoveryMissing = input.liveSnapshot?.discovery.missing ?? []
  const discoveryCovered = input.liveSnapshot?.discovery.covered ?? []

  return {
    qaMarker: GROWTH_CALL_WORKSPACE_AIOS_LIVE_REASONING_QA_MARKER,
    generatedAt: input.generatedAt,
    leadId: input.leadId,
    triggeredBySequenceNumber: resolveLatestProspectSequenceNumber({
      liveSnapshot: input.liveSnapshot,
      voiceTranscript: input.voiceTranscript,
    }),
    conversationStage: discovery?.conversationTiming.reason ?? enriched.conversationRisk.posture,
    buyingIntent: mergedContext.buyingIntent,
    riskLevel:
      enriched.conversationRisk.posture === "curious"
        ? "elevated"
        : enriched.conversationRisk.overall >= 70
          ? "low"
          : "moderate",
    relationshipMovement: relationshipAssessment.relationshipDirection,
    operationalProblem: discovery?.operationalBottleneck ?? discovery?.primaryBusinessPressure?.label ?? null,
    discoveryProgress:
      discoveryCovered.length || discoveryMissing.length
        ? `${discoveryCovered.length} covered · ${discoveryMissing.length} remaining`
        : null,
    conversationMomentum: relationshipAssessment.relationshipMomentum.trend,
    recommendedNextObjective: sayThisNext.currentObjective,
    sayThisNext,
    relationshipHealth: relationshipAssessment.relationshipStory.summary,
    trustBudget: relationshipAssessment.trustBudget.level,
    momentum: relationshipAssessment.relationshipMomentum.trend,
    opportunityReadiness:
      revenue?.opportunityReadiness != null
        ? `${Math.round(revenue.opportunityReadiness.overall * 100)}% ready`
        : null,
    committeeStatus: formatCommitteeStatus(adaptive.committee),
    institutionalAdvisory: (input.institutionalAdvice ?? []).slice(0, 4),
    buyingSignals: (input.liveSnapshot?.buyingSignals ?? []).map((row) => row.label ?? row.key).slice(0, 6),
    conversationRisks: enriched.conversationRisk.risks.slice(0, 6),
    opportunitySignals: (revenue?.timingSignals ?? []).slice(0, 4),
    confidenceLevel: revenue?.confidenceLevel ?? "medium",
    consultantDiscoveryIntelligence: discovery,
    revenueStrategyIntelligence: revenue,
    relationshipAssessment,
    meetingBrief: input.meetingBrief ?? null,
  }
}

function formatCommitteeStatus(
  committee: RevenueStrategyBuyingCommitteeSnapshot | null | undefined,
): string | null {
  if (!committee) return "Committee coverage unknown"
  if (committee.discoveryPending) return "Committee discovery in progress"
  if (committee.singleThreadRisk) return "Single-thread risk — expand stakeholders"
  if (committee.hasVerifiedCommittee) {
    return `${committee.verifiedMemberCount} verified · ${committee.coverageScore}% coverage`
  }
  return "Missing verified committee"
}

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    out.push(trimmed)
  }
  return out
}
