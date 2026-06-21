/** GS-AI-PLAYBOOK-3C — Outcome learning engine (client-safe). */

import {
  applyOutcomeGuidanceToCapabilities,
  applyOutcomeGuidanceToRankedCtas,
  applyOutcomeGuidanceToRankedStorylines,
  buildGrowthPlaybookOutcomeGuidance,
  buildOutcomeGuidanceWinningPatternLabels,
} from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-guidance"
import { buildGrowthPlaybookOutcomeGuidanceContext } from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-diagnostics"
import {
  GROWTH_PLAYBOOK_OUTCOME_QA_MARKER,
  type GrowthPlaybookOutcomeGuidance,
  type GrowthPlaybookOutcomeGuidanceContext,
  type GrowthPlaybookOutcomeGuidanceFilter,
  type GrowthPlaybookOutcomeGuidanceInput,
  type GrowthPlaybookOutcomeRecord,
} from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-types"
import type {
  GrowthPlaybookContext,
  GrowthPlaybookContextInput,
} from "@/lib/growth/playbooks/context/growth-playbook-context-types"
import { selectGrowthPlaybookContext } from "@/lib/growth/playbooks/context/growth-playbook-selection-engine"
import { inferOutcomePersonaArchetype } from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-builder"

export { GROWTH_PLAYBOOK_OUTCOME_QA_MARKER }
export type {
  GrowthPlaybookOutcomeGuidance,
  GrowthPlaybookOutcomeGuidanceContext,
  GrowthPlaybookOutcomeGuidanceDiagnostics,
  GrowthPlaybookOutcomeGuidanceFilter,
  GrowthPlaybookOutcomeGuidanceInput,
  GrowthPlaybookOutcomeMetrics,
  GrowthPlaybookOutcomeRecord,
  GrowthPlaybookOutcomeSegmentMetrics,
} from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-types"
export {
  buildOutcomeRecordFromEvaluation,
  buildOutcomeRecordsFromEvaluation,
  inferOutcomeCtaType,
  inferOutcomePersonaArchetype,
  inferOutcomeProofType,
  mergeOutcomeRecords,
  summarizeOutcomeRates,
} from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-builder"
export {
  analyzeGrowthPlaybookOutcomes,
  bottomPerformingOutcomePatterns,
  topPerformingOutcomeValues,
} from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-analyzer"
export {
  applyOutcomeGuidanceToCapabilities,
  applyOutcomeGuidanceToRankedCtas,
  applyOutcomeGuidanceToRankedStorylines,
  buildGrowthPlaybookOutcomeGuidance,
  buildOutcomeGuidanceWinningPatternLabels,
} from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-guidance"
export {
  buildGrowthPlaybookOutcomeGuidanceContext,
  buildGrowthPlaybookOutcomeGuidanceDiagnostics,
  buildGrowthPlaybookOutcomeOperatorPreview,
} from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-diagnostics"

export function buildOutcomeGuidanceFilterFromContext(input: {
  industryId?: string | null
  decisionMakerTitle?: string | null
  personaTitle?: string | null
  channel?: GrowthPlaybookOutcomeGuidanceFilter["channel"]
}): GrowthPlaybookOutcomeGuidanceFilter {
  return {
    industryId: input.industryId ?? null,
    personaArchetype: inferOutcomePersonaArchetype({
      decisionMakerTitle: input.decisionMakerTitle,
      personaTitle: input.personaTitle,
    }),
    channel: input.channel ?? null,
  }
}

export function selectGrowthPlaybookContextWithOutcomeGuidance(
  input: GrowthPlaybookContextInput & {
    outcomeGuidance?: GrowthPlaybookOutcomeGuidance | null
  },
): ReturnType<typeof selectGrowthPlaybookContext> & {
  outcomeDiagnostics: GrowthPlaybookOutcomeGuidanceContext["diagnostics"] | null
} {
  const base = selectGrowthPlaybookContext(input)
  const guidance = input.outcomeGuidance
  if (!guidance) {
    return { ...base, outcomeDiagnostics: null }
  }

  const ctaResult = applyOutcomeGuidanceToRankedCtas(base.rankedCtas, guidance)
  const storylineResult = applyOutcomeGuidanceToRankedStorylines(base.rankedStorylines, guidance)
  const capabilityResult = applyOutcomeGuidanceToCapabilities(base.selectedCapabilities, guidance)

  const boosts = [...ctaResult.boosts, ...storylineResult.boosts, ...capabilityResult.boosts]
  const deprioritized = [
    ...ctaResult.deprioritized,
    ...storylineResult.deprioritized,
    ...capabilityResult.deprioritized,
  ]

  return {
    ...base,
    rankedCtas: ctaResult.rankedCtas,
    rankedStorylines: storylineResult.rankedStorylines,
    selectedCapabilities: capabilityResult.capabilities,
    selectedCtas: ctaResult.rankedCtas.map((entry) => entry.cta),
    selectedStorylines: storylineResult.rankedStorylines.map((entry) => entry.storyline),
    outcomeDiagnostics: {
      guidanceApplied: boosts.length > 0 || deprioritized.length > 0,
      boosts,
      deprioritized,
      confidence: guidance.confidence,
      sampleSize: guidance.sampleSize,
      freshnessDays: guidance.freshnessDays,
      supportingMetrics: {},
      winningPatterns: buildOutcomeGuidanceWinningPatternLabels(guidance, {
        filter: {
          industryId: input.industryId,
          personaArchetype: inferOutcomePersonaArchetype({ decisionMakerTitle: input.decisionMakerTitle }),
        },
      }),
      avoidPatterns: guidance.avoidPatterns,
    },
  }
}

export function applyGrowthPlaybookOutcomeGuidanceToPlaybookContext(input: {
  contextInput: GrowthPlaybookContextInput
  outcomeRecords: GrowthPlaybookOutcomeRecord[]
  channel?: GrowthPlaybookOutcomeGuidanceFilter["channel"]
}): {
  selection: ReturnType<typeof selectGrowthPlaybookContextWithOutcomeGuidance>
  outcomeGuidanceContext: GrowthPlaybookOutcomeGuidanceContext
} {
  const filter = buildOutcomeGuidanceFilterFromContext({
    industryId: input.contextInput.industryId,
    decisionMakerTitle: input.contextInput.decisionMakerTitle,
    channel: input.channel ?? "EMAIL",
  })

  const enrichedRecords = input.outcomeRecords.map((record) => ({
    ...record,
    industryId: record.industryId ?? input.contextInput.industryId,
    personaArchetype:
      record.personaArchetype ??
      inferOutcomePersonaArchetype({ decisionMakerTitle: input.contextInput.decisionMakerTitle }),
  }))

  const guidance = buildGrowthPlaybookOutcomeGuidance({ records: enrichedRecords, filter })
  const selection = selectGrowthPlaybookContextWithOutcomeGuidance({
    ...input.contextInput,
    outcomeGuidance: guidance,
  })

  const outcomeGuidanceContext = buildGrowthPlaybookOutcomeGuidanceContext({
    records: enrichedRecords,
    filter,
    boosts: selection.outcomeDiagnostics?.boosts,
    deprioritized: selection.outcomeDiagnostics?.deprioritized,
    guidanceApplied: selection.outcomeDiagnostics?.guidanceApplied,
  })

  return { selection, outcomeGuidanceContext }
}

export function mergeOutcomeGuidanceIntoPlaybookContext(
  context: GrowthPlaybookContext,
  _outcomeGuidanceContext: GrowthPlaybookOutcomeGuidanceContext | null,
): GrowthPlaybookContext {
  return context
}
