/** GS-AI-PLAYBOOK-4C — Sequence guidance synthesis (client-safe). */

import type {
  GrowthSequenceGuidance,
  GrowthSequenceSignalInput,
} from "@/lib/growth/sequence-intelligence/growth-sequence-state-types"
import { buildGrowthSequenceCtaProgression } from "@/lib/growth/sequence-intelligence/growth-cta-progression"
import { buildGrowthSequenceEngagementProgression } from "@/lib/growth/sequence-intelligence/growth-engagement-progression"
import { buildGrowthSequenceFatigue } from "@/lib/growth/sequence-intelligence/growth-sequence-fatigue"
import { buildGrowthSequenceNarrativeProgression } from "@/lib/growth/sequence-intelligence/growth-narrative-progression"
import { buildGrowthSequenceProofProgression } from "@/lib/growth/sequence-intelligence/growth-proof-progression"
import { detectGrowthSequenceState } from "@/lib/growth/sequence-intelligence/growth-sequence-state"

export function buildGrowthSequenceGuidance(input: GrowthSequenceSignalInput): GrowthSequenceGuidance {
  const sequenceState = detectGrowthSequenceState(input)
  const narrative = buildGrowthSequenceNarrativeProgression(input)
  const proof = buildGrowthSequenceProofProgression(input)
  const cta = buildGrowthSequenceCtaProgression(input)
  const engagement = buildGrowthSequenceEngagementProgression(input)
  const fatigue = buildGrowthSequenceFatigue(input)

  const avoidPatterns = [
    ...fatigue.recommendations,
    ...cta.avoidCtas.map((entry) => `Avoid CTA: ${entry}`),
    ...narrative.overusedThemes.map((theme) => `Avoid repeating ${theme.replace(/_/g, " ")}`),
    ...(input.memoryAvoidRepeating ?? []).slice(0, 2).map((entry) => `Avoid: ${entry}`),
  ].filter((entry, idx, arr) => arr.indexOf(entry) === idx)

  const confidence = Math.round(
    (engagement.confidence +
      ((input.priorTouchCount ?? 0) > 0 ? 70 : 50) +
      (fatigue.fatigueLevel === "high" ? 55 : 75)) /
      3,
  )

  return {
    sequenceState,
    nextNarrative: narrative.recommendedThemes[0] ?? "workflow_pain",
    nextProof: proof.recommendedProof,
    nextCta: cta.currentCtaStage,
    engagementTrend: engagement.engagementTrend,
    fatigueLevel: fatigue.fatigueLevel,
    avoidPatterns: avoidPatterns.slice(0, 8),
    confidence: Math.max(40, Math.min(95, confidence)),
  }
}
