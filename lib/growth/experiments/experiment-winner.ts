import {
  computeExperimentLiftBasisPoints,
} from "@/lib/blitzpay/blitzpay-optimization-experiments"
import type {
  GrowthSequenceExperiment,
  GrowthSequenceExperimentMetric,
  GrowthSequenceExperimentResultRow,
  GrowthSequenceExperimentVariant,
  GrowthSequenceExperimentWinnerRecommendation,
} from "@/lib/growth/experiments/experiment-types"
import { GROWTH_SEQUENCE_EXPERIMENT_METRICS } from "@/lib/growth/experiments/experiment-types"

const DEFAULT_MIN_SAMPLE = 100
const DEFAULT_CONFIDENCE = 0.95

function metricRate(metrics: Record<GrowthSequenceExperimentMetric, number>, numerator: GrowthSequenceExperimentMetric, denominator: GrowthSequenceExperimentMetric): number {
  const sent = metrics[denominator] ?? 0
  if (sent <= 0) return 0
  return (metrics[numerator] ?? 0) / sent
}

function computePositiveScore(metrics: Record<GrowthSequenceExperimentMetric, number>): number {
  return (
    metricRate(metrics, "opens", "sent") * 0.25 +
    metricRate(metrics, "clicks", "sent") * 0.2 +
    metricRate(metrics, "replies", "sent") * 0.25 +
    metricRate(metrics, "positive_replies", "sent") * 0.2 +
    metricRate(metrics, "meetings", "sent") * 0.1
  )
}

function computeRiskPenalty(metrics: Record<GrowthSequenceExperimentMetric, number>): number {
  return (
    metricRate(metrics, "bounces", "sent") * 0.4 +
    metricRate(metrics, "unsubscribes", "sent") * 0.35 +
    metricRate(metrics, "complaints", "sent") * 0.25
  )
}

export function buildExperimentResultRows(
  variants: GrowthSequenceExperimentVariant[],
  rawCounts: Array<{ variantId: string; metric: string; count: number }>,
): GrowthSequenceExperimentResultRow[] {
  return variants.map((variant) => {
    const metrics = Object.fromEntries(
      GROWTH_SEQUENCE_EXPERIMENT_METRICS.map((metric) => [metric, 0]),
    ) as Record<GrowthSequenceExperimentMetric, number>

    for (const row of rawCounts.filter((entry) => entry.variantId === variant.id)) {
      if (GROWTH_SEQUENCE_EXPERIMENT_METRICS.includes(row.metric as GrowthSequenceExperimentMetric)) {
        metrics[row.metric as GrowthSequenceExperimentMetric] = row.count
      }
    }

    return {
      variantId: variant.id,
      variantLabel: variant.label,
      isControl: variant.isControl,
      metrics,
    }
  })
}

export function evaluateExperimentWinnerRecommendation(input: {
  experiment: Pick<
    GrowthSequenceExperiment,
    "id" | "minimumSampleSize" | "confidenceThreshold" | "controlVariantId"
  >
  variants: GrowthSequenceExperimentVariant[]
  results: GrowthSequenceExperimentResultRow[]
}): GrowthSequenceExperimentWinnerRecommendation {
  const minSample = input.experiment.minimumSampleSize || DEFAULT_MIN_SAMPLE
  const confidenceThreshold = input.experiment.confidenceThreshold || DEFAULT_CONFIDENCE

  const control =
    input.results.find((row) => row.variantId === input.experiment.controlVariantId) ??
    input.results.find((row) => row.isControl) ??
    input.results[0]

  if (!control) {
    return {
      experimentId: input.experiment.id,
      recommendedVariantId: null,
      recommendedVariantLabel: null,
      confidence: 0,
      liftBasisPoints: null,
      riskPenalty: 0,
      sampleSize: 0,
      meetsMinimumSample: false,
      meetsConfidenceThreshold: false,
      reasons: ["no_control_variant"],
      requiresHumanPromotion: true,
    }
  }

  const controlSent = control.metrics.sent ?? 0
  const controlScore = computePositiveScore(control.metrics) - computeRiskPenalty(control.metrics)

  let best: GrowthSequenceExperimentResultRow | null = null
  let bestScore = -Infinity
  let bestLift: number | null = null
  let bestRisk = 0

  for (const row of input.results) {
    if (row.variantId === control.variantId) continue
    const sent = row.metrics.sent ?? 0
    if (sent < minSample) continue
    const score = computePositiveScore(row.metrics) - computeRiskPenalty(row.metrics)
    const lift = computeExperimentLiftBasisPoints({
      baselineValue: Math.round(controlScore * 10_000),
      observedValue: Math.round(score * 10_000),
    })
    if (score > bestScore) {
      best = row
      bestScore = score
      bestLift = lift
      bestRisk = computeRiskPenalty(row.metrics)
    }
  }

  const sampleSize = best?.metrics.sent ?? 0
  const meetsMinimumSample = sampleSize >= minSample && controlSent >= minSample
  const confidence = meetsMinimumSample ? Math.min(0.99, confidenceThreshold + (bestLift ?? 0) / 20_000) : 0
  const meetsConfidenceThreshold = confidence >= confidenceThreshold

  const reasons: string[] = []
  if (!meetsMinimumSample) reasons.push("minimum_sample_not_met")
  if (bestLift != null && bestLift > 0) reasons.push("positive_lift_observed")
  if (bestRisk > 0.02) reasons.push("risk_penalty_applied")
  if (meetsConfidenceThreshold) reasons.push("confidence_threshold_met")

  return {
    experimentId: input.experiment.id,
    recommendedVariantId: best?.variantId ?? null,
    recommendedVariantLabel: best?.variantLabel ?? null,
    confidence,
    liftBasisPoints: bestLift,
    riskPenalty: bestRisk,
    sampleSize,
    meetsMinimumSample,
    meetsConfidenceThreshold,
    reasons,
    requiresHumanPromotion: true,
  }
}

export function computeVariantRiskScore(metrics: Record<GrowthSequenceExperimentMetric, number>): number {
  return Math.round(computeRiskPenalty(metrics) * 10_000)
}

export function summarizeExperimentLift(
  control: GrowthSequenceExperimentResultRow | undefined,
  challenger: GrowthSequenceExperimentResultRow | undefined,
): number | null {
  if (!control || !challenger) return null
  const controlScore = computePositiveScore(control.metrics)
  const challengerScore = computePositiveScore(challenger.metrics)
  return computeExperimentLiftBasisPoints({
    baselineValue: Math.round(controlScore * 10_000),
    observedValue: Math.round(challengerScore * 10_000),
  })
}
