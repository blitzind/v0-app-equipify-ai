/** GS-AI-PLAYBOOK-4A — Buying stage intelligence engine (client-safe). */

import { buildGrowthBuyingStageAssessment } from "@/lib/growth/buyer-journey/growth-buying-stage-builder"
import {
  applyBuyingStageGuidanceToCapabilities,
  applyBuyingStageGuidanceToRankedCtas,
  applyBuyingStageGuidanceToRankedStorylines,
  buildBuyingStageMessagingGuidance,
} from "@/lib/growth/buyer-journey/growth-buying-stage-guidance"
import { buildGrowthConversationStateAssessment } from "@/lib/growth/buyer-journey/growth-conversation-state"
import { buildGrowthBuyingStageContext } from "@/lib/growth/buyer-journey/growth-buying-stage-diagnostics"
import { buildGrowthNextBestActionPlan } from "@/lib/growth/buyer-journey/growth-next-best-action"
import {
  buildBuyingStageSignalsFromContextPacket,
  type GrowthBuyingStageSignalInput,
} from "@/lib/growth/buyer-journey/growth-buying-stage-signals"
import {
  GROWTH_BUYING_STAGE_QA_MARKER,
  type GrowthBuyingStageContext,
  type GrowthBuyingStageDiagnostics,
} from "@/lib/growth/buyer-journey/growth-buying-stage-types"
import type { GrowthPlaybookContextInput } from "@/lib/growth/playbooks/context/growth-playbook-context-types"
import { selectGrowthPlaybookContext } from "@/lib/growth/playbooks/context/growth-playbook-selection-engine"
import type { OutreachContextPacket } from "@/lib/growth/outreach/personalization/personalization-types"

export { GROWTH_BUYING_STAGE_QA_MARKER }
export type {
  GrowthBuyingStage,
  GrowthBuyingStageAssessment,
  GrowthBuyingStageContext,
  GrowthBuyingStageDiagnostics,
  GrowthBuyingStageMessagingGuidance,
  GrowthConversationState,
  GrowthConversationStateAssessment,
  GrowthNextBestActionPlan,
  GrowthNextBestActionType,
} from "@/lib/growth/buyer-journey/growth-buying-stage-types"
export {
  buildBuyingStageSignalsFromContextPacket,
  summarizeBuyingStageSignalHaystack,
  type GrowthBuyingStageSignalInput,
} from "@/lib/growth/buyer-journey/growth-buying-stage-signals"
export { buildGrowthBuyingStageAssessment } from "@/lib/growth/buyer-journey/growth-buying-stage-builder"
export { buildGrowthConversationStateAssessment } from "@/lib/growth/buyer-journey/growth-conversation-state"
export {
  applyBuyingStageGuidanceToCapabilities,
  applyBuyingStageGuidanceToRankedCtas,
  applyBuyingStageGuidanceToRankedStorylines,
  buildBuyingStageMessagingGuidance,
  buyingStageLabel,
  conversationStateLabel,
} from "@/lib/growth/buyer-journey/growth-buying-stage-guidance"
export {
  buildGrowthNextBestActionPlan,
  nextBestActionLabel,
  nextBestActionOperatorLabels,
} from "@/lib/growth/buyer-journey/growth-next-best-action"
export {
  buildGrowthBuyingStageContext,
  buildGrowthBuyingStageDiagnostics,
  buildGrowthBuyingStageOperatorPreview,
} from "@/lib/growth/buyer-journey/growth-buying-stage-diagnostics"

export function buildGrowthBuyingStageContextFromSignals(
  signals: GrowthBuyingStageSignalInput,
): GrowthBuyingStageContext {
  const buyingStage = buildGrowthBuyingStageAssessment(signals)
  const conversationState = buildGrowthConversationStateAssessment({
    signals,
    buyingStage: buyingStage.stage,
  })
  const messagingGuidance = buildBuyingStageMessagingGuidance({
    buyingStage: buyingStage.stage,
    conversationState: conversationState.state,
  })
  const nextBestActions = buildGrowthNextBestActionPlan({
    buyingStage: buyingStage.stage,
    conversationState: conversationState.state,
    messagingGuidance,
    signals,
    progressionTriggers: buyingStage.progressionTriggers,
    blockers: buyingStage.blockers,
  })
  return buildGrowthBuyingStageContext({
    buyingStage,
    conversationState,
    messagingGuidance,
    nextBestActions,
  })
}

export function buildGrowthBuyingStageContextFromPacket(
  packet: OutreachContextPacket,
  extras?: Partial<GrowthBuyingStageSignalInput>,
): GrowthBuyingStageContext {
  return buildGrowthBuyingStageContextFromSignals(buildBuyingStageSignalsFromContextPacket(packet, extras))
}

export function applyGrowthBuyingStageGuidanceToPlaybookSelection(input: {
  selection: ReturnType<typeof selectGrowthPlaybookContext>
  buyingStageContext: GrowthBuyingStageContext
}) {
  const guidance = input.buyingStageContext.messagingGuidance
  const ctaResult = applyBuyingStageGuidanceToRankedCtas(input.selection.rankedCtas, guidance)
  const storylineResult = applyBuyingStageGuidanceToRankedStorylines(input.selection.rankedStorylines, guidance)
  const capabilityResult = applyBuyingStageGuidanceToCapabilities(input.selection.selectedCapabilities, guidance)
  const boosts = [...ctaResult.boosts, ...storylineResult.boosts, ...capabilityResult.boosts]
  const deprioritized = [...ctaResult.deprioritized, ...storylineResult.deprioritized, ...capabilityResult.deprioritized]

  const diagnostics: GrowthBuyingStageDiagnostics = {
    ...input.buyingStageContext.diagnostics,
    guidanceApplied: boosts.length > 0 || deprioritized.length > 0,
    boosts,
    deprioritized,
  }

  return {
    selection: {
      ...input.selection,
      rankedCtas: ctaResult.rankedCtas,
      rankedStorylines: storylineResult.rankedStorylines,
      selectedCapabilities: capabilityResult.capabilities,
      selectedCtas: ctaResult.rankedCtas.map((entry) => entry.cta),
      selectedStorylines: storylineResult.rankedStorylines.map((entry) => entry.storyline),
    },
    buyingStageContext: {
      ...input.buyingStageContext,
      diagnostics,
    },
  }
}

export function applyGrowthBuyingStageGuidanceToPlaybookContext(input: {
  contextInput: GrowthPlaybookContextInput
  buyingStageSignals: GrowthBuyingStageSignalInput
  baseSelection?: ReturnType<typeof selectGrowthPlaybookContext>
}): {
  selection: ReturnType<typeof selectGrowthPlaybookContext>
  buyingStageContext: GrowthBuyingStageContext
} {
  const buyingStageContext = buildGrowthBuyingStageContextFromSignals(input.buyingStageSignals)
  const base = input.baseSelection ?? selectGrowthPlaybookContext(input.contextInput)
  return applyGrowthBuyingStageGuidanceToPlaybookSelection({
    selection: base,
    buyingStageContext,
  })
}

export function mergeBuyingStageAvoidPatternsIntoQualityIssues(avoidActions: string[]): string[] {
  return avoidActions.filter((entry) => /demo|pricing|pressure|hard close/i.test(entry))
}
