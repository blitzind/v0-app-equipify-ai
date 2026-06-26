/** GE-AIOS-2G — Executive Brain persistence (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  AI_EXECUTIVE_BRAIN_RUNTIME_STATUSES,
  AI_EXECUTIVE_DELEGATION_STATUSES,
  AI_EXECUTIVE_MISSION_STATUSES,
  GROWTH_AI_EXECUTIVE_BRAIN_QA_MARKER,
  type AiExecutiveBrainHealthStatus,
  type AiExecutiveBrainRuntime,
  type AiExecutiveBrainRuntimeStatus,
  type AiExecutiveDelegation,
  type AiExecutiveDelegationStatus,
  type AiExecutiveEventObservation,
  type AiExecutiveHeartbeatEvent,
  type AiExecutiveMissionState,
  type AiExecutiveMissionStatus,
} from "@/lib/growth/aios/ai-executive-brain-types"
import type { AiOsRuntimeAgent } from "@/lib/growth/aios/ai-agent-runtime-types"

type RuntimeRow = {
  id: string
  organization_id: string
  instance_id: string
  runtime_status: string
  health_status: string
  active_mission_count: number
  active_delegation_count: number
  last_heartbeat_at: string
  last_tick_at: string | null
  metadata: Record<string, unknown> | null
  qa_marker: string
  created_at: string
  updated_at: string
}

type MissionRow = {
  id: string
  organization_id: string
  mission_id: string
  executive_runtime_id: string
  mission_status: string
  pending_work_order_count: number
  active_work_order_count: number
  completed_work_order_count: number
  last_delegated_at: string | null
  last_monitored_at: string | null
  last_tick_at: string | null
  metadata: Record<string, unknown> | null
  qa_marker: string
  created_at: string
  updated_at: string
}

type DelegationRow = {
  id: string
  organization_id: string
  mission_id: string
  executive_runtime_id: string
  work_order_id: string
  assigned_agent: string
  delegation_status: string
  delegated_at: string
  completed_at: string | null
  metadata: Record<string, unknown> | null
  qa_marker: string
  created_at: string
}

function runtimeTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_executive_brain_runtime")
}

function missionTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_executive_mission_state")
}

function delegationTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_executive_delegations")
}

function heartbeatTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_executive_heartbeat_events")
}

function observationTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_executive_event_observations")
}

function normalizeRuntimeStatus(value: unknown): AiExecutiveBrainRuntimeStatus {
  if (typeof value === "string" && (AI_EXECUTIVE_BRAIN_RUNTIME_STATUSES as readonly string[]).includes(value)) {
    return value as AiExecutiveBrainRuntimeStatus
  }
  return "idle"
}

function normalizeMissionStatus(value: unknown): AiExecutiveMissionStatus {
  if (typeof value === "string" && (AI_EXECUTIVE_MISSION_STATUSES as readonly string[]).includes(value)) {
    return value as AiExecutiveMissionStatus
  }
  return "idle"
}

function normalizeDelegationStatus(value: unknown): AiExecutiveDelegationStatus {
  if (typeof value === "string" && (AI_EXECUTIVE_DELEGATION_STATUSES as readonly string[]).includes(value)) {
    return value as AiExecutiveDelegationStatus
  }
  return "issued"
}

function mapRuntime(row: RuntimeRow): AiExecutiveBrainRuntime {
  return {
    id: row.id,
    organizationId: row.organization_id,
    instanceId: row.instance_id,
    runtimeStatus: normalizeRuntimeStatus(row.runtime_status),
    healthStatus: (row.health_status as AiExecutiveBrainHealthStatus) ?? "healthy",
    activeMissionCount: row.active_mission_count ?? 0,
    activeDelegationCount: row.active_delegation_count ?? 0,
    lastHeartbeatAt: row.last_heartbeat_at,
    lastTickAt: row.last_tick_at,
    metadata: row.metadata ?? {},
    qaMarker: row.qa_marker,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapMission(row: MissionRow): AiExecutiveMissionState {
  return {
    id: row.id,
    organizationId: row.organization_id,
    missionId: row.mission_id,
    executiveRuntimeId: row.executive_runtime_id,
    missionStatus: normalizeMissionStatus(row.mission_status),
    pendingWorkOrderCount: row.pending_work_order_count ?? 0,
    activeWorkOrderCount: row.active_work_order_count ?? 0,
    completedWorkOrderCount: row.completed_work_order_count ?? 0,
    lastDelegatedAt: row.last_delegated_at,
    lastMonitoredAt: row.last_monitored_at,
    lastTickAt: row.last_tick_at,
    metadata: row.metadata ?? {},
    qaMarker: row.qa_marker,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapDelegation(row: DelegationRow): AiExecutiveDelegation {
  return {
    id: row.id,
    organizationId: row.organization_id,
    missionId: row.mission_id,
    executiveRuntimeId: row.executive_runtime_id,
    workOrderId: row.work_order_id,
    assignedAgent: row.assigned_agent as AiOsRuntimeAgent,
    delegationStatus: normalizeDelegationStatus(row.delegation_status),
    delegatedAt: row.delegated_at,
    completedAt: row.completed_at,
    metadata: row.metadata ?? {},
    qaMarker: row.qa_marker,
    createdAt: row.created_at,
  }
}

export async function upsertAiExecutiveBrainRuntime(
  admin: SupabaseClient,
  input: {
    organizationId: string
    instanceId: string
    runtimeStatus?: AiExecutiveBrainRuntimeStatus
    metadata?: Record<string, unknown>
  },
): Promise<AiExecutiveBrainRuntime> {
  const row = {
    organization_id: input.organizationId,
    instance_id: input.instanceId,
    runtime_status: input.runtimeStatus ?? "idle",
    health_status: "healthy",
    metadata: input.metadata ?? {},
    qa_marker: GROWTH_AI_EXECUTIVE_BRAIN_QA_MARKER,
    last_heartbeat_at: new Date().toISOString(),
  }

  const { data, error } = await runtimeTable(admin)
    .upsert(row, { onConflict: "organization_id,instance_id" })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapRuntime(data as RuntimeRow)
}

export async function fetchAiExecutiveBrainRuntime(
  admin: SupabaseClient,
  input: { organizationId: string; executiveRuntimeId: string },
): Promise<AiExecutiveBrainRuntime | null> {
  const { data, error } = await runtimeTable(admin)
    .select("*")
    .eq("id", input.executiveRuntimeId)
    .eq("organization_id", input.organizationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRuntime(data as RuntimeRow) : null
}

export async function listAiExecutiveBrainRuntimes(
  admin: SupabaseClient,
  input: { organizationId: string },
): Promise<AiExecutiveBrainRuntime[]> {
  const { data, error } = await runtimeTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .order("updated_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapRuntime(row as RuntimeRow))
}

export async function updateAiExecutiveBrainRuntime(
  admin: SupabaseClient,
  input: { organizationId: string; executiveRuntimeId: string; patch: Record<string, unknown> },
): Promise<AiExecutiveBrainRuntime> {
  const { data, error } = await runtimeTable(admin)
    .update({ ...input.patch, updated_at: new Date().toISOString() })
    .eq("id", input.executiveRuntimeId)
    .eq("organization_id", input.organizationId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapRuntime(data as RuntimeRow)
}

export async function upsertAiExecutiveMissionState(
  admin: SupabaseClient,
  input: {
    organizationId: string
    missionId: string
    executiveRuntimeId: string
    patch?: Record<string, unknown>
  },
): Promise<AiExecutiveMissionState> {
  const { data: existing, error: existingError } = await missionTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("mission_id", input.missionId)
    .eq("executive_runtime_id", input.executiveRuntimeId)
    .maybeSingle()
  if (existingError) throw new Error(existingError.message)

  if (existing) {
    const { data, error } = await missionTable(admin)
      .update({ ...(input.patch ?? {}), updated_at: new Date().toISOString() })
      .eq("id", (existing as MissionRow).id)
      .select("*")
      .single()
    if (error) throw new Error(error.message)
    return mapMission(data as MissionRow)
  }

  const row = {
    organization_id: input.organizationId,
    mission_id: input.missionId,
    executive_runtime_id: input.executiveRuntimeId,
    mission_status: "active",
    qa_marker: GROWTH_AI_EXECUTIVE_BRAIN_QA_MARKER,
    ...(input.patch ?? {}),
  }

  const { data, error } = await missionTable(admin).insert(row).select("*").single()
  if (error) throw new Error(error.message)
  return mapMission(data as MissionRow)
}

export async function fetchAiExecutiveMissionState(
  admin: SupabaseClient,
  input: { organizationId: string; missionId: string; executiveRuntimeId: string },
): Promise<AiExecutiveMissionState | null> {
  const { data, error } = await missionTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("mission_id", input.missionId)
    .eq("executive_runtime_id", input.executiveRuntimeId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapMission(data as MissionRow) : null
}

export async function insertAiExecutiveDelegation(
  admin: SupabaseClient,
  input: {
    organizationId: string
    missionId: string
    executiveRuntimeId: string
    workOrderId: string
    assignedAgent: AiOsRuntimeAgent
    metadata?: Record<string, unknown>
  },
): Promise<AiExecutiveDelegation> {
  const row = {
    organization_id: input.organizationId,
    mission_id: input.missionId,
    executive_runtime_id: input.executiveRuntimeId,
    work_order_id: input.workOrderId,
    assigned_agent: input.assignedAgent,
    delegation_status: "issued",
    metadata: input.metadata ?? {},
    qa_marker: GROWTH_AI_EXECUTIVE_BRAIN_QA_MARKER,
  }

  const { data, error } = await delegationTable(admin).insert(row).select("*").single()
  if (error) throw new Error(error.message)
  return mapDelegation(data as DelegationRow)
}

export async function fetchAiExecutiveDelegationById(
  admin: SupabaseClient,
  input: { organizationId: string; delegationId: string },
): Promise<AiExecutiveDelegation | null> {
  const { data, error } = await delegationTable(admin)
    .select("*")
    .eq("id", input.delegationId)
    .eq("organization_id", input.organizationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapDelegation(data as DelegationRow) : null
}

export async function listAiExecutiveDelegationsForMission(
  admin: SupabaseClient,
  input: { organizationId: string; missionId: string; executiveRuntimeId?: string },
): Promise<AiExecutiveDelegation[]> {
  let query = delegationTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("mission_id", input.missionId)
    .order("delegated_at", { ascending: false })

  if (input.executiveRuntimeId) {
    query = query.eq("executive_runtime_id", input.executiveRuntimeId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapDelegation(row as DelegationRow))
}

export async function updateAiExecutiveDelegation(
  admin: SupabaseClient,
  input: { organizationId: string; delegationId: string; patch: Record<string, unknown> },
): Promise<AiExecutiveDelegation> {
  const { data, error } = await delegationTable(admin)
    .update(input.patch)
    .eq("id", input.delegationId)
    .eq("organization_id", input.organizationId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapDelegation(data as DelegationRow)
}

export async function insertAiExecutiveHeartbeatEvent(
  admin: SupabaseClient,
  input: {
    executiveRuntimeId: string
    organizationId: string
    runtimeStatus: AiExecutiveBrainRuntimeStatus
    healthStatus: AiExecutiveBrainHealthStatus
    metadata?: Record<string, unknown>
  },
): Promise<AiExecutiveHeartbeatEvent> {
  const row = {
    executive_runtime_id: input.executiveRuntimeId,
    organization_id: input.organizationId,
    runtime_status: input.runtimeStatus,
    health_status: input.healthStatus,
    metadata: input.metadata ?? {},
  }

  const { data, error } = await heartbeatTable(admin).insert(row).select("*").single()
  if (error) throw new Error(error.message)
  return {
    id: data.id,
    executiveRuntimeId: data.executive_runtime_id,
    organizationId: data.organization_id,
    runtimeStatus: normalizeRuntimeStatus(data.runtime_status),
    healthStatus: data.health_status as AiExecutiveBrainHealthStatus,
    metadata: data.metadata ?? {},
    createdAt: data.created_at,
  }
}

export async function insertAiExecutiveEventObservation(
  admin: SupabaseClient,
  input: {
    organizationId: string
    executiveRuntimeId: string
    eventId?: string | null
    eventCategory: string
    eventType: string
    missionId?: string | null
    workOrderId?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<AiExecutiveEventObservation> {
  const row = {
    organization_id: input.organizationId,
    executive_runtime_id: input.executiveRuntimeId,
    event_id: input.eventId ?? null,
    event_category: input.eventCategory,
    event_type: input.eventType,
    mission_id: input.missionId ?? null,
    work_order_id: input.workOrderId ?? null,
    metadata: input.metadata ?? {},
  }

  const { data, error } = await observationTable(admin).insert(row).select("*").single()
  if (error) throw new Error(error.message)
  return {
    id: data.id,
    organizationId: data.organization_id,
    executiveRuntimeId: data.executive_runtime_id,
    eventId: data.event_id,
    eventCategory: data.event_category,
    eventType: data.event_type,
    missionId: data.mission_id,
    workOrderId: data.work_order_id,
    metadata: data.metadata ?? {},
    observedAt: data.observed_at,
    createdAt: data.created_at,
  }
}

export function aiExecutiveBrainSchemaCatalog() {
  return {
    qaMarker: GROWTH_AI_EXECUTIVE_BRAIN_QA_MARKER,
    runtimeStatuses: [...AI_EXECUTIVE_BRAIN_RUNTIME_STATUSES],
    missionStatuses: [...AI_EXECUTIVE_MISSION_STATUSES],
  }
}
