/** GS-AI-PLAYBOOK-4C — Sequence diagnostics & operator preview (client-safe). */

import { ctaStageLabel } from "@/lib/growth/sequence-intelligence/growth-cta-progression"
import { engagementTrendLabel } from "@/lib/growth/sequence-intelligence/growth-engagement-progression"
import { fatigueLevelLabel } from "@/lib/growth/sequence-intelligence/growth-sequence-fatigue"
import { narrativeThemeLabel } from "@/lib/growth/sequence-intelligence/growth-narrative-progression"
import { proofStageLabel } from "@/lib/growth/sequence-intelligence/growth-proof-progression"
import type {
  GrowthSequenceDiagnostics,
  GrowthSequenceGuidance,
  GrowthSequenceSignalInput,
} from "@/lib/growth/sequence-intelligence/growth-sequence-state-types"
import { buildGrowthSequenceCtaProgression } from "@/lib/growth/sequence-intelligence/growth-cta-progression"
import { buildGrowthSequenceEngagementProgression } from "@/lib/growth/sequence-intelligence/growth-engagement-progression"
import { buildGrowthSequenceFatigue } from "@/lib/growth/sequence-intelligence/growth-sequence-fatigue"
import { buildGrowthSequenceNarrativeProgression } from "@/lib/growth/sequence-intelligence/growth-narrative-progression"
import { buildGrowthSequenceProofProgression } from "@/lib/growth/sequence-intelligence/growth-proof-progression"
import { buildGrowthSequenceGuidance } from "@/lib/growth/sequence-intelligence/growth-sequence-guidance"
import { detectGrowthSequenceState } from "@/lib/growth/sequence-intelligence/growth-sequence-state"

export function buildGrowthSequenceDiagnostics(input: GrowthSequenceSignalInput): GrowthSequenceDiagnostics {
  const narrative = buildGrowthSequenceNarrativeProgression(input)
  const proof = buildGrowthSequenceProofProgression(input)
  const cta = buildGrowthSequenceCtaProgression(input)
  const engagement = buildGrowthSequenceEngagementProgression(input)
  const fatigue = buildGrowthSequenceFatigue(input)
  const guidance = buildGrowthSequenceGuidance(input)
  const sequenceState = detectGrowthSequenceState(input)

  return {
    sequenceState,
    touchCount: input.priorTouchCount ?? 0,
    progression: { narrative, proof, cta, engagement, fatigue },
    narrativeHistory: narrative.usedThemes,
    proofHistory: proof.usedProofStages,
    ctaHistory: cta.usedCtaStages,
    engagementTrend: engagement.engagementTrend,
    fatigue,
    guidance,
    guidanceApplied: (input.priorTouchCount ?? 0) > 0 || narrative.usedThemes.length > 0,
  }
}

export function formatGrowthSequenceOperatorPreview(diagnostics: GrowthSequenceDiagnostics): {
  sequenceLabel: string
  touchCount: number
  narrativeUsed: string[]
  recommended: string[]
  avoid: string[]
  fatigueLabel: string
  engagementLabel: string
  objective: string
} {
  const { guidance, progression } = diagnostics
  return {
    sequenceLabel: guidance.sequenceState.replace(/_/g, " "),
    touchCount: diagnostics.touchCount,
    narrativeUsed: diagnostics.narrativeHistory.map((theme) => narrativeThemeLabel(theme)),
    recommended: [
      narrativeThemeLabel(guidance.nextNarrative),
      proofStageLabel(guidance.nextProof),
      ctaStageLabel(guidance.nextCta),
    ],
    avoid: guidance.avoidPatterns.slice(0, 5),
    fatigueLabel: fatigueLevelLabel(guidance.fatigueLevel),
    engagementLabel: engagementTrendLabel(progression.engagement.engagementTrend),
    objective: progression.engagement.recommendedApproach,
  }
}

export function buildGrowthSequenceGuidancePromptBlock(guidance: GrowthSequenceGuidance): string {
  return [
    "SEQUENCE GUIDANCE (highest-priority progression layer — bias planning, do not rewrite history):",
    `Sequence state: ${guidance.sequenceState.replace(/_/g, " ")}`,
    `Next narrative: ${narrativeThemeLabel(guidance.nextNarrative)}`,
    `Next proof: ${proofStageLabel(guidance.nextProof)}`,
    `Next CTA stage: ${ctaStageLabel(guidance.nextCta)}`,
    `Engagement trend: ${engagementTrendLabel(guidance.engagementTrend)}`,
    `Fatigue level: ${fatigueLevelLabel(guidance.fatigueLevel)}`,
    guidance.avoidPatterns.length ? `Avoid: ${guidance.avoidPatterns.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}
