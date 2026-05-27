/**
 * Regression checks for Sequence A/B Testing + Experiment Intelligence (Phase 2L).
 * Run: pnpm test:growth-sequence-ab-testing
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  buildExperimentAssignmentHash,
  buildExperimentAssignmentSeed,
  pickExperimentVariantByWeight,
  pickExperimentVariantIndex,
} from "../lib/growth/experiments/experiment-assignment"
import {
  buildExperimentResultRows,
  computeVariantRiskScore,
  evaluateExperimentWinnerRecommendation,
  summarizeExperimentLift,
} from "../lib/growth/experiments/experiment-winner"
import {
  GROWTH_SEQUENCE_AB_TESTING_PRIVACY_NOTE,
  GROWTH_SEQUENCE_AB_TESTING_QA_MARKER,
  GROWTH_SEQUENCE_EXPERIMENT_METRICS,
  GROWTH_SEQUENCE_EXPERIMENT_STATUSES,
  GROWTH_SEQUENCE_EXPERIMENT_TYPES,
  experimentStatusLabel,
  experimentTypeLabel,
  maskExperimentLabel,
} from "../lib/growth/experiments/experiment-types"
import { GROWTH_SEQUENCE_AB_TESTING_SCHEMA_MIGRATION } from "../lib/growth/experiments/experiment-schema-health"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

async function main(): Promise<void> {
  assert.equal(GROWTH_SEQUENCE_AB_TESTING_QA_MARKER, "growth-sequence-ab-testing-v1")
  assert.match(GROWTH_SEQUENCE_AB_TESTING_PRIVACY_NOTE, /human start/i)
  assert.match(GROWTH_SEQUENCE_AB_TESTING_PRIVACY_NOTE, /no autonomous/i)
  assert.equal(GROWTH_SEQUENCE_EXPERIMENT_TYPES.length, 7)
  assert.equal(GROWTH_SEQUENCE_EXPERIMENT_STATUSES.length, 5)
  assert.equal(GROWTH_SEQUENCE_EXPERIMENT_METRICS.length, 9)

  const migration = readSource(`supabase/migrations/${GROWTH_SEQUENCE_AB_TESTING_SCHEMA_MIGRATION}`)
  assert.match(migration, /growth\.sequence_experiments/)
  assert.match(migration, /growth\.sequence_experiment_variants/)
  assert.match(migration, /growth\.sequence_experiment_assignments/)
  assert.match(migration, /growth\.sequence_experiment_results/)
  assert.match(migration, /growth\.sequence_experiment_events/)
  assert.match(migration, /experiment_winner_recommended/)
  assert.match(migration, /experiment_winner_promoted/)
  assert.match(migration, /assignment_hash/)
  assert.match(migration, /service role only/)

  assert.equal(experimentStatusLabel("paused"), "paused")
  assert.equal(experimentTypeLabel("provider_route"), "provider route")
  assert.equal(maskExperimentLabel("abc12345-0000-0000-0000-000000000001", "Subject Test"), "Subject Test")
  assert.match(maskExperimentLabel("abc12345-0000-0000-0000-000000000001"), /^Experiment abc12345/)

  const leadId = "11111111-1111-4111-8111-111111111111"
  const experimentId = "22222222-2222-4222-8222-222222222222"
  const seed = buildExperimentAssignmentSeed(leadId, experimentId)
  assert.equal(seed, `${experimentId}:${leadId}`)
  const hashA = buildExperimentAssignmentHash(leadId, experimentId)
  const hashB = buildExperimentAssignmentHash(leadId, experimentId)
  assert.equal(hashA, hashB)
  assert.notEqual(buildExperimentAssignmentHash(leadId, "33333333-3333-4333-8333-333333333333"), hashA)

  const variants = [
    { id: "control-id", weight: 1, status: "active" as const },
    { id: "variant-b-id", weight: 1, status: "active" as const },
  ]
  const picked = pickExperimentVariantByWeight(leadId, experimentId, variants)
  assert.ok(picked === "control-id" || picked === "variant-b-id")
  assert.equal(pickExperimentVariantIndex(leadId, experimentId, 2), pickExperimentVariantIndex(leadId, experimentId, 2))

  const resultRows = buildExperimentResultRows(
    [
      {
        id: "control-id",
        experimentId,
        label: "Control",
        isControl: true,
        payload: {},
        weight: 1,
        status: "active",
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "variant-b-id",
        experimentId,
        label: "Variant B",
        isControl: false,
        payload: { subject: "Test subject" },
        weight: 1,
        status: "active",
        createdAt: "",
        updatedAt: "",
      },
    ],
    [
      { variantId: "control-id", metric: "sent", count: 120 },
      { variantId: "control-id", metric: "opens", count: 30 },
      { variantId: "variant-b-id", metric: "sent", count: 120 },
      { variantId: "variant-b-id", metric: "opens", count: 45 },
      { variantId: "variant-b-id", metric: "complaints", count: 2 },
    ],
  )

  const control = resultRows.find((row) => row.isControl)
  const challenger = resultRows.find((row) => !row.isControl)
  assert.ok(control && challenger)
  assert.ok(summarizeExperimentLift(control, challenger)! > 0)
  assert.ok(computeVariantRiskScore(challenger!.metrics) > 0)

  const recommendation = evaluateExperimentWinnerRecommendation({
    experiment: {
      id: experimentId,
      minimumSampleSize: 100,
      confidenceThreshold: 0.95,
      controlVariantId: "control-id",
    },
    variants: [],
    results: resultRows,
  })
  assert.equal(recommendation.requiresHumanPromotion, true)
  assert.equal(recommendation.recommendedVariantId, "variant-b-id")
  assert.ok(recommendation.reasons.includes("positive_lift_observed"))

  const assignmentSource = readSource("lib/growth/experiments/experiment-assignment.ts")
  assert.match(assignmentSource, /hashVariationSeed/)
  assert.match(assignmentSource, /pickVariantIndex/)

  const repositorySource = readSource("lib/growth/experiments/experiment-repository.ts")
  assert.match(repositorySource, /resolveOrCreateExperimentAssignment/)
  assert.match(repositorySource, /applyExperimentVariantToSendPayload/)
  assert.match(repositorySource, /promoteSequenceExperimentWinner/)
  assert.match(repositorySource, /experiment_winner_recommended/)
  assert.doesNotMatch(repositorySource, /executeTransportSend|autoPromote/i)

  const promoteBlock = repositorySource.slice(
    repositorySource.indexOf("export async function promoteSequenceExperimentWinner"),
    repositorySource.indexOf("export async function resolveOrCreateExperimentAssignment"),
  )
  assert.doesNotMatch(promoteBlock, /executeTransportSend|updateSequenceStep|applyExperimentVariantToSendPayload/)
  assert.match(promoteBlock, /no autonomous rollout/i)

  const metricsSource = readSource("lib/growth/experiments/experiment-metrics.ts")
  assert.match(metricsSource, /recordExperimentMetricFromDeliveryAttempt/)
  assert.match(metricsSource, /recordExperimentEngagementForLead/)
  assert.match(metricsSource, /linkExperimentAssignmentDeliveryAttempt/)

  const sendBuilderSource = readSource("lib/growth/sequences/execution/sequence-send-builder.ts")
  assert.match(sendBuilderSource, /applyExperimentVariantToSendPayload/)

  const runnerSource = readSource("lib/growth/sequences/execution/sequence-job-runner.ts")
  assert.match(runnerSource, /experiment_id/)
  assert.match(runnerSource, /incrementExperimentMetric/)
  assert.match(runnerSource, /human_approved: true/)

  const transportSource = readSource("lib/growth/providers/transport/transport-orchestrator.ts")
  assert.match(transportSource, /extra_metadata|metadata/)

  const trackingSource = readSource("lib/growth/tracking/tracking-repository.ts")
  assert.match(trackingSource, /recordExperimentMetricFromDeliveryAttempt/)

  const complianceSource = readSource("lib/growth/compliance/compliance-repository.ts")
  assert.match(complianceSource, /recordExperimentMetricFromDeliveryAttempt/)
  assert.match(complianceSource, /recordPerformanceEngagementFromDeliveryAttempt/)

  const complianceRepo = fs.readFileSync(
    path.join(process.cwd(), "lib/growth/compliance/compliance-repository.ts"),
    "utf8",
  )
  assert.match(complianceRepo, /recordPerformanceEngagementFromDeliveryAttempt/)

  const suppressionSource = readSource("lib/growth/compliance/suppression-engine.ts")
  assert.match(suppressionSource, /recordExperimentMetricFromDeliveryAttempt/)
  assert.match(suppressionSource, /unsubscribes/)

  const threadSource = readSource("lib/growth/inbox/thread-repository.ts")
  assert.match(threadSource, /recordExperimentEngagementForLead/)

  for (const route of [
    "app/api/platform/growth/experiments/route.ts",
    "app/api/platform/growth/experiments/dashboard/route.ts",
    "app/api/platform/growth/experiments/[id]/route.ts",
    "app/api/platform/growth/experiments/[id]/start/route.ts",
    "app/api/platform/growth/experiments/[id]/pause/route.ts",
    "app/api/platform/growth/experiments/[id]/complete/route.ts",
    "app/api/platform/growth/experiments/[id]/promote-winner/route.ts",
  ]) {
    const source = readSource(route)
    assert.match(source, /requireGrowthEnginePlatformAccess/)
    assert.match(source, /isGrowthSequenceAbTestingSchemaReady/)
    assert.doesNotMatch(source, /api_key|secret|password/i)
  }

  const uiSource = readSource("components/growth/growth-sequence-experiments-dashboard.tsx")
  assert.match(uiSource, /GROWTH_SEQUENCE_AB_TESTING_QA_MARKER/)
  assert.match(uiSource, /Active Experiments/)
  assert.match(uiSource, /Winner Recommendations/)
  assert.match(uiSource, /Risky Variants/)
  assert.match(uiSource, /Lift Observed/)
  assert.match(uiSource, /Promote winner/)
  assert.match(uiSource, /Human promotion required/)

  const navSource = readSource("lib/growth/navigation/growth-navigation-destinations.ts")
  assert.match(navSource, /\/admin\/growth\/experiments/)

  console.log("growth-sequence-ab-testing-v1: all checks passed")
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
