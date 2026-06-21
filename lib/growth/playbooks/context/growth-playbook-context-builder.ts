/** GS-AI-PLAYBOOK-2B — Playbook context builder (client-safe). */

import type { GrowthIndustryId } from "@/lib/growth/playbooks/industry-taxonomy"
import type { GrowthIndustryPlaybook } from "@/lib/growth/playbooks/industry-playbook-types"
import {
  GROWTH_PLAYBOOK_CONTEXT_QA_MARKER,
  type GrowthPlaybookContext,
  type GrowthPlaybookContextInput,
} from "@/lib/growth/playbooks/context/growth-playbook-context-types"
import { selectGrowthPlaybookContext } from "@/lib/growth/playbooks/context/growth-playbook-selection-engine"
import type { selectGrowthPlaybookContextWithOutcomeGuidance } from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-engine"

export { GROWTH_PLAYBOOK_CONTEXT_QA_MARKER }
export type {
  GrowthPlaybookContext,
  GrowthPlaybookContextInput,
  GrowthPlaybookRankedCta,
  GrowthPlaybookRankedStoryline,
  GrowthPlaybookSelectionTheme,
} from "@/lib/growth/playbooks/context/growth-playbook-context-types"

type PlaybookSelectionResult =
  | ReturnType<typeof selectGrowthPlaybookContext>
  | ReturnType<typeof selectGrowthPlaybookContextWithOutcomeGuidance>

function mapSelectionToPlaybookContext(
  input: GrowthPlaybookContextInput,
  selection: PlaybookSelectionResult,
): GrowthPlaybookContext {
  const primaryCta = selection.rankedCtas.find((entry) => entry.rank === "primary")?.cta ?? selection.selectedCtas[0] ?? null
  const secondaryCta = selection.rankedCtas.find((entry) => entry.rank === "secondary")?.cta ?? selection.selectedCtas[1] ?? null
  const tertiaryCta = selection.rankedCtas.find((entry) => entry.rank === "tertiary")?.cta ?? selection.selectedCtas[2] ?? null

  return {
    industryId: input.industryId,
    playbookDisplayName: input.playbook.displayName,
    enrichmentLevel: input.playbook.enrichmentLevel,
    activeThemes: selection.activeThemes,
    selectedPains: selection.selectedPains,
    selectedDiscoveryQuestions: selection.selectedDiscoveryQuestions,
    selectedCtas: selection.selectedCtas,
    selectedStorylines: selection.selectedStorylines,
    selectedCapabilities: selection.selectedCapabilities,
    selectedObjections: selection.selectedObjections,
    selectedBuyerPersonas: selection.selectedBuyerPersonas,
    selectedSignals: selection.selectedSignals,
    selectedVocabulary: selection.selectedVocabulary,
    selectedTriggers: selection.selectedTriggers,
    primaryPersona: selection.primaryPersona,
    secondaryPersona: selection.secondaryPersona,
    primaryCta,
    secondaryCta,
    tertiaryCta,
    rankedCtas: selection.rankedCtas,
    rankedStorylines: selection.rankedStorylines,
    selectionDiagnostics: selection.selectionDiagnostics,
  }
}

export function buildGrowthPlaybookContextFromSelection(
  input: GrowthPlaybookContextInput,
  selection: PlaybookSelectionResult,
): GrowthPlaybookContext {
  return mapSelectionToPlaybookContext(input, selection)
}

export function buildGrowthPlaybookContext(input: GrowthPlaybookContextInput): GrowthPlaybookContext {
  const selection = selectGrowthPlaybookContext(input)
  return mapSelectionToPlaybookContext(input, selection)
}

export function buildGrowthPlaybookContextFromPlaybook(
  playbook: GrowthIndustryPlaybook,
  options?: Omit<GrowthPlaybookContextInput, "playbook" | "industryId">,
): GrowthPlaybookContext {
  return buildGrowthPlaybookContext({
    playbook,
    industryId: playbook.industryId as GrowthIndustryId,
    ...options,
  })
}
