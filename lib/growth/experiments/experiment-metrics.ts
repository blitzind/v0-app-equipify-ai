import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthSequenceExperimentMetric } from "@/lib/growth/experiments/experiment-types"
import { GROWTH_SEQUENCE_EXPERIMENT_METRICS } from "@/lib/growth/experiments/experiment-types"

type Row = Record<string, unknown>

function resultsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sequence_experiment_results")
}

function assignmentsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sequence_experiment_assignments")
}

export async function incrementExperimentMetric(
  admin: SupabaseClient,
  input: {
    experimentId: string
    variantId: string
    metric: GrowthSequenceExperimentMetric
    delta?: number
  },
): Promise<void> {
  const delta = input.delta ?? 1
  const now = new Date().toISOString()

  const { data: existing } = await resultsTable(admin)
    .select("id, count")
    .eq("experiment_id", input.experimentId)
    .eq("variant_id", input.variantId)
    .eq("metric", input.metric)
    .maybeSingle()

  if (existing) {
    const row = existing as Row
    const { error } = await resultsTable(admin)
      .update({ count: Number(row.count ?? 0) + delta, updated_at: now })
      .eq("id", String(row.id))
    if (error) throw new Error(error.message)
    return
  }

  const { error } = await resultsTable(admin).insert({
    experiment_id: input.experimentId,
    variant_id: input.variantId,
    metric: input.metric,
    count: delta,
    updated_at: now,
  })
  if (error) throw new Error(error.message)
}

export async function recordExperimentMetricFromDeliveryAttempt(
  admin: SupabaseClient,
  input: { deliveryAttemptId: string; metric: GrowthSequenceExperimentMetric; delta?: number },
): Promise<void> {
  const { data, error } = await admin
    .schema("growth")
    .from("delivery_attempts")
    .select("metadata")
    .eq("id", input.deliveryAttemptId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return

  const metadata = (data as Row).metadata as Row | null
  const experimentId = metadata?.experiment_id ? String(metadata.experiment_id) : null
  const variantId = metadata?.experiment_variant_id ? String(metadata.experiment_variant_id) : null
  if (!experimentId || !variantId) return

  await incrementExperimentMetric(admin, {
    experimentId,
    variantId,
    metric: input.metric,
    delta: input.delta,
  })
}

export async function linkExperimentAssignmentDeliveryAttempt(
  admin: SupabaseClient,
  input: { experimentId: string; leadId: string; deliveryAttemptId: string },
): Promise<void> {
  const { error } = await assignmentsTable(admin)
    .update({ delivery_attempt_id: input.deliveryAttemptId })
    .eq("experiment_id", input.experimentId)
    .eq("lead_id", input.leadId)
  if (error) throw new Error(error.message)
}

export async function listExperimentResultCounts(
  admin: SupabaseClient,
  experimentId: string,
): Promise<Array<{ variantId: string; metric: string; count: number }>> {
  const { data, error } = await resultsTable(admin).select("variant_id, metric, count").eq("experiment_id", experimentId)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => {
    const record = row as Row
    return {
      variantId: String(record.variant_id),
      metric: String(record.metric),
      count: Number(record.count ?? 0),
    }
  })
}

export function isExperimentMetricName(value: string): value is GrowthSequenceExperimentMetric {
  return GROWTH_SEQUENCE_EXPERIMENT_METRICS.includes(value as GrowthSequenceExperimentMetric)
}

export async function recordExperimentEngagementForLead(
  admin: SupabaseClient,
  input: { leadId: string; metric: GrowthSequenceExperimentMetric; delta?: number },
): Promise<void> {
  const { data, error } = await admin
    .schema("growth")
    .from("delivery_attempts")
    .select("id, metadata")
    .eq("lead_id", input.leadId)
    .eq("status", "sent")
    .order("sent_at", { ascending: false })
    .limit(20)
  if (error) throw new Error(error.message)

  for (const row of data ?? []) {
    const record = row as Row
    const metadata = record.metadata as Row | null
    const experimentId = metadata?.experiment_id ? String(metadata.experiment_id) : null
    const variantId = metadata?.experiment_variant_id ? String(metadata.experiment_variant_id) : null
    if (!experimentId || !variantId) continue

    await incrementExperimentMetric(admin, {
      experimentId,
      variantId,
      metric: input.metric,
      delta: input.delta,
    })
    return
  }
}
