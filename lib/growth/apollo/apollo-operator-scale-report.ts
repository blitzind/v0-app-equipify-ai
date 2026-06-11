/** Full Apollo operator scale report assembler — client-safe. */

import { buildApolloOperatorApprovalQualityReport } from "@/lib/growth/apollo/apollo-operator-approval-quality"
import { buildApolloOperatorApprovalSimulationReport } from "@/lib/growth/apollo/apollo-operator-approval-simulation"
import {
  detectApolloOperatorBottlenecks,
  resolveApolloOperatorPrimaryBottleneck,
} from "@/lib/growth/apollo/apollo-operator-bottleneck-detector"
import { buildApolloOperatorConfidenceCalibrationReport } from "@/lib/growth/apollo/apollo-operator-confidence-calibration"
import { buildApolloDraftRegenerationAnalytics } from "@/lib/growth/apollo/apollo-operator-regeneration-analytics"
import { buildApolloOperationalReadinessScore } from "@/lib/growth/apollo/apollo-operator-readiness-score"
import {
  buildApolloOperatorScaleForecast,
  estimateApolloOperatorCapacityAtCompanies,
  estimateApolloOperatorCapacityItemsPerDay,
} from "@/lib/growth/apollo/apollo-operator-scale-forecast"
import {
  APOLLO_OPERATOR_SCALE_QA_MARKER,
  type ApolloOperatorQueueItem,
  type ApolloOperatorScaleReport,
} from "@/lib/growth/apollo/apollo-operator-scale-types"
import { buildApolloOperatorThroughputReport } from "@/lib/growth/apollo/apollo-operator-throughput-calculator"

function buildRecommendations(input: {
  readiness_score: number
  primary_bottleneck: string | null
  avg_regenerate_pct: number
  simulations: { threshold: number; estimated_error_rate_pct: number; approvals_avoided: number }[]
}): string[] {
  const recommendations: string[] = []

  if (input.primary_bottleneck) {
    recommendations.push(
      `Prioritize ${input.primary_bottleneck} queue — highest backlog and aging.`,
    )
  }
  if (input.avg_regenerate_pct > 15) {
    recommendations.push(
      "Regeneration rate exceeds 15% — tighten content quality gates before reducing touch.",
    )
  }
  const sim95 = input.simulations.find((s) => s.threshold === 95)
  if (sim95 && sim95.estimated_error_rate_pct <= 5 && sim95.approvals_avoided > 0) {
    recommendations.push(
      "Simulation at 95+ confidence shows low error rate — candidate for future low-touch pilot (simulation only).",
    )
  } else {
    recommendations.push(
      "Keep human approval on all stages — simulation error rate too high for low-touch expansion.",
    )
  }
  if (input.readiness_score < 60) {
    recommendations.push("Operational readiness below production threshold — run 25-company pilot before scale.")
  } else if (input.readiness_score >= 80) {
    recommendations.push("Scale-ready operations — forecast operator hours before 100+ company waves.")
  }

  return recommendations
}

export function buildApolloOperatorScaleReport(
  items: ApolloOperatorQueueItem[],
  input?: {
    computed_at?: string
    meeting_conversion_pct?: number | null
    baseline_companies?: number
  },
): ApolloOperatorScaleReport {
  const computed_at = input?.computed_at ?? new Date().toISOString()
  const throughput = buildApolloOperatorThroughputReport(items, computed_at)
  const approval_quality = buildApolloOperatorApprovalQualityReport(items)
  const confidence_calibration = buildApolloOperatorConfidenceCalibrationReport(items)
  const bottlenecks = detectApolloOperatorBottlenecks(items, { now: computed_at })
  const regeneration = buildApolloDraftRegenerationAnalytics(items)
  const simulations = buildApolloOperatorApprovalSimulationReport(items)
  const readiness = buildApolloOperationalReadinessScore({
    throughput,
    approval_quality,
    bottlenecks,
    meeting_conversion_pct: input?.meeting_conversion_pct,
  })
  const forecasts = buildApolloOperatorScaleForecast({
    throughput,
    bottlenecks,
    baseline_companies: input?.baseline_companies,
  })

  const currentCapacity = estimateApolloOperatorCapacityItemsPerDay(throughput)
  const itemsPerCompany =
    (input?.baseline_companies ?? 1) > 0
      ? throughput.reduce((s, r) => s + r.items_created_per_day, 0) / (input?.baseline_companies ?? 1)
      : 0

  const primaryBottleneck = resolveApolloOperatorPrimaryBottleneck(bottlenecks)
  const avgRegenerate =
    approval_quality.length > 0
      ? approval_quality.reduce((s, r) => s + r.regenerate_pct, 0) / approval_quality.length
      : 0

  const recommendations = buildRecommendations({
    readiness_score: readiness.score,
    primary_bottleneck: primaryBottleneck,
    avg_regenerate_pct: avgRegenerate,
    simulations,
  })

  let recommended_next_phase = "Continue 25-company pilot with full human approval gates."
  if (readiness.score >= 80) {
    recommended_next_phase =
      "Phase 14 — Low-touch pilot for highest-confidence enrollment/playbook paths (simulation-gated)."
  } else if (readiness.score >= 60) {
    recommended_next_phase =
      "Phase 13 follow-up — Reduce regeneration drivers and queue aging before low-touch experiments."
  }

  return {
    qa_marker: APOLLO_OPERATOR_SCALE_QA_MARKER,
    computed_at,
    throughput,
    approval_quality,
    confidence_calibration,
    bottlenecks,
    regeneration,
    simulations,
    readiness,
    forecasts,
    recommendations,
    verdict: {
      current_operator_capacity_items_per_day: currentCapacity,
      capacity_at_25_companies: estimateApolloOperatorCapacityAtCompanies(itemsPerCompany, 25),
      capacity_at_50_companies: estimateApolloOperatorCapacityAtCompanies(itemsPerCompany, 50),
      capacity_at_100_companies: estimateApolloOperatorCapacityAtCompanies(itemsPerCompany, 100),
      biggest_scaling_bottleneck: primaryBottleneck,
      recommended_next_phase,
    },
  }
}
