/** GE-AUTO-1F — Objective persistence (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GROWTH_OBJECTIVE_QA_MARKER,
  GROWTH_OBJECTIVE_STATUSES,
  type GrowthObjective,
  type GrowthObjectiveCreateInput,
  type GrowthObjectiveExecutionPlan,
  type GrowthObjectiveStatus,
  type GrowthObjectiveType,
} from "@/lib/growth/objectives/growth-objective-types"
import { probeRuntimeTable } from "@/lib/growth/runtime-guardrails/growth-runtime-schema-probe"

const memoryStore = new Map<string, GrowthObjective[]>()

function objectivesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("organization_growth_objectives")
}

function normalizeStatus(value: unknown): GrowthObjectiveStatus {
  if (typeof value === "string" && (GROWTH_OBJECTIVE_STATUSES as readonly string[]).includes(value)) {
    return value as GrowthObjectiveStatus
  }
  return "draft"
}

function normalizeType(value: unknown): GrowthObjectiveType {
  const types = [
    "demos_booked",
    "meetings_booked",
    "opportunities_created",
    "pipeline_value",
    "customers_acquired",
    "custom",
  ] as const
  if (typeof value === "string" && (types as readonly string[]).includes(value)) {
    return value as GrowthObjectiveType
  }
  return "custom"
}

function normalizeRuntimeState(value: unknown): GrowthObjective["runtime"] {
  if (!value || typeof value !== "object") return null
  const runtime = value as GrowthObjective["runtime"]
  if (!runtime?.currentStageId || !runtime.stageStates || Object.keys(runtime.stageStates).length === 0) {
    return null
  }
  return runtime
}

export function normalizeGrowthObjectiveExecutionPlan(
  value: unknown,
): GrowthObjectiveExecutionPlan | null {
  if (!value || typeof value !== "object") return null
  const plan = value as Partial<GrowthObjectiveExecutionPlan>
  if (
    typeof plan.icpStrategy?.summary !== "string" ||
    !Array.isArray(plan.stages) ||
    plan.stages.length === 0 ||
    !plan.forecast ||
    typeof plan.forecast.leadsNeeded !== "number"
  ) {
    return null
  }
  return plan as GrowthObjectiveExecutionPlan
}

function mapRow(row: Record<string, unknown>): GrowthObjective {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    title: String(row.title),
    description: row.description ? String(row.description) : null,
    objectiveType: normalizeType(row.objective_type),
    targetValue: Number(row.target_value ?? 0),
    currentValue: Number(row.current_value ?? 0),
    startDate: row.start_date ? String(row.start_date) : null,
    targetDate: row.target_date ? String(row.target_date) : null,
    status: normalizeStatus(row.status),
    ownerUserId: row.owner_user_id ? String(row.owner_user_id) : null,
    priority: (row.priority as GrowthObjective["priority"]) ?? "medium",
    autonomyLevel: (row.autonomy_level as GrowthObjective["autonomyLevel"]) ?? "objective",
    safetyMode: (row.safety_mode as GrowthObjective["safetyMode"]) ?? "strict",
    plan: normalizeGrowthObjectiveExecutionPlan(row.plan),
    runtime: normalizeRuntimeState(row.runtime_state),
    executionHistory: Array.isArray(row.execution_history)
      ? (row.execution_history as GrowthObjective["executionHistory"])
      : [],
    recentSignals: Array.isArray(row.recent_signals)
      ? (row.recent_signals as GrowthObjective["recentSignals"])
      : [],
    recommendations: Array.isArray(row.recommendations)
      ? (row.recommendations as GrowthObjective["recommendations"])
      : [],
    eventSubscriptions: (row.event_subscriptions as GrowthObjective["eventSubscriptions"]) ?? null,
    executionContext: (row.execution_context as GrowthObjective["executionContext"]) ?? null,
    emergencyStopActive: Boolean(row.emergency_stop_active),
    qa_marker: GROWTH_OBJECTIVE_QA_MARKER,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    updatedAt: String(row.updated_at ?? new Date().toISOString()),
  }
}

function buildDefaultObjective(organizationId: string, input: GrowthObjectiveCreateInput): GrowthObjective {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    organizationId,
    title: input.title,
    description: input.description ?? null,
    objectiveType: input.objectiveType,
    targetValue: input.targetValue,
    currentValue: 0,
    startDate: input.startDate ?? now,
    targetDate: input.targetDate ?? null,
    status: "planning",
    ownerUserId: input.ownerUserId ?? null,
    priority: input.priority ?? "high",
    autonomyLevel: input.autonomyLevel ?? "objective",
    safetyMode: input.safetyMode ?? "strict",
    plan: null,
    runtime: null,
    executionHistory: [],
    recentSignals: [],
    recommendations: [],
    eventSubscriptions: null,
    executionContext: null,
    emergencyStopActive: false,
    qa_marker: GROWTH_OBJECTIVE_QA_MARKER,
    createdAt: now,
    updatedAt: now,
  }
}

export async function listGrowthObjectives(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthObjective[]> {
  const probe = await probeRuntimeTable(admin, "organization_growth_objectives")
  if (probe.missing) {
    return [...(memoryStore.get(organizationId) ?? [])]
  }

  const { data, error } = await objectivesTable(admin)
    .select("*")
    .eq("organization_id", organizationId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function getGrowthObjective(
  admin: SupabaseClient,
  organizationId: string,
  objectiveId: string,
): Promise<GrowthObjective | null> {
  const probe = await probeRuntimeTable(admin, "organization_growth_objectives")
  if (probe.missing) {
    return (memoryStore.get(organizationId) ?? []).find((entry) => entry.id === objectiveId) ?? null
  }

  const { data, error } = await objectivesTable(admin)
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", objectiveId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null
  return mapRow(data as Record<string, unknown>)
}

export async function insertGrowthObjective(
  admin: SupabaseClient,
  organizationId: string,
  input: GrowthObjectiveCreateInput,
): Promise<GrowthObjective> {
  const objective = buildDefaultObjective(organizationId, input)
  const probe = await probeRuntimeTable(admin, "organization_growth_objectives")

  if (probe.missing) {
    const existing = memoryStore.get(organizationId) ?? []
    memoryStore.set(organizationId, [objective, ...existing])
    return objective
  }

  const { data, error } = await objectivesTable(admin)
    .insert({
      id: objective.id,
      organization_id: organizationId,
      title: objective.title,
      description: objective.description,
      objective_type: objective.objectiveType,
      target_value: objective.targetValue,
      current_value: objective.currentValue,
      start_date: objective.startDate,
      target_date: objective.targetDate,
      status: objective.status,
      owner_user_id: objective.ownerUserId,
      priority: objective.priority,
      autonomy_level: objective.autonomyLevel,
      safety_mode: objective.safetyMode,
      plan: objective.plan,
      runtime_state: objective.runtime ?? {},
      execution_history: objective.executionHistory ?? [],
      recent_signals: objective.recentSignals ?? [],
      recommendations: objective.recommendations ?? [],
      emergency_stop_active: objective.emergencyStopActive,
      event_subscriptions: objective.eventSubscriptions ?? {},
      execution_context: objective.executionContext ?? {},
      qa_marker: GROWTH_OBJECTIVE_QA_MARKER,
    })
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as Record<string, unknown>)
}

export async function updateGrowthObjective(
  admin: SupabaseClient,
  organizationId: string,
  objectiveId: string,
  patch: Partial<GrowthObjective>,
): Promise<GrowthObjective> {
  const current = await getGrowthObjective(admin, organizationId, objectiveId)
  if (!current) throw new Error("Objective not found.")

  const next: GrowthObjective = {
    ...current,
    ...patch,
    id: current.id,
    organizationId,
    updatedAt: new Date().toISOString(),
  }

  const probe = await probeRuntimeTable(admin, "organization_growth_objectives")
  if (probe.missing) {
    const existing = memoryStore.get(organizationId) ?? []
    memoryStore.set(
      organizationId,
      existing.map((entry) => (entry.id === objectiveId ? next : entry)),
    )
    return next
  }

  const { data, error } = await objectivesTable(admin)
    .update({
      title: next.title,
      description: next.description,
      objective_type: next.objectiveType,
      target_value: next.targetValue,
      current_value: next.currentValue,
      start_date: next.startDate,
      target_date: next.targetDate,
      status: next.status,
      owner_user_id: next.ownerUserId,
      priority: next.priority,
      autonomy_level: next.autonomyLevel,
      safety_mode: next.safetyMode,
      plan: next.plan,
      runtime_state: next.runtime ?? {},
      execution_history: next.executionHistory,
      recent_signals: next.recentSignals,
      recommendations: next.recommendations,
      emergency_stop_active: next.emergencyStopActive,
      event_subscriptions: next.eventSubscriptions,
      execution_context: next.executionContext,
      qa_marker: GROWTH_OBJECTIVE_QA_MARKER,
    })
    .eq("organization_id", organizationId)
    .eq("id", objectiveId)
    .select("*")
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data as Record<string, unknown>)
}

/** Test helper — reset in-memory objectives between cert runs. */
export function resetGrowthObjectiveMemoryStore(): void {
  memoryStore.clear()
}

export async function listActiveRunningGrowthObjectives(
  admin: SupabaseClient,
): Promise<GrowthObjective[]> {
  const probe = await probeRuntimeTable(admin, "organization_growth_objectives")
  if (probe.missing) {
    return [...memoryStore.values()]
      .flat()
      .filter((entry) => entry.status === "active" && entry.runtime?.running && !entry.emergencyStopActive)
  }

  const { data, error } = await objectivesTable(admin)
    .select("*")
    .eq("status", "active")

  if (error) throw new Error(error.message)
  return (data ?? [])
    .map((row) => mapRow(row as Record<string, unknown>))
    .filter((entry) => entry.runtime?.running && !entry.emergencyStopActive)
}

export async function listGrowthObjectivesForOrganizationEvent(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthObjective[]> {
  const objectives = await listGrowthObjectives(admin, organizationId)
  return objectives.filter(
    (entry) => entry.status === "active" && entry.runtime?.running && !entry.emergencyStopActive,
  )
}
