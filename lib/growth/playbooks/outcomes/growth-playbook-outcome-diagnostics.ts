/** GS-AI-PLAYBOOK-3C — Outcome guidance diagnostics (client-safe). */

import { analyzeGrowthPlaybookOutcomes } from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-analyzer"
import {
  buildOutcomeGuidanceWinningPatternLabels,
  buildGrowthPlaybookOutcomeGuidance,
} from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-guidance"
import type {
  GrowthPlaybookOutcomeGuidance,
  GrowthPlaybookOutcomeGuidanceDiagnostics,
  GrowthPlaybookOutcomeGuidanceInput,
  GrowthPlaybookOutcomeRecord,
} from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-types"

export function buildGrowthPlaybookOutcomeGuidanceDiagnostics(input: {
  guidance: GrowthPlaybookOutcomeGuidance
  records: GrowthPlaybookOutcomeRecord[]
  filter?: GrowthPlaybookOutcomeGuidanceInput["filter"]
  boosts?: string[]
  deprioritized?: string[]
  guidanceApplied?: boolean
}): GrowthPlaybookOutcomeGuidanceDiagnostics {
  const analysis = analyzeGrowthPlaybookOutcomes({ records: input.records, filter: input.filter })
  const winningPatterns = buildOutcomeGuidanceWinningPatternLabels(input.guidance, { filter: input.filter, records: input.records })

  return {
    guidanceApplied: input.guidanceApplied ?? ((input.boosts?.length ?? 0) > 0 || (input.deprioritized?.length ?? 0) > 0),
    boosts: input.boosts ?? [],
    deprioritized: input.deprioritized ?? [],
    confidence: input.guidance.confidence,
    sampleSize: input.guidance.sampleSize,
    freshnessDays: input.guidance.freshnessDays,
    supportingMetrics: {
      approvalRate: analysis.overall.approvalRate,
      regenerationRate: analysis.overall.regenerationRate,
      operatorHelpfulRate: analysis.overall.operatorHelpfulRate,
      openRate: analysis.overall.openRate,
      replyRate: analysis.overall.replyRate,
      meetingRate: analysis.overall.meetingRate,
      ctaRate: analysis.overall.ctaRate,
      videoCompletionRate: analysis.overall.videoCompletionRate,
      shareEngagementRate: analysis.overall.shareEngagementRate,
    },
    winningPatterns,
    avoidPatterns: input.guidance.avoidPatterns,
  }
}

export function buildGrowthPlaybookOutcomeOperatorPreview(
  diagnostics: GrowthPlaybookOutcomeGuidanceDiagnostics,
): {
  winningPatterns: string[]
  avoidPatterns: string[]
  confidenceLabel: string
  sampleSize: number
  freshnessDays: number
} {
  const confidenceLabel =
    diagnostics.confidence === "high" ? "High" : diagnostics.confidence === "medium" ? "Medium" : "Low"

  return {
    winningPatterns: diagnostics.winningPatterns,
    avoidPatterns: diagnostics.avoidPatterns,
    confidenceLabel,
    sampleSize: diagnostics.sampleSize,
    freshnessDays: diagnostics.freshnessDays,
  }
}

export function buildGrowthPlaybookOutcomeGuidanceContext(
  input: GrowthPlaybookOutcomeGuidanceInput & {
    boosts?: string[]
    deprioritized?: string[]
    guidanceApplied?: boolean
  },
): {
  guidance: GrowthPlaybookOutcomeGuidance
  diagnostics: GrowthPlaybookOutcomeGuidanceDiagnostics
} {
  const guidance = buildGrowthPlaybookOutcomeGuidance(input)
  const diagnostics = buildGrowthPlaybookOutcomeGuidanceDiagnostics({
    guidance,
    records: input.records,
    filter: input.filter,
    boosts: input.boosts,
    deprioritized: input.deprioritized,
    guidanceApplied: input.guidanceApplied,
  })
  return { guidance, diagnostics }
}
