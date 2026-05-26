import type {
  GrowthBuyingStage,
  GrowthBuyingStageAssessmentCandidate,
  GrowthBuyingStageAttribution,
  GrowthBuyingStageResult,
  GrowthBuyingStageSignal,
} from "@/lib/growth/buying-stage/buying-stage-types"
import { GROWTH_BUYING_STAGE_QA_MARKER, GROWTH_BUYING_STAGES } from "@/lib/growth/buying-stage/buying-stage-types"
import { collectBuyingStageSignals } from "@/lib/growth/buying-stage/buying-stage-signals"
import type { GrowthBuyingStageInput } from "@/lib/growth/buying-stage/buying-stage-types"

const STAGE_ORDER: GrowthBuyingStage[] = [...GROWTH_BUYING_STAGES]

function initStageScores(): Record<GrowthBuyingStage, number> {
  return Object.fromEntries(STAGE_ORDER.map((s) => [s, 0])) as Record<GrowthBuyingStage, number>
}

function mergeAttribution(
  signals: GrowthBuyingStageSignal[],
): GrowthBuyingStageAttribution[] {
  const seen = new Set<string>()
  const out: GrowthBuyingStageAttribution[] = []
  for (const signal of signals) {
    for (const attr of signal.source_attribution) {
      const key = `${attr.source}|${attr.signal}|${attr.evidence}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(attr)
    }
  }
  return out.slice(0, 12)
}

function normalizeStageConfidence(
  raw: number,
  signals: GrowthBuyingStageSignal[],
): number {
  let confidence = Math.max(0, Math.min(1, raw))

  const highQuality = signals.some(
    (s) =>
      s.source_attribution.some((a) => a.confidence >= 0.8) &&
      ["high_intent_actions", "existing_account_relationship", "search_intent"].includes(s.signal_type),
  )
  const weakOnly =
    signals.length > 0 &&
    signals.every((s) =>
      ["intent_score", "content_patterns", "return_frequency"].includes(s.signal_type),
    )

  if (signals.length < 2) confidence = Math.min(confidence, 0.35)
  else if (!highQuality) confidence = Math.min(confidence, 0.5)
  if (weakOnly) confidence = Math.min(confidence, 0.45)

  return Number(Math.min(0.92, confidence).toFixed(3))
}

export function scoreBuyingStagesFromSignals(
  signals: GrowthBuyingStageSignal[],
): { scores: Record<GrowthBuyingStage, number>; reasoning: string[] } {
  const scores = initStageScores()
  const reasoning: string[] = []

  for (const signal of signals) {
    for (const [stage, points] of Object.entries(signal.stage_hints) as [GrowthBuyingStage, number][]) {
      if (!points) continue
      scores[stage] += points
    }
    reasoning.push(`${signal.label} (+${signal.weight} weight).`)
  }

  if (signals.length === 0) {
    scores.awareness += 5
    reasoning.push("No observable buying signals — default awareness candidate.")
  }

  return { scores, reasoning }
}

export function pickDetectedBuyingStage(
  scores: Record<GrowthBuyingStage, number>,
): GrowthBuyingStage {
  let top: GrowthBuyingStage = "awareness"
  let topScore = scores.awareness

  for (const stage of STAGE_ORDER) {
    const value = scores[stage]
    if (value > topScore) {
      top = stage
      topScore = value
    } else if (value === topScore && value > 0) {
      const topIdx = STAGE_ORDER.indexOf(top)
      const stageIdx = STAGE_ORDER.indexOf(stage)
      if (stageIdx > topIdx) top = stage
    }
  }

  return top
}

export function assessBuyingStageFromSignals(
  signals: GrowthBuyingStageSignal[],
): GrowthBuyingStageAssessmentCandidate | null {
  if (signals.length === 0) return null

  const { scores, reasoning } = scoreBuyingStagesFromSignals(signals)
  const detected_stage = pickDetectedBuyingStage(scores)
  const stage_score = Math.max(0, Math.min(100, scores[detected_stage] * 3))
  const maxPossible = Math.max(...Object.values(scores), 1)
  const rawConfidence = scores[detected_stage] / maxPossible
  const stage_confidence = normalizeStageConfidence(rawConfidence * 0.55 + signals.length * 0.04, signals)

  const evidence = signals
    .slice(0, 5)
    .map((s) => s.evidence)
    .join(" ")

  const stage_reasoning = [
    `Candidate buying stage: ${detected_stage.replace(/_/g, " ")} — not guaranteed truth.`,
    `Stage score ${stage_score} from ${signals.length} observable signal(s).`,
    ...reasoning.slice(0, 6),
  ]

  return {
    detected_stage,
    stage_confidence,
    stage_score,
    stage_reasoning,
    evidence,
    source_attribution: mergeAttribution(signals),
    signal_summary: signals,
    metadata: {
      stage_scores: scores,
      is_candidate_assessment: true,
      disclaimer: "Probable buying stage from observable behavior only — human review required.",
    },
  }
}

export function assessBuyingStage(input: GrowthBuyingStageInput): GrowthBuyingStageResult {
  const signals = collectBuyingStageSignals(input)
  const assessment = assessBuyingStageFromSignals(signals)

  return {
    qa_marker: GROWTH_BUYING_STAGE_QA_MARKER,
    assessment,
    is_candidate_assessment: assessment != null,
    summary: assessment
      ? {
          detected_stage: assessment.detected_stage,
          stage_confidence: assessment.stage_confidence,
          stage_score: assessment.stage_score,
          signal_count: signals.length,
        }
      : null,
  }
}
