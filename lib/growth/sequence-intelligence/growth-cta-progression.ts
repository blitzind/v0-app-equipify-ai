/** GS-AI-PLAYBOOK-4C — CTA stage progression (client-safe). */

import type {
  GrowthSequenceCtaProgression,
  GrowthSequenceCtaStage,
  GrowthSequenceSignalInput,
} from "@/lib/growth/sequence-intelligence/growth-sequence-state-types"
import { buildSequenceHistoryHaystack } from "@/lib/growth/sequence-intelligence/growth-sequence-history-builder"

const CTA_STAGES: GrowthSequenceCtaStage[] = [
  "question",
  "workflow_review",
  "case_study",
  "meeting",
  "implementation_discussion",
]

const CTA_PATTERNS: Record<GrowthSequenceCtaStage, RegExp> = {
  question: /\bquestion|curious|wondering|quick check|does this|how are you/i,
  workflow_review: /\bworkflow review|walkthrough|review your|process review|ops review/i,
  case_study: /\bcase study|share an example|similar team|customer story|proof/i,
  meeting: /\bbook|schedule|meeting|demo|call|calendar|15 min|30 min/i,
  implementation_discussion: /\bimplement|rollout|onboard|deployment|next steps|plan/i,
}

const CTA_LABELS: Record<GrowthSequenceCtaStage, string> = {
  question: "Ask a discovery question",
  workflow_review: "Offer workflow review",
  case_study: "Share case study",
  meeting: "Book a meeting",
  implementation_discussion: "Discuss implementation",
}

const TOUCH_CTA_PROGRESSION: GrowthSequenceCtaStage[] = [
  "question",
  "workflow_review",
  "case_study",
  "meeting",
  "implementation_discussion",
]

const GENERIC_AVOID_CTAS = ["Book a demo", "Schedule a demo", "Quick demo"]

function detectCtaStages(haystack: string): GrowthSequenceCtaStage[] {
  return CTA_STAGES.filter((stage) => CTA_PATTERNS[stage].test(haystack))
}

export function buildGrowthSequenceCtaProgression(input: GrowthSequenceSignalInput): GrowthSequenceCtaProgression {
  const haystack = buildSequenceHistoryHaystack(input)
  const usedCtaStages = detectCtaStages(haystack)
  const touchIndex = Math.max(input.priorTouchCount ?? 0, 1) - 1
  let currentCtaStage =
    TOUCH_CTA_PROGRESSION[Math.min(touchIndex, TOUCH_CTA_PROGRESSION.length - 1)] ?? "question"

  if (usedCtaStages.includes(currentCtaStage)) {
    currentCtaStage =
      TOUCH_CTA_PROGRESSION[Math.min(touchIndex + 1, TOUCH_CTA_PROGRESSION.length - 1)] ?? currentCtaStage
  }

  const avoidCtas = [
    ...GENERIC_AVOID_CTAS.filter(() => (input.priorTouchCount ?? 0) < 3),
    ...usedCtaStages.map((stage) => CTA_LABELS[stage]),
    ...(input.priorTouchCount ?? 0) >= 2 && usedCtaStages.includes("meeting") ? ["Book a demo"] : [],
  ].filter((entry, idx, arr) => arr.indexOf(entry) === idx)

  return {
    usedCtaStages,
    currentCtaStage,
    recommendedCta: CTA_LABELS[currentCtaStage],
    avoidCtas,
  }
}

export function ctaStageLabel(stage: GrowthSequenceCtaStage): string {
  return CTA_LABELS[stage]
}
