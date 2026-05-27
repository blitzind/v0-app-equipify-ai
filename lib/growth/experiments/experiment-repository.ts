import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildExperimentAssignmentHash,
  pickExperimentVariantByWeight,
} from "@/lib/growth/experiments/experiment-assignment"
import {
  insertSequenceExperimentEvent,
  recordSequenceExperimentPlatformTimeline,
} from "@/lib/growth/experiments/experiment-events"
import { incrementExperimentMetric, listExperimentResultCounts } from "@/lib/growth/experiments/experiment-metrics"
import {
  buildExperimentResultRows,
  evaluateExperimentWinnerRecommendation,
} from "@/lib/growth/experiments/experiment-winner"
import type {
  GrowthSequenceExperiment,
  GrowthSequenceExperimentAssignment,
  GrowthSequenceExperimentType,
  GrowthSequenceExperimentVariant,
  GrowthSequenceExperimentVariantPayload,
} from "@/lib/growth/experiments/experiment-types"

type Row = Record<string, unknown>

function experimentsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sequence_experiments")
}

function variantsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sequence_experiment_variants")
}

function assignmentsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sequence_experiment_assignments")
}

function mapVariant(row: Row): GrowthSequenceExperimentVariant {
  return {
    id: String(row.id),
    experimentId: String(row.experiment_id),
    label: String(row.label),
    isControl: Boolean(row.is_control),
    payload: (row.payload as GrowthSequenceExperimentVariantPayload) ?? {},
    weight: Number(row.weight ?? 1),
    status: String(row.status) as GrowthSequenceExperimentVariant["status"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

function mapExperiment(row: Row, variants: GrowthSequenceExperimentVariant[] = []): GrowthSequenceExperiment {
  return {
    id: String(row.id),
    name: String(row.name),
    experimentType: String(row.experiment_type) as GrowthSequenceExperimentType,
    status: String(row.status) as GrowthSequenceExperiment["status"],
    sequenceId: row.sequence_id ? String(row.sequence_id) : null,
    sequenceStepId: row.sequence_step_id ? String(row.sequence_step_id) : null,
    controlVariantId: row.control_variant_id ? String(row.control_variant_id) : null,
    winningVariantId: row.winning_variant_id ? String(row.winning_variant_id) : null,
    minimumSampleSize: Number(row.minimum_sample_size ?? 100),
    confidenceThreshold: Number(row.confidence_threshold ?? 0.95),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    promotedAt: row.promoted_at ? String(row.promoted_at) : null,
    createdBy: row.created_by ? String(row.created_by) : null,
    promotedBy: row.promoted_by ? String(row.promoted_by) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    variants,
  }
}

async function loadVariants(admin: SupabaseClient, experimentId: string): Promise<GrowthSequenceExperimentVariant[]> {
  const { data, error } = await variantsTable(admin)
    .select("*")
    .eq("experiment_id", experimentId)
    .order("is_control", { ascending: false })
    .order("created_at", { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapVariant(row as Row))
}

export async function listSequenceExperiments(
  admin: SupabaseClient,
  input?: { status?: GrowthSequenceExperiment["status"]; limit?: number },
): Promise<GrowthSequenceExperiment[]> {
  let query = experimentsTable(admin).select("*").order("created_at", { ascending: false }).limit(input?.limit ?? 100)
  if (input?.status) query = query.eq("status", input.status)
  const { data, error } = await query
  if (error) throw new Error(error.message)

  return Promise.all(
    (data ?? []).map(async (row) => mapExperiment(row as Row, await loadVariants(admin, String((row as Row).id)))),
  )
}

export async function getSequenceExperiment(admin: SupabaseClient, experimentId: string): Promise<GrowthSequenceExperiment | null> {
  const { data, error } = await experimentsTable(admin).select("*").eq("id", experimentId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapExperiment(data as Row, await loadVariants(admin, experimentId))
}

export async function createSequenceExperiment(
  admin: SupabaseClient,
  input: {
    name: string
    experimentType: GrowthSequenceExperimentType
    sequenceId?: string | null
    sequenceStepId?: string | null
    minimumSampleSize?: number
    confidenceThreshold?: number
    createdBy?: string | null
    variants?: Array<{
      label: string
      isControl?: boolean
      payload?: GrowthSequenceExperimentVariantPayload
      weight?: number
    }>
  },
): Promise<GrowthSequenceExperiment> {
  const now = new Date().toISOString()
  const { data, error } = await experimentsTable(admin)
    .insert({
      name: input.name.trim().slice(0, 200),
      experiment_type: input.experimentType,
      status: "draft",
      sequence_id: input.sequenceId ?? null,
      sequence_step_id: input.sequenceStepId ?? null,
      minimum_sample_size: input.minimumSampleSize ?? 100,
      confidence_threshold: input.confidenceThreshold ?? 0.95,
      created_by: input.createdBy ?? null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  const experimentId = String((data as Row).id)
  const createdVariants: GrowthSequenceExperimentVariant[] = []
  for (const variant of input.variants ?? [{ label: "Control", isControl: true }, { label: "Variant B" }]) {
    const { data: variantRow, error: variantError } = await variantsTable(admin)
      .insert({
        experiment_id: experimentId,
        label: variant.label.slice(0, 120),
        is_control: variant.isControl ?? false,
        payload: variant.payload ?? {},
        weight: variant.weight ?? 1,
        status: "active",
        created_at: now,
        updated_at: now,
      })
      .select("*")
      .single()
    if (variantError) throw new Error(variantError.message)
    createdVariants.push(mapVariant(variantRow as Row))
  }

  const control = createdVariants.find((variant) => variant.isControl) ?? createdVariants[0]
  if (control) {
    await experimentsTable(admin).update({ control_variant_id: control.id, updated_at: now }).eq("id", experimentId)
  }

  await insertSequenceExperimentEvent(admin, {
    experimentId,
    eventType: "experiment_created",
    title: "Experiment created",
    description: `${input.name} created in draft status.`,
  })
  await recordSequenceExperimentPlatformTimeline(admin, {
    eventType: "experiment_created",
    title: "Sequence experiment created",
    summary: input.name,
    experimentId,
  })

  return (await getSequenceExperiment(admin, experimentId))!
}

export async function updateSequenceExperiment(
  admin: SupabaseClient,
  experimentId: string,
  patch: Partial<{
    name: string
    minimumSampleSize: number
    confidenceThreshold: number
    metadata: Record<string, unknown>
  }>,
): Promise<GrowthSequenceExperiment> {
  const existing = await getSequenceExperiment(admin, experimentId)
  if (!existing) throw new Error("experiment_not_found")
  if (!["draft", "paused"].includes(existing.status)) throw new Error("invalid_status")

  const { data, error } = await experimentsTable(admin)
    .update({
      name: patch.name?.trim().slice(0, 200) ?? existing.name,
      minimum_sample_size: patch.minimumSampleSize ?? existing.minimumSampleSize,
      confidence_threshold: patch.confidenceThreshold ?? existing.confidenceThreshold,
      metadata: patch.metadata ?? existing.metadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", experimentId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapExperiment(data as Row, existing.variants ?? [])
}

export async function startSequenceExperiment(
  admin: SupabaseClient,
  input: { experimentId: string; actorUserId: string },
): Promise<GrowthSequenceExperiment> {
  const existing = await getSequenceExperiment(admin, input.experimentId)
  if (!existing) throw new Error("experiment_not_found")
  if (existing.status !== "draft" && existing.status !== "paused") throw new Error("invalid_status")
  if ((existing.variants ?? []).filter((variant) => variant.status === "active").length < 2) {
    throw new Error("requires_two_variants")
  }

  const now = new Date().toISOString()
  const { data, error } = await experimentsTable(admin)
    .update({ status: "active", started_at: existing.startedAt ?? now, updated_at: now })
    .eq("id", input.experimentId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  await insertSequenceExperimentEvent(admin, {
    experimentId: input.experimentId,
    eventType: "experiment_started",
    title: "Experiment started",
    description: "Human started controlled experiment — assignments are deterministic.",
    metadata: { actor_user_id: input.actorUserId },
  })
  await recordSequenceExperimentPlatformTimeline(admin, {
    eventType: "experiment_started",
    title: "Sequence experiment started",
    summary: existing.name,
    experimentId: input.experimentId,
  })

  return mapExperiment(data as Row, existing.variants)
}

export async function pauseSequenceExperiment(admin: SupabaseClient, experimentId: string): Promise<GrowthSequenceExperiment> {
  const existing = await getSequenceExperiment(admin, experimentId)
  if (!existing) throw new Error("experiment_not_found")
  if (existing.status !== "active") throw new Error("invalid_status")

  const { data, error } = await experimentsTable(admin)
    .update({ status: "paused", updated_at: new Date().toISOString() })
    .eq("id", experimentId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  await insertSequenceExperimentEvent(admin, {
    experimentId,
    eventType: "experiment_paused",
    title: "Experiment paused",
  })

  return mapExperiment(data as Row, existing.variants)
}

export async function completeSequenceExperiment(admin: SupabaseClient, experimentId: string): Promise<GrowthSequenceExperiment> {
  const existing = await getSequenceExperiment(admin, experimentId)
  if (!existing) throw new Error("experiment_not_found")
  if (!["active", "paused"].includes(existing.status)) throw new Error("invalid_status")

  const now = new Date().toISOString()
  const { data, error } = await experimentsTable(admin)
    .update({ status: "completed", completed_at: now, updated_at: now })
    .eq("id", experimentId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  await insertSequenceExperimentEvent(admin, {
    experimentId,
    eventType: "experiment_completed",
    title: "Experiment completed",
    description: "Experiment marked complete — winner promotion still requires human action.",
  })

  const rawCounts = await listExperimentResultCounts(admin, experimentId)
  const results = buildExperimentResultRows(existing.variants ?? [], rawCounts)
  const recommendation = evaluateExperimentWinnerRecommendation({
    experiment: existing,
    variants: existing.variants ?? [],
    results,
  })
  if (recommendation.recommendedVariantId) {
    await insertSequenceExperimentEvent(admin, {
      experimentId,
      variantId: recommendation.recommendedVariantId,
      eventType: "experiment_winner_recommended",
      title: "Winner recommended",
      description: `${recommendation.recommendedVariantLabel ?? "Variant"} recommended — human promotion required.`,
      metadata: {
        confidence: recommendation.confidence,
        lift_basis_points: recommendation.liftBasisPoints,
        risk_penalty: recommendation.riskPenalty,
        reasons: recommendation.reasons,
      },
    })
    await recordSequenceExperimentPlatformTimeline(admin, {
      eventType: "experiment_winner_recommended",
      title: "Sequence experiment winner recommended",
      summary: recommendation.recommendedVariantLabel ?? undefined,
      experimentId,
      variantId: recommendation.recommendedVariantId,
      payload: {
        confidence: recommendation.confidence,
        lift_basis_points: recommendation.liftBasisPoints,
        requires_human_promotion: true,
      },
    })
  }

  return mapExperiment(data as Row, existing.variants)
}

export async function promoteSequenceExperimentWinner(
  admin: SupabaseClient,
  input: { experimentId: string; variantId: string; promotedBy: string },
): Promise<GrowthSequenceExperiment> {
  const existing = await getSequenceExperiment(admin, input.experimentId)
  if (!existing) throw new Error("experiment_not_found")
  const variant = (existing.variants ?? []).find((entry) => entry.id === input.variantId)
  if (!variant) throw new Error("variant_not_found")
  if (existing.status === "archived") throw new Error("invalid_status")

  const now = new Date().toISOString()
  const { data, error } = await experimentsTable(admin)
    .update({
      winning_variant_id: input.variantId,
      promoted_at: now,
      promoted_by: input.promotedBy,
      status: "completed",
      completed_at: existing.completedAt ?? now,
      updated_at: now,
      metadata: {
        ...existing.metadata,
        promoted_variant_label: variant.label,
      },
    })
    .eq("id", input.experimentId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  await insertSequenceExperimentEvent(admin, {
    experimentId: input.experimentId,
    variantId: input.variantId,
    eventType: "experiment_winner_promoted",
    title: "Winner promoted",
    description: `Human promoted ${variant.label} — no autonomous rollout performed.`,
    metadata: { promoted_by: input.promotedBy },
  })
  await recordSequenceExperimentPlatformTimeline(admin, {
    eventType: "experiment_winner_promoted",
    title: "Sequence experiment winner promoted",
    summary: variant.label,
    experimentId: input.experimentId,
    variantId: input.variantId,
  })

  return mapExperiment(data as Row, existing.variants)
}

export async function resolveOrCreateExperimentAssignment(
  admin: SupabaseClient,
  input: {
    experiment: GrowthSequenceExperiment
    leadId: string
    sequenceEnrollmentId?: string | null
  },
): Promise<GrowthSequenceExperimentAssignment | null> {
  if (input.experiment.status !== "active") return null
  const variants = input.experiment.variants ?? []
  const variantId = pickExperimentVariantByWeight(input.leadId, input.experiment.id, variants)
  if (!variantId) return null

  const assignmentHash = buildExperimentAssignmentHash(input.leadId, input.experiment.id)
  const { data: existing } = await assignmentsTable(admin)
    .select("*")
    .eq("experiment_id", input.experiment.id)
    .eq("lead_id", input.leadId)
    .maybeSingle()

  if (existing) {
    const row = existing as Row
    return {
      id: String(row.id),
      experimentId: String(row.experiment_id),
      variantId: String(row.variant_id),
      leadId: String(row.lead_id),
      sequenceEnrollmentId: row.sequence_enrollment_id ? String(row.sequence_enrollment_id) : null,
      assignmentHash: String(row.assignment_hash),
      deliveryAttemptId: row.delivery_attempt_id ? String(row.delivery_attempt_id) : null,
      assignedAt: String(row.assigned_at),
    }
  }

  const { data, error } = await assignmentsTable(admin)
    .insert({
      experiment_id: input.experiment.id,
      variant_id: variantId,
      lead_id: input.leadId,
      sequence_enrollment_id: input.sequenceEnrollmentId ?? null,
      assignment_hash: assignmentHash,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  await insertSequenceExperimentEvent(admin, {
    experimentId: input.experiment.id,
    variantId,
    eventType: "experiment_variant_assigned",
    title: "Variant assigned",
    description: "Deterministic assignment recorded for lead.",
    metadata: { assignment_hash: assignmentHash },
  })

  const row = data as Row
  return {
    id: String(row.id),
    experimentId: String(row.experiment_id),
    variantId: String(row.variant_id),
    leadId: String(row.lead_id),
    sequenceEnrollmentId: row.sequence_enrollment_id ? String(row.sequence_enrollment_id) : null,
    assignmentHash: String(row.assignment_hash),
    deliveryAttemptId: null,
    assignedAt: String(row.assigned_at),
  }
}

export async function findActiveExperimentsForSend(
  admin: SupabaseClient,
  input: { sequenceStepId?: string | null; experimentType?: GrowthSequenceExperimentType },
): Promise<GrowthSequenceExperiment[]> {
  let query = experimentsTable(admin).select("*").eq("status", "active")
  if (input.sequenceStepId) query = query.eq("sequence_step_id", input.sequenceStepId)
  if (input.experimentType) query = query.eq("experiment_type", input.experimentType)
  const { data, error } = await query.limit(5)
  if (error) throw new Error(error.message)

  return Promise.all(
    (data ?? []).map(async (row) => mapExperiment(row as Row, await loadVariants(admin, String((row as Row).id)))),
  )
}

export async function applyExperimentVariantToSendPayload(
  admin: SupabaseClient,
  input: {
    leadId: string
    sequenceEnrollmentId?: string | null
    sequenceStepId?: string | null
    subject: string
    body: string
    senderAccountId: string
    providerId: string | null
  },
): Promise<{
  subject: string
  body: string
  senderAccountId: string
  providerId: string | null
  experimentId: string | null
  variantId: string | null
  variantLabel: string | null
}> {
  const experiments = await findActiveExperimentsForSend(admin, { sequenceStepId: input.sequenceStepId })
  const experiment = experiments[0]
  if (!experiment) {
    return {
      subject: input.subject,
      body: input.body,
      senderAccountId: input.senderAccountId,
      providerId: input.providerId,
      experimentId: null,
      variantId: null,
      variantLabel: null,
    }
  }

  const assignment = await resolveOrCreateExperimentAssignment(admin, {
    experiment,
    leadId: input.leadId,
    sequenceEnrollmentId: input.sequenceEnrollmentId,
  })
  if (!assignment) {
    return {
      subject: input.subject,
      body: input.body,
      senderAccountId: input.senderAccountId,
      providerId: input.providerId,
      experimentId: null,
      variantId: null,
      variantLabel: null,
    }
  }

  const variant = (experiment.variants ?? []).find((entry) => entry.id === assignment.variantId)
  if (!variant || variant.status !== "active") {
    return {
      subject: input.subject,
      body: input.body,
      senderAccountId: input.senderAccountId,
      providerId: input.providerId,
      experimentId: experiment.id,
      variantId: assignment.variantId,
      variantLabel: variant?.label ?? null,
    }
  }

  const payload = variant.payload ?? {}
  let subject = input.subject
  let body = input.body
  let senderAccountId = input.senderAccountId
  let providerId = input.providerId

  if (experiment.experimentType === "subject" && payload.subject?.trim()) subject = payload.subject.trim()
  if (experiment.experimentType === "body" && payload.body?.trim()) body = payload.body.trim()
  if (experiment.experimentType === "sender" && payload.senderAccountId) senderAccountId = payload.senderAccountId
  if (experiment.experimentType === "provider_route" && payload.providerRouteId) providerId = payload.providerRouteId
  if (experiment.experimentType === "full_sequence") {
    if (payload.subject?.trim()) subject = payload.subject.trim()
    if (payload.body?.trim()) body = payload.body.trim()
    if (payload.senderAccountId) senderAccountId = payload.senderAccountId
    if (payload.providerRouteId) providerId = payload.providerRouteId
  }

  return {
    subject,
    body,
    senderAccountId,
    providerId,
    experimentId: experiment.id,
    variantId: variant.id,
    variantLabel: variant.label,
  }
}

export type GrowthSequenceExperimentJobAssignmentPreview = {
  experimentId: string | null
  experimentName: string | null
  variantId: string | null
  variantLabel: string | null
}

export async function resolveExperimentAssignmentPreview(
  admin: SupabaseClient,
  input: { leadId: string; sequenceStepId: string | null },
): Promise<GrowthSequenceExperimentJobAssignmentPreview> {
  const experiments = await findActiveExperimentsForSend(admin, { sequenceStepId: input.sequenceStepId })
  const experiment = experiments[0]
  if (!experiment) {
    return { experimentId: null, experimentName: null, variantId: null, variantLabel: null }
  }

  const { data: existing } = await assignmentsTable(admin)
    .select("*")
    .eq("experiment_id", experiment.id)
    .eq("lead_id", input.leadId)
    .maybeSingle()

  if (existing) {
    const row = existing as Row
    const variant = (experiment.variants ?? []).find((entry) => entry.id === String(row.variant_id))
    return {
      experimentId: experiment.id,
      experimentName: experiment.name,
      variantId: String(row.variant_id),
      variantLabel: variant?.label ?? null,
    }
  }

  const variantId = pickExperimentVariantByWeight(input.leadId, experiment.id, experiment.variants ?? [])
  const variant = (experiment.variants ?? []).find((entry) => entry.id === variantId)
  return {
    experimentId: experiment.id,
    experimentName: experiment.name,
    variantId: variantId ?? null,
    variantLabel: variant?.label ?? null,
  }
}

export async function resolveExperimentAssignmentPreviewsForJobs(
  admin: SupabaseClient,
  jobs: Array<{ leadId: string; sequenceStepId: string | null }>,
): Promise<GrowthSequenceExperimentJobAssignmentPreview[]> {
  return Promise.all(
    jobs.map((job) =>
      resolveExperimentAssignmentPreview(admin, {
        leadId: job.leadId,
        sequenceStepId: job.sequenceStepId,
      }),
    ),
  )
}
