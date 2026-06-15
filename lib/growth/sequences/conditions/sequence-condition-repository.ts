import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  AppendSequenceBranchDecisionInput,
  CreateSequenceBranchEdgeInput,
  SequenceBranchDecision,
  SequenceBranchEdge,
  UpdateSequenceBranchEdgeInput,
} from "@/lib/growth/sequences/conditions/sequence-branch-types"
import {
  appendSequenceBranchDecisionInputSchema,
  createSequenceBranchEdgeInputSchema,
  updateSequenceBranchEdgeInputSchema,
} from "@/lib/growth/sequences/conditions/sequence-branch-types"
import type {
  CreateSequenceConditionInput,
  SequenceConditionEvent,
  SequenceConditionSource,
  SequencePatternStepCondition,
  UpdateSequenceConditionInput,
} from "@/lib/growth/sequences/conditions/sequence-condition-types"
import {
  conditionRowToSpec,
  conditionSpecToPersistenceFields,
  parseSequenceConditionSpec,
} from "@/lib/growth/sequences/conditions/sequence-condition-types"
import type {
  CreateSequenceEnrollmentWaitInput,
  SequenceEnrollmentWait,
  UpdateSequenceEnrollmentWaitInput,
} from "@/lib/growth/sequences/conditions/sequence-wait-types"
import {
  createSequenceEnrollmentWaitInputSchema,
  updateSequenceEnrollmentWaitInputSchema,
} from "@/lib/growth/sequences/conditions/sequence-wait-types"

const CONDITION_SELECT =
  "id, pattern_step_id, condition_key, dsl_version, source, event, compare_operator, string_value, number_value, boolean_value, duration_seconds, label, created_at, updated_at"

const EDGE_SELECT =
  "id, pattern_id, from_pattern_step_id, to_pattern_step_id, condition_id, edge_type, priority, label, created_at, updated_at"

const WAIT_SELECT =
  "id, enrollment_id, enrollment_step_id, pattern_step_id, condition_id, wait_kind, status, waited_for_source, waited_for_event, duration_seconds, timeout_at, started_at, resolved_at, resolution_reason, created_at, updated_at"

const DECISION_SELECT =
  "id, enrollment_id, enrollment_step_id, pattern_step_id, condition_id, edge_id, decision, dsl_version, source, event, outcome_detail, evaluated_at, created_at"

type ConditionRow = {
  id: string
  pattern_step_id: string
  condition_key: string
  dsl_version: number
  source: SequencePatternStepCondition["spec"]["source"]
  event: SequencePatternStepCondition["spec"]["event"]
  compare_operator: string | null
  string_value: string | null
  number_value: number | null
  boolean_value: boolean | null
  duration_seconds: number | null
  label: string | null
  created_at: string
  updated_at: string
}

type EdgeRow = {
  id: string
  pattern_id: string
  from_pattern_step_id: string
  to_pattern_step_id: string
  condition_id: string | null
  edge_type: SequenceBranchEdge["edgeType"]
  priority: number
  label: string | null
  created_at: string
  updated_at: string
}

type WaitRow = {
  id: string
  enrollment_id: string
  enrollment_step_id: string
  pattern_step_id: string | null
  condition_id: string | null
  wait_kind: SequenceEnrollmentWait["waitKind"]
  status: SequenceEnrollmentWait["status"]
  waited_for_source: SequenceEnrollmentWait["waitedForSource"]
  waited_for_event: SequenceEnrollmentWait["waitedForEvent"]
  duration_seconds: number | null
  timeout_at: string | null
  started_at: string | null
  resolved_at: string | null
  resolution_reason: string | null
  created_at: string
  updated_at: string
}

type DecisionRow = {
  id: string
  enrollment_id: string
  enrollment_step_id: string | null
  pattern_step_id: string | null
  condition_id: string | null
  edge_id: string | null
  decision: SequenceBranchDecision["decision"]
  dsl_version: number
  source: SequenceBranchDecision["source"]
  event: SequenceBranchDecision["event"]
  outcome_detail: string | null
  evaluated_at: string
  created_at: string
}

function conditionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sequence_pattern_step_conditions")
}

function edgesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sequence_pattern_step_edges")
}

function waitsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sequence_enrollment_step_waits")
}

function decisionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("sequence_branch_decisions")
}

function mapConditionRow(row: ConditionRow): SequencePatternStepCondition {
  return {
    id: row.id,
    patternStepId: row.pattern_step_id,
    conditionKey: row.condition_key,
    spec: conditionRowToSpec(row),
    label: row.label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapEdgeRow(row: EdgeRow): SequenceBranchEdge {
  return {
    id: row.id,
    patternId: row.pattern_id,
    fromPatternStepId: row.from_pattern_step_id,
    toPatternStepId: row.to_pattern_step_id,
    conditionId: row.condition_id,
    edgeType: row.edge_type,
    priority: row.priority,
    label: row.label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapWaitRow(row: WaitRow): SequenceEnrollmentWait {
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    enrollmentStepId: row.enrollment_step_id,
    patternStepId: row.pattern_step_id,
    conditionId: row.condition_id,
    waitKind: row.wait_kind,
    status: row.status,
    waitedForSource: row.waited_for_source,
    waitedForEvent: row.waited_for_event,
    durationSeconds: row.duration_seconds,
    timeoutAt: row.timeout_at,
    startedAt: row.started_at,
    resolvedAt: row.resolved_at,
    resolutionReason: row.resolution_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapDecisionRow(row: DecisionRow): SequenceBranchDecision {
  return {
    id: row.id,
    enrollmentId: row.enrollment_id,
    enrollmentStepId: row.enrollment_step_id,
    patternStepId: row.pattern_step_id,
    conditionId: row.condition_id,
    edgeId: row.edge_id,
    decision: row.decision,
    dslVersion: row.dsl_version,
    source: row.source,
    event: row.event,
    outcomeDetail: row.outcome_detail,
    evaluatedAt: row.evaluated_at,
    createdAt: row.created_at,
  }
}

export async function createCondition(
  admin: SupabaseClient,
  input: CreateSequenceConditionInput,
): Promise<SequencePatternStepCondition> {
  const validated = parseSequenceConditionSpec(input.spec)
  if (!validated.ok) throw new Error(validated.message)

  const fields = conditionSpecToPersistenceFields(validated.spec)
  const { data, error } = await conditionsTable(admin)
    .insert({
      pattern_step_id: input.patternStepId,
      condition_key: input.conditionKey.trim(),
      ...fields,
      duration_seconds: input.durationSeconds ?? null,
      label: input.label?.trim() ?? null,
    })
    .select(CONDITION_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapConditionRow(data as ConditionRow)
}

export async function updateCondition(
  admin: SupabaseClient,
  conditionId: string,
  input: UpdateSequenceConditionInput,
): Promise<SequencePatternStepCondition> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (input.conditionKey !== undefined) row.condition_key = input.conditionKey.trim()
  if (input.label !== undefined) row.label = input.label?.trim() ?? null
  if (input.durationSeconds !== undefined) row.duration_seconds = input.durationSeconds

  if (input.spec !== undefined) {
    const validated = parseSequenceConditionSpec(input.spec)
    if (!validated.ok) throw new Error(validated.message)
    Object.assign(row, conditionSpecToPersistenceFields(validated.spec))
  }

  const { data, error } = await conditionsTable(admin)
    .update(row)
    .eq("id", conditionId)
    .select(CONDITION_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapConditionRow(data as ConditionRow)
}

export async function deleteCondition(admin: SupabaseClient, conditionId: string): Promise<void> {
  const { error } = await conditionsTable(admin).delete().eq("id", conditionId)
  if (error) throw new Error(error.message)
}

export async function listConditionsForStep(
  admin: SupabaseClient,
  patternStepId: string,
): Promise<SequencePatternStepCondition[]> {
  const { data, error } = await conditionsTable(admin)
    .select(CONDITION_SELECT)
    .eq("pattern_step_id", patternStepId)
    .order("condition_key", { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as ConditionRow[]).map(mapConditionRow)
}

export async function fetchConditionById(
  admin: SupabaseClient,
  conditionId: string,
): Promise<SequencePatternStepCondition | null> {
  const { data, error } = await conditionsTable(admin)
    .select(CONDITION_SELECT)
    .eq("id", conditionId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data ? mapConditionRow(data as ConditionRow) : null
}

export async function listActiveWaitsForWakeEvent(
  admin: SupabaseClient,
  input: {
    leadId: string
    sequenceEnrollmentId?: string | null
    waitedForSource: SequenceConditionSource
    waitedForEvent: SequenceConditionEvent
  },
): Promise<SequenceEnrollmentWait[]> {
  let enrollmentIds: string[] | null = null

  if (input.sequenceEnrollmentId) {
    enrollmentIds = [input.sequenceEnrollmentId]
  } else {
    const { data: enrollments, error: enrollmentError } = await admin
      .schema("growth")
      .from("sequence_enrollments")
      .select("id")
      .eq("lead_id", input.leadId)
      .in("status", ["active", "paused"])
    if (enrollmentError) throw new Error(enrollmentError.message)
    enrollmentIds = (enrollments ?? []).map((row) => String((row as { id: string }).id))
    if (enrollmentIds.length === 0) return []
  }

  const { data, error } = await waitsTable(admin)
    .select(WAIT_SELECT)
    .in("enrollment_id", enrollmentIds)
    .in("status", ["pending", "active"])
    .eq("waited_for_source", input.waitedForSource)
    .eq("waited_for_event", input.waitedForEvent)
    .order("created_at", { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as WaitRow[]).map(mapWaitRow)
}

export async function createEdge(
  admin: SupabaseClient,
  input: CreateSequenceBranchEdgeInput,
): Promise<SequenceBranchEdge> {
  const parsed = createSequenceBranchEdgeInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join("; "))
  }

  const value = parsed.data
  const { data, error } = await edgesTable(admin)
    .insert({
      pattern_id: value.patternId,
      from_pattern_step_id: value.fromPatternStepId,
      to_pattern_step_id: value.toPatternStepId,
      condition_id: value.conditionId ?? null,
      edge_type: value.edgeType,
      priority: value.priority ?? 0,
      label: value.label?.trim() ?? null,
    })
    .select(EDGE_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapEdgeRow(data as EdgeRow)
}

export async function updateEdge(
  admin: SupabaseClient,
  edgeId: string,
  input: UpdateSequenceBranchEdgeInput,
): Promise<SequenceBranchEdge> {
  const parsed = updateSequenceBranchEdgeInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join("; "))
  }

  const value = parsed.data
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (value.toPatternStepId !== undefined) row.to_pattern_step_id = value.toPatternStepId
  if (value.edgeType !== undefined) row.edge_type = value.edgeType
  if (value.conditionId !== undefined) row.condition_id = value.conditionId
  if (value.priority !== undefined) row.priority = value.priority
  if (value.label !== undefined) row.label = value.label?.trim() ?? null

  const { data, error } = await edgesTable(admin)
    .update(row)
    .eq("id", edgeId)
    .select(EDGE_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapEdgeRow(data as EdgeRow)
}

export async function deleteEdge(admin: SupabaseClient, edgeId: string): Promise<void> {
  const { error } = await edgesTable(admin).delete().eq("id", edgeId)
  if (error) throw new Error(error.message)
}

export async function listEdgesForPattern(
  admin: SupabaseClient,
  patternId: string,
): Promise<SequenceBranchEdge[]> {
  const { data, error } = await edgesTable(admin)
    .select(EDGE_SELECT)
    .eq("pattern_id", patternId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as EdgeRow[]).map(mapEdgeRow)
}

export async function listEdgesFromPatternStep(
  admin: SupabaseClient,
  patternId: string,
  fromPatternStepId: string,
): Promise<SequenceBranchEdge[]> {
  const { data, error } = await edgesTable(admin)
    .select(EDGE_SELECT)
    .eq("pattern_id", patternId)
    .eq("from_pattern_step_id", fromPatternStepId)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true })

  if (error) throw new Error(error.message)
  return ((data ?? []) as EdgeRow[]).map(mapEdgeRow)
}

export async function listActiveWaitsForEnrollmentStep(
  admin: SupabaseClient,
  enrollmentStepId: string,
): Promise<SequenceEnrollmentWait[]> {
  const { data, error } = await waitsTable(admin)
    .select(WAIT_SELECT)
    .eq("enrollment_step_id", enrollmentStepId)
    .in("status", ["pending", "active"])
    .order("created_at", { ascending: false })

  if (error) throw new Error(error.message)
  return ((data ?? []) as WaitRow[]).map(mapWaitRow)
}

export async function createWait(
  admin: SupabaseClient,
  input: CreateSequenceEnrollmentWaitInput,
): Promise<SequenceEnrollmentWait> {
  const parsed = createSequenceEnrollmentWaitInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join("; "))
  }

  const value = parsed.data
  const { data, error } = await waitsTable(admin)
    .insert({
      enrollment_id: value.enrollmentId,
      enrollment_step_id: value.enrollmentStepId,
      pattern_step_id: value.patternStepId ?? null,
      condition_id: value.conditionId ?? null,
      wait_kind: value.waitKind,
      status: value.status ?? "pending",
      waited_for_source: value.waitedForSource ?? null,
      waited_for_event: value.waitedForEvent ?? null,
      duration_seconds: value.durationSeconds ?? null,
      timeout_at: value.timeoutAt ?? null,
      started_at: value.startedAt ?? null,
      resolution_reason: value.resolutionReason?.trim() ?? null,
    })
    .select(WAIT_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapWaitRow(data as WaitRow)
}

export async function updateWait(
  admin: SupabaseClient,
  waitId: string,
  input: UpdateSequenceEnrollmentWaitInput,
): Promise<SequenceEnrollmentWait> {
  const parsed = updateSequenceEnrollmentWaitInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join("; "))
  }

  const value = parsed.data
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (value.status !== undefined) row.status = value.status
  if (value.waitedForSource !== undefined) row.waited_for_source = value.waitedForSource
  if (value.waitedForEvent !== undefined) row.waited_for_event = value.waitedForEvent
  if (value.durationSeconds !== undefined) row.duration_seconds = value.durationSeconds
  if (value.timeoutAt !== undefined) row.timeout_at = value.timeoutAt
  if (value.startedAt !== undefined) row.started_at = value.startedAt
  if (value.resolvedAt !== undefined) row.resolved_at = value.resolvedAt
  if (value.resolutionReason !== undefined) {
    row.resolution_reason = value.resolutionReason?.trim() ?? null
  }

  const { data, error } = await waitsTable(admin)
    .update(row)
    .eq("id", waitId)
    .select(WAIT_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapWaitRow(data as WaitRow)
}

export async function appendBranchDecision(
  admin: SupabaseClient,
  input: AppendSequenceBranchDecisionInput,
): Promise<SequenceBranchDecision> {
  const parsed = appendSequenceBranchDecisionInputSchema.safeParse(input)
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join("; "))
  }

  const value = parsed.data
  const { data, error } = await decisionsTable(admin)
    .insert({
      enrollment_id: value.enrollmentId,
      enrollment_step_id: value.enrollmentStepId ?? null,
      pattern_step_id: value.patternStepId ?? null,
      condition_id: value.conditionId ?? null,
      edge_id: value.edgeId ?? null,
      decision: value.decision,
      dsl_version: value.dslVersion,
      source: value.source,
      event: value.event,
      outcome_detail: value.outcomeDetail?.trim() ?? null,
      evaluated_at: value.evaluatedAt ?? new Date().toISOString(),
    })
    .select(DECISION_SELECT)
    .single()

  if (error) throw new Error(error.message)
  return mapDecisionRow(data as DecisionRow)
}

export async function listBranchDecisionsForEnrollment(
  admin: SupabaseClient,
  enrollmentId: string,
): Promise<SequenceBranchDecision[]> {
  const { data, error } = await decisionsTable(admin)
    .select(DECISION_SELECT)
    .eq("enrollment_id", enrollmentId)
    .order("evaluated_at", { ascending: false })

  if (error) throw new Error(error.message)
  return ((data ?? []) as DecisionRow[]).map(mapDecisionRow)
}
