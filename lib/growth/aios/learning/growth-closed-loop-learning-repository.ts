/** GE-AI-3D-PROD-1 — Closed-loop learning repository (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_CLOSED_LOOP_LEARNING_PERSISTENCE_QA_MARKER,
  GROWTH_LEARNING_INSIGHT_STATUSES,
  GROWTH_LEARNING_INSIGHT_TYPES,
  GROWTH_LEARNING_OUTCOME_SOURCES,
  GROWTH_LEARNING_OUTCOME_TYPES,
  GROWTH_LEARNING_RECOMMENDED_ADJUSTMENTS,
  GROWTH_LEARNING_SUBJECT_TYPES,
  GROWTH_LEARNING_TARGET_SYSTEMS,
  type GrowthLearningInsight,
  type GrowthLearningInsightStatus,
  type GrowthLearningInsightType,
  type GrowthLearningOutcome,
  type GrowthLearningRecommendedAdjustment,
  type GrowthLearningTargetSystem,
} from "@/lib/growth/aios/learning/growth-closed-loop-learning-types"

type OutcomeRow = {
  id: string
  organization_id: string
  source: string
  outcome_type: string
  subject_type: string
  subject_id: string
  related: Record<string, unknown> | null
  signal_strength: number
  confidence: number
  dimensions: Record<string, unknown> | null
  evidence: unknown
  occurred_at: string
  idempotency_key: string
  created_at: string
}

type InsightRow = {
  id: string
  organization_id: string
  insight_type: string
  title: string
  summary: string
  recommended_adjustment: string
  target_system: string
  confidence: number
  impact: number
  sample_size: number
  evidence: unknown
  status: string
  generated_from_window: string
  idempotency_key: string
  created_at: string
  superseded_at: string | null
}

const OUTCOME_SELECT =
  "id, organization_id, source, outcome_type, subject_type, subject_id, related, signal_strength, confidence, dimensions, evidence, occurred_at, idempotency_key, created_at"

const INSIGHT_SELECT =
  "id, organization_id, insight_type, title, summary, recommended_adjustment, target_system, confidence, impact, sample_size, evidence, status, generated_from_window, idempotency_key, created_at, superseded_at"

function outcomesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("closed_loop_learning_outcomes")
}

function insightsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("closed_loop_learning_insights")
}

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("closed_loop_learning_events")
}

function isOutcomeSource(value: string): value is GrowthLearningOutcome["source"] {
  return (GROWTH_LEARNING_OUTCOME_SOURCES as readonly string[]).includes(value)
}

function isOutcomeType(value: string): value is GrowthLearningOutcome["outcomeType"] {
  return (GROWTH_LEARNING_OUTCOME_TYPES as readonly string[]).includes(value)
}

function isSubjectType(value: string): value is GrowthLearningOutcome["subject"]["type"] {
  return (GROWTH_LEARNING_SUBJECT_TYPES as readonly string[]).includes(value)
}

function isInsightType(value: string): value is GrowthLearningInsightType {
  return (GROWTH_LEARNING_INSIGHT_TYPES as readonly string[]).includes(value)
}

function isInsightStatus(value: string): value is GrowthLearningInsightStatus {
  return (GROWTH_LEARNING_INSIGHT_STATUSES as readonly string[]).includes(value)
}

function isRecommendedAdjustment(value: string): value is GrowthLearningRecommendedAdjustment {
  return (GROWTH_LEARNING_RECOMMENDED_ADJUSTMENTS as readonly string[]).includes(value)
}

function isTargetSystem(value: string): value is GrowthLearningTargetSystem {
  return (GROWTH_LEARNING_TARGET_SYSTEMS as readonly string[]).includes(value)
}

export function mapClosedLoopLearningOutcomeRow(row: OutcomeRow): GrowthLearningOutcome {
  const related = (row.related ?? {}) as GrowthLearningOutcome["related"]
  const dimensions = (row.dimensions ?? {}) as GrowthLearningOutcome["dimensions"]
  const evidence = Array.isArray(row.evidence)
    ? (row.evidence as GrowthLearningOutcome["evidence"])
    : []

  return {
    id: row.id,
    organizationId: row.organization_id,
    source: isOutcomeSource(row.source) ? row.source : "workflow_agent",
    outcomeType: isOutcomeType(row.outcome_type) ? row.outcome_type : "completed",
    subject: {
      type: isSubjectType(row.subject_type) ? row.subject_type : "lead",
      id: row.subject_id,
    },
    related,
    signalStrength: Number(row.signal_strength),
    confidence: Number(row.confidence),
    dimensions,
    evidence,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  }
}

export function mapClosedLoopLearningInsightRow(row: InsightRow): GrowthLearningInsight {
  const evidence = Array.isArray(row.evidence)
    ? (row.evidence as GrowthLearningOutcome[])
    : []

  return {
    id: row.id,
    organizationId: row.organization_id,
    insightType: isInsightType(row.insight_type) ? row.insight_type : "channel_performance",
    title: row.title,
    summary: row.summary,
    recommendedAdjustment: isRecommendedAdjustment(row.recommended_adjustment)
      ? row.recommended_adjustment
      : "monitor",
    targetSystem: isTargetSystem(row.target_system) ? row.target_system : "communication_engine",
    confidence: Number(row.confidence),
    impact: Number(row.impact),
    sampleSize: row.sample_size,
    evidence,
    status: isInsightStatus(row.status) ? row.status : "not_enough_data",
    createdAt: row.created_at,
  }
}

export function closedLoopLearningSchemaCatalog() {
  return {
    migration: "20271001230000_growth_ai_3d_prod_1_closed_loop_learning_store.sql",
    tables: [
      "closed_loop_learning_outcomes",
      "closed_loop_learning_insights",
      "closed_loop_learning_events",
    ] as const,
  }
}

export async function fetchClosedLoopLearningOutcomeByIdempotencyKey(
  admin: SupabaseClient,
  input: { organizationId: string; idempotencyKey: string },
): Promise<GrowthLearningOutcome | null> {
  const { data, error } = await outcomesTable(admin)
    .select(OUTCOME_SELECT)
    .eq("organization_id", input.organizationId)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapClosedLoopLearningOutcomeRow(data as OutcomeRow) : null
}

export async function upsertClosedLoopLearningOutcome(
  admin: SupabaseClient,
  input: {
    organizationId: string
    idempotencyKey: string
    outcome: GrowthLearningOutcome
  },
): Promise<{ outcome: GrowthLearningOutcome; inserted: boolean }> {
  const existing = await fetchClosedLoopLearningOutcomeByIdempotencyKey(admin, {
    organizationId: input.organizationId,
    idempotencyKey: input.idempotencyKey,
  })
  if (existing) return { outcome: existing, inserted: false }

  const { data, error } = await outcomesTable(admin)
    .insert({
      organization_id: input.organizationId,
      source: input.outcome.source,
      outcome_type: input.outcome.outcomeType,
      subject_type: input.outcome.subject.type,
      subject_id: input.outcome.subject.id,
      related: input.outcome.related,
      signal_strength: input.outcome.signalStrength,
      confidence: input.outcome.confidence,
      dimensions: input.outcome.dimensions,
      evidence: input.outcome.evidence,
      occurred_at: input.outcome.occurredAt,
      idempotency_key: input.idempotencyKey,
      qa_marker: GROWTH_CLOSED_LOOP_LEARNING_PERSISTENCE_QA_MARKER,
    })
    .select(OUTCOME_SELECT)
    .single()

  if (error) {
    if (error.message.includes("duplicate")) {
      const retry = await fetchClosedLoopLearningOutcomeByIdempotencyKey(admin, {
        organizationId: input.organizationId,
        idempotencyKey: input.idempotencyKey,
      })
      if (retry) return { outcome: retry, inserted: false }
    }
    throw new Error(error.message)
  }

  return { outcome: mapClosedLoopLearningOutcomeRow(data as OutcomeRow), inserted: true }
}

export async function fetchClosedLoopLearningInsightByIdempotencyKey(
  admin: SupabaseClient,
  input: { organizationId: string; idempotencyKey: string },
): Promise<GrowthLearningInsight | null> {
  const { data, error } = await insightsTable(admin)
    .select(INSIGHT_SELECT)
    .eq("organization_id", input.organizationId)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapClosedLoopLearningInsightRow(data as InsightRow) : null
}

export async function upsertClosedLoopLearningInsight(
  admin: SupabaseClient,
  input: {
    organizationId: string
    idempotencyKey: string
    generatedFromWindow: string
    insight: GrowthLearningInsight
  },
): Promise<{ insight: GrowthLearningInsight; inserted: boolean }> {
  const existing = await fetchClosedLoopLearningInsightByIdempotencyKey(admin, {
    organizationId: input.organizationId,
    idempotencyKey: input.idempotencyKey,
  })
  if (existing) return { insight: existing, inserted: false }

  const { data, error } = await insightsTable(admin)
    .insert({
      organization_id: input.organizationId,
      insight_type: input.insight.insightType,
      title: input.insight.title,
      summary: input.insight.summary,
      recommended_adjustment: input.insight.recommendedAdjustment,
      target_system: input.insight.targetSystem,
      confidence: input.insight.confidence,
      impact: input.insight.impact,
      sample_size: input.insight.sampleSize,
      evidence: input.insight.evidence,
      status: input.insight.status,
      generated_from_window: input.generatedFromWindow,
      idempotency_key: input.idempotencyKey,
      qa_marker: GROWTH_CLOSED_LOOP_LEARNING_PERSISTENCE_QA_MARKER,
    })
    .select(INSIGHT_SELECT)
    .single()

  if (error) {
    if (error.message.includes("duplicate")) {
      const retry = await fetchClosedLoopLearningInsightByIdempotencyKey(admin, {
        organizationId: input.organizationId,
        idempotencyKey: input.idempotencyKey,
      })
      if (retry) return { insight: retry, inserted: false }
    }
    throw new Error(error.message)
  }

  return { insight: mapClosedLoopLearningInsightRow(data as InsightRow), inserted: true }
}

export async function appendClosedLoopLearningEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    outcomeId?: string | null
    insightId?: string | null
    eventType: string
    payload?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await eventsTable(admin).insert({
    organization_id: input.organizationId,
    outcome_id: input.outcomeId ?? null,
    insight_id: input.insightId ?? null,
    event_type: input.eventType,
    payload: input.payload ?? {},
    qa_marker: GROWTH_CLOSED_LOOP_LEARNING_PERSISTENCE_QA_MARKER,
  })
  if (error) throw new Error(error.message)
}

export async function listRecentClosedLoopLearningOutcomes(
  admin: SupabaseClient,
  input: { organizationId: string; limit?: number },
): Promise<GrowthLearningOutcome[]> {
  const { data, error } = await outcomesTable(admin)
    .select(OUTCOME_SELECT)
    .eq("organization_id", input.organizationId)
    .order("occurred_at", { ascending: false })
    .limit(input.limit ?? 500)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapClosedLoopLearningOutcomeRow(row as OutcomeRow))
}

export async function listCurrentClosedLoopLearningInsights(
  admin: SupabaseClient,
  input: { organizationId: string; limit?: number },
): Promise<GrowthLearningInsight[]> {
  const { data, error } = await insightsTable(admin)
    .select(INSIGHT_SELECT)
    .eq("organization_id", input.organizationId)
    .is("superseded_at", null)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 24)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapClosedLoopLearningInsightRow(row as InsightRow))
}

export async function summarizeClosedLoopLearningByOrganization(
  admin: SupabaseClient,
  input: { organizationId: string },
): Promise<{ outcomeCount: number; insightCount: number; lastGeneratedAt: string | null }> {
  const outcomes = await listRecentClosedLoopLearningOutcomes(admin, {
    organizationId: input.organizationId,
    limit: 1,
  })
  const insights = await listCurrentClosedLoopLearningInsights(admin, {
    organizationId: input.organizationId,
    limit: 24,
  })

  const { count: outcomeCount, error: outcomeError } = await outcomesTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", input.organizationId)

  const { count: insightCount, error: insightError } = await insightsTable(admin)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", input.organizationId)
    .is("superseded_at", null)

  if (outcomeError) throw new Error(outcomeError.message)
  if (insightError) throw new Error(insightError.message)

  return {
    outcomeCount: outcomeCount ?? 0,
    insightCount: insightCount ?? 0,
    lastGeneratedAt: insights[0]?.createdAt ?? outcomes[0]?.createdAt ?? null,
  }
}
