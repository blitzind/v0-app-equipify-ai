import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listExperimentResultCounts } from "@/lib/growth/experiments/experiment-metrics"
import {
  buildExperimentResultRows,
  computeVariantRiskScore,
  evaluateExperimentWinnerRecommendation,
  summarizeExperimentLift,
} from "@/lib/growth/experiments/experiment-winner"
import { listSequenceExperiments } from "@/lib/growth/experiments/experiment-repository"
import {
  GROWTH_SEQUENCE_AB_TESTING_QA_MARKER,
  type GrowthSequenceExperimentDashboard,
  type GrowthSequenceExperimentEvent,
} from "@/lib/growth/experiments/experiment-types"

type Row = Record<string, unknown>

export async function fetchGrowthSequenceExperimentDashboard(
  admin: SupabaseClient,
): Promise<GrowthSequenceExperimentDashboard> {
  const experiments = await listSequenceExperiments(admin, { limit: 50 })
  const activeExperiments = experiments.filter((experiment) => experiment.status === "active").length

  const winnerRecommendations = []
  const riskyVariants: GrowthSequenceExperimentDashboard["riskyVariants"] = []
  const liftObserved: GrowthSequenceExperimentDashboard["liftObserved"] = []
  const aggregatedResults: GrowthSequenceExperimentDashboard["results"] = []

  for (const experiment of experiments) {
    const variants = experiment.variants ?? []
    const rawCounts = await listExperimentResultCounts(admin, experiment.id)
    const results = buildExperimentResultRows(variants, rawCounts)
    for (const row of results) {
      aggregatedResults.push({
        ...row,
        experimentId: experiment.id,
        experimentName: experiment.name,
      })
    }
    const recommendation = evaluateExperimentWinnerRecommendation({ experiment, variants, results })
    if (recommendation.recommendedVariantId) winnerRecommendations.push(recommendation)

    for (const row of results) {
      const riskScore = computeVariantRiskScore(row.metrics)
      if (riskScore >= 200) {
        riskyVariants.push({
          experimentId: experiment.id,
          experimentName: experiment.name,
          variantId: row.variantId,
          variantLabel: row.variantLabel,
          riskScore,
        })
      }
    }

    const control = results.find((row) => row.isControl)
    const challenger = results.find((row) => !row.isControl)
    const lift = summarizeExperimentLift(control, challenger)
    if (lift != null) {
      liftObserved.push({
        experimentId: experiment.id,
        experimentName: experiment.name,
        liftBasisPoints: lift,
        variantLabel: challenger?.variantLabel ?? "Variant",
      })
    }
  }

  const { data: eventsData, error } = await admin
    .schema("growth")
    .from("sequence_experiment_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30)
  if (error) throw new Error(error.message)

  const events: GrowthSequenceExperimentEvent[] = (eventsData ?? []).map((row) => {
    const record = row as Row
    return {
      id: String(record.id),
      experimentId: String(record.experiment_id),
      variantId: record.variant_id ? String(record.variant_id) : null,
      eventType: String(record.event_type),
      severity: record.severity as GrowthSequenceExperimentEvent["severity"],
      title: String(record.title),
      description: String(record.description),
      metadata: (record.metadata as Record<string, unknown>) ?? {},
      createdAt: String(record.created_at),
    }
  })

  return {
    qa_marker: GROWTH_SEQUENCE_AB_TESTING_QA_MARKER,
    activeExperiments,
    winnerRecommendations,
    riskyVariants: riskyVariants.sort((a, b) => b.riskScore - a.riskScore).slice(0, 10),
    liftObserved: liftObserved.sort((a, b) => (b.liftBasisPoints ?? 0) - (a.liftBasisPoints ?? 0)).slice(0, 10),
    experiments,
    results: aggregatedResults,
    events,
  }
}
