/** GS-AI-PLAYBOOK-4A — Buying stage diagnostics (client-safe). */

import type {
  GrowthBuyingStageAssessment,
  GrowthBuyingStageContext,
  GrowthBuyingStageDiagnostics,
  GrowthBuyingStageMessagingGuidance,
  GrowthConversationStateAssessment,
} from "@/lib/growth/buyer-journey/growth-buying-stage-types"
import type { GrowthNextBestActionPlan } from "@/lib/growth/buyer-journey/growth-buying-stage-types"
import { nextBestActionOperatorLabels } from "@/lib/growth/buyer-journey/growth-next-best-action"
import { buyingStageLabel, conversationStateLabel } from "@/lib/growth/buyer-journey/growth-buying-stage-guidance"

export function buildGrowthBuyingStageDiagnostics(input: {
  buyingStage: GrowthBuyingStageAssessment
  conversationState: GrowthConversationStateAssessment
  messagingGuidance: GrowthBuyingStageMessagingGuidance
  nextBestActions: GrowthNextBestActionPlan
  boosts?: string[]
  deprioritized?: string[]
  guidanceApplied?: boolean
}): GrowthBuyingStageDiagnostics {
  const confidence = Math.round((input.buyingStage.confidenceScore + input.conversationState.confidenceScore) / 2)
  return {
    buyingStage: input.buyingStage.stage,
    conversationState: input.conversationState.state,
    confidence,
    progressionSignals: [
      ...input.buyingStage.progressionTriggers,
      ...input.conversationState.signals,
    ].slice(0, 8),
    blockers: [...new Set([...input.buyingStage.blockers, ...(input.nextBestActions.avoidActions.filter((entry) => /objection|friction/i.test(entry)) ? [] : [])])],
    nextBestActions: input.nextBestActions,
    messagingGuidance: input.messagingGuidance,
    guidanceApplied: input.guidanceApplied ?? ((input.boosts?.length ?? 0) > 0 || (input.deprioritized?.length ?? 0) > 0),
    boosts: input.boosts ?? [],
    deprioritized: input.deprioritized ?? [],
  }
}

export function buildGrowthBuyingStageOperatorPreview(
  diagnostics: GrowthBuyingStageDiagnostics,
): {
  buyingStageLabel: string
  conversationStateLabel: string
  nextBestActions: string[]
  avoidActions: string[]
  confidence: number
} {
  const labels = nextBestActionOperatorLabels(diagnostics.nextBestActions)
  const actions = [labels.primary, labels.secondary].filter(Boolean) as string[]
  return {
    buyingStageLabel: buyingStageLabel(diagnostics.buyingStage),
    conversationStateLabel: conversationStateLabel(diagnostics.conversationState),
    nextBestActions: actions,
    avoidActions: diagnostics.nextBestActions.avoidActions,
    confidence: diagnostics.confidence,
  }
}

export function buildGrowthBuyingStageContext(input: {
  buyingStage: GrowthBuyingStageAssessment
  conversationState: GrowthConversationStateAssessment
  messagingGuidance: GrowthBuyingStageMessagingGuidance
  nextBestActions: GrowthNextBestActionPlan
  boosts?: string[]
  deprioritized?: string[]
  guidanceApplied?: boolean
}): GrowthBuyingStageContext {
  const diagnostics = buildGrowthBuyingStageDiagnostics(input)
  return {
    buyingStage: input.buyingStage,
    conversationState: input.conversationState,
    messagingGuidance: input.messagingGuidance,
    nextBestActions: input.nextBestActions,
    diagnostics,
  }
}
