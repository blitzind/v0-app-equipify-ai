/** GS-AI-PLAYBOOK-4C — Proof stage progression (client-safe). */

import type {
  GrowthSequenceProofProgression,
  GrowthSequenceProofStage,
  GrowthSequenceSignalInput,
} from "@/lib/growth/sequence-intelligence/growth-sequence-state-types"
import { buildSequenceHistoryHaystack } from "@/lib/growth/sequence-intelligence/growth-sequence-history-builder"

const PROOF_STAGES: GrowthSequenceProofStage[] = [
  "industry_understanding",
  "operational_proof",
  "customer_example",
  "roi_proof",
  "implementation_proof",
]

const PROOF_PATTERNS: Record<GrowthSequenceProofStage, RegExp> = {
  industry_understanding: /\bindustry|sector|teams in this|operational context|understand/i,
  operational_proof: /\bworkflow|dispatch|pm|maintenance|operational|technician productivity/i,
  customer_example: /\bcustomer|client|case study|similar team|peer|reference/i,
  roi_proof: /\broi|savings|payback|cost reduction|labor savings|margin/i,
  implementation_proof: /\bimplement|rollout|onboard|deployment|adoption|go-live/i,
}

const TOUCH_PROOF_PROGRESSION: GrowthSequenceProofStage[] = [
  "industry_understanding",
  "operational_proof",
  "customer_example",
  "roi_proof",
  "implementation_proof",
]

function detectProofStages(haystack: string): GrowthSequenceProofStage[] {
  return PROOF_STAGES.filter((stage) => PROOF_PATTERNS[stage].test(haystack))
}

export function buildGrowthSequenceProofProgression(
  input: GrowthSequenceSignalInput,
): GrowthSequenceProofProgression {
  const haystack = buildSequenceHistoryHaystack(input)
  const usedProofStages = detectProofStages(haystack)
  const touchIndex = Math.max(input.priorTouchCount ?? 0, 1) - 1
  const recommendedProof =
    TOUCH_PROOF_PROGRESSION[Math.min(touchIndex, TOUCH_PROOF_PROGRESSION.length - 1)] ?? "industry_understanding"
  const avoidProofStages = usedProofStages.filter(
    (stage) => stage === recommendedProof || usedProofStages.filter((s) => s === stage).length >= 1,
  )

  return {
    usedProofStages,
    recommendedProof: usedProofStages.includes(recommendedProof)
      ? TOUCH_PROOF_PROGRESSION[Math.min(touchIndex + 1, TOUCH_PROOF_PROGRESSION.length - 1)] ?? recommendedProof
      : recommendedProof,
    avoidProofStages: [...new Set(avoidProofStages)],
  }
}

export function proofStageLabel(stage: GrowthSequenceProofStage): string {
  return stage.replace(/_/g, " ")
}
