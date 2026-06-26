/** GE-AIOS-2C — AI Agent Runtime persistence (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  AI_OS_AGENT_HEALTH_STATUSES,
  AI_OS_AGENT_LEASE_STATUSES,
  AI_OS_AGENT_RUNTIME_STATUSES,
  AI_OS_RUNTIME_AGENTS,
  GROWTH_AI_AGENT_RUNTIME_QA_MARKER,
  isAiOsAgentHealthStatus,
  isAiOsAgentRuntimeStatus,
  isAiOsRuntimeAgent,
  isAiWorkOrderTypeForRuntime,
  type AiOsAgentCapability,
  type AiOsAgentCapabilityInput,
  type AiOsAgentHeartbeatEvent,
  type AiOsAgentLease,
  type AiOsAgentLeaseStatus,
  type AiOsAgentRegisterInput,
  type AiOsAgentRegistration,
  type AiOsAgentRuntimeStatus,
  type AiOsRuntimeAgent,
} from "@/lib/growth/aios/ai-agent-runtime-types"

type RegistrationRow = {
  id: string
  organization_id: string
  agent_key: string
  instance_id: string
  runtime_status: string
  health_status: string
  active_lease_count: number
  max_concurrent_leases: number
  last_heartbeat_at: string
  metadata: Record<string, unknown> | null
  qa_marker: string
  created_at: string
  updated_at: string
}

type CapabilityRow = {
  id: string
  organization_id: string
  agent_key: string
  work_order_type: string
  enabled: boolean
  max_concurrent: number
  metadata: Record<string, unknown> | null
  qa_marker: string
  created_at: string
  updated_at: string
}

type LeaseRow = {
  id: string
  organization_id: string
  work_order_id: string
  agent_registration_id: string
  agent_key: string
  instance_id: string
  status: string
  leased_at: string
  expires_at: string
  released_at: string | null
  release_reason: string | null
  metadata: Record<string, unknown> | null
  qa_marker: string
  created_at: string
}

type HeartbeatRow = {
  id: string
  agent_registration_id: string
  organization_id: string
  agent_key: string
  instance_id: string
  runtime_status: string
  health_status: string
  metadata: Record<string, unknown> | null
  created_at: string
}

function registrationsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_os_agent_registrations")
}

function capabilitiesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_os_agent_capabilities")
}

function leasesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_os_agent_leases")
}

function heartbeatsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_os_agent_heartbeat_events")
}

function normalizeRuntimeStatus(value: unknown): AiOsAgentRuntimeStatus {
  return isAiOsAgentRuntimeStatus(value) ? value : "idle"
}

function normalizeHealthStatus(value: unknown) {
  return isAiOsAgentHealthStatus(value) ? value : "healthy"
}

function normalizeLeaseStatus(value: unknown): AiOsAgentLeaseStatus {
  if (typeof value === "string" && (AI_OS_AGENT_LEASE_STATUSES as readonly string[]).includes(value)) {
    return value as AiOsAgentLeaseStatus
  }
  return "active"
}

function mapRegistration(row: RegistrationRow): AiOsAgentRegistration {
  return {
    id: row.id,
    organizationId: row.organization_id,
    agentKey: row.agent_key as AiOsRuntimeAgent,
    instanceId: row.instance_id,
    runtimeStatus: normalizeRuntimeStatus(row.runtime_status),
    healthStatus: normalizeHealthStatus(row.health_status),
    activeLeaseCount: row.active_lease_count ?? 0,
    maxConcurrentLeases: row.max_concurrent_leases ?? 1,
    lastHeartbeatAt: row.last_heartbeat_at,
    metadata: row.metadata ?? {},
    qaMarker: row.qa_marker,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapCapability(row: CapabilityRow): AiOsAgentCapability {
  return {
    id: row.id,
    organizationId: row.organization_id,
    agentKey: row.agent_key as AiOsRuntimeAgent,
    workOrderType: row.work_order_type as AiOsAgentCapability["workOrderType"],
    enabled: row.enabled !== false,
    maxConcurrent: row.max_concurrent ?? 1,
    metadata: row.metadata ?? {},
    qaMarker: row.qa_marker,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapLease(row: LeaseRow): AiOsAgentLease {
  return {
    id: row.id,
    organizationId: row.organization_id,
    workOrderId: row.work_order_id,
    agentRegistrationId: row.agent_registration_id,
    agentKey: row.agent_key as AiOsRuntimeAgent,
    instanceId: row.instance_id,
    status: normalizeLeaseStatus(row.status),
    leasedAt: row.leased_at,
    expiresAt: row.expires_at,
    releasedAt: row.released_at,
    releaseReason: row.release_reason,
    metadata: row.metadata ?? {},
    qaMarker: row.qa_marker,
    createdAt: row.created_at,
  }
}

function mapHeartbeat(row: HeartbeatRow): AiOsAgentHeartbeatEvent {
  return {
    id: row.id,
    agentRegistrationId: row.agent_registration_id,
    organizationId: row.organization_id,
    agentKey: row.agent_key as AiOsRuntimeAgent,
    instanceId: row.instance_id,
    runtimeStatus: normalizeRuntimeStatus(row.runtime_status),
    healthStatus: normalizeHealthStatus(row.health_status),
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }
}

export async function upsertAiOsAgentRegistration(
  admin: SupabaseClient,
  input: AiOsAgentRegisterInput,
): Promise<AiOsAgentRegistration> {
  if (!isAiOsRuntimeAgent(input.agentKey)) throw new Error("ai_agent_invalid_key")

  const row = {
    organization_id: input.organizationId,
    agent_key: input.agentKey,
    instance_id: input.instanceId,
    runtime_status: input.runtimeStatus ?? "idle",
    health_status: "healthy",
    max_concurrent_leases: input.maxConcurrentLeases ?? 1,
    last_heartbeat_at: new Date().toISOString(),
    metadata: input.metadata ?? {},
    qa_marker: GROWTH_AI_AGENT_RUNTIME_QA_MARKER,
  }

  const { data, error } = await registrationsTable(admin)
    .upsert(row, { onConflict: "organization_id,agent_key,instance_id" })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapRegistration(data as RegistrationRow)
}

export async function fetchAiOsAgentRegistration(
  admin: SupabaseClient,
  input: { organizationId: string; registrationId: string },
): Promise<AiOsAgentRegistration | null> {
  const { data, error } = await registrationsTable(admin)
    .select("*")
    .eq("id", input.registrationId)
    .eq("organization_id", input.organizationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRegistration(data as RegistrationRow) : null
}

export async function listAiOsAgentRegistrations(
  admin: SupabaseClient,
  input: { organizationId: string; agentKey?: AiOsRuntimeAgent },
): Promise<AiOsAgentRegistration[]> {
  let query = registrationsTable(admin).select("*").eq("organization_id", input.organizationId)
  if (input.agentKey) query = query.eq("agent_key", input.agentKey)

  const { data, error } = await query.order("last_heartbeat_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapRegistration(row as RegistrationRow))
}

export async function updateAiOsAgentRegistration(
  admin: SupabaseClient,
  input: { organizationId: string; registrationId: string; patch: Record<string, unknown> },
): Promise<AiOsAgentRegistration> {
  const { data, error } = await registrationsTable(admin)
    .update(input.patch)
    .eq("id", input.registrationId)
    .eq("organization_id", input.organizationId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapRegistration(data as RegistrationRow)
}

export async function upsertAiOsAgentCapability(
  admin: SupabaseClient,
  input: AiOsAgentCapabilityInput,
): Promise<AiOsAgentCapability> {
  if (!isAiOsRuntimeAgent(input.agentKey)) throw new Error("ai_agent_invalid_key")
  if (!isAiWorkOrderTypeForRuntime(input.workOrderType)) throw new Error("ai_agent_invalid_work_order_type")

  const row = {
    organization_id: input.organizationId,
    agent_key: input.agentKey,
    work_order_type: input.workOrderType,
    enabled: input.enabled !== false,
    max_concurrent: input.maxConcurrent ?? 1,
    metadata: input.metadata ?? {},
    qa_marker: GROWTH_AI_AGENT_RUNTIME_QA_MARKER,
  }

  const { data, error } = await capabilitiesTable(admin)
    .upsert(row, { onConflict: "organization_id,agent_key,work_order_type" })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapCapability(data as CapabilityRow)
}

export async function listAiOsAgentCapabilities(
  admin: SupabaseClient,
  input: { organizationId: string; agentKey?: AiOsRuntimeAgent; enabledOnly?: boolean },
): Promise<AiOsAgentCapability[]> {
  let query = capabilitiesTable(admin).select("*").eq("organization_id", input.organizationId)
  if (input.agentKey) query = query.eq("agent_key", input.agentKey)
  if (input.enabledOnly) query = query.eq("enabled", true)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapCapability(row as CapabilityRow))
}

export async function insertAiOsAgentLease(
  admin: SupabaseClient,
  input: {
    organizationId: string
    workOrderId: string
    agentRegistrationId: string
    agentKey: AiOsRuntimeAgent
    instanceId: string
    expiresAt: string
    metadata?: Record<string, unknown>
  },
): Promise<AiOsAgentLease> {
  const row = {
    organization_id: input.organizationId,
    work_order_id: input.workOrderId,
    agent_registration_id: input.agentRegistrationId,
    agent_key: input.agentKey,
    instance_id: input.instanceId,
    status: "active",
    expires_at: input.expiresAt,
    metadata: input.metadata ?? {},
    qa_marker: GROWTH_AI_AGENT_RUNTIME_QA_MARKER,
  }

  const { data, error } = await leasesTable(admin).insert(row).select("*").single()
  if (error) throw new Error(error.message)
  return mapLease(data as LeaseRow)
}

export async function fetchActiveAiOsAgentLeaseForWorkOrder(
  admin: SupabaseClient,
  input: { organizationId: string; workOrderId: string },
): Promise<AiOsAgentLease | null> {
  const { data, error } = await leasesTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("work_order_id", input.workOrderId)
    .eq("status", "active")
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapLease(data as LeaseRow) : null
}

export async function fetchAiOsAgentLeaseById(
  admin: SupabaseClient,
  input: { organizationId: string; leaseId: string },
): Promise<AiOsAgentLease | null> {
  const { data, error } = await leasesTable(admin)
    .select("*")
    .eq("id", input.leaseId)
    .eq("organization_id", input.organizationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapLease(data as LeaseRow) : null
}

export async function updateAiOsAgentLease(
  admin: SupabaseClient,
  input: { organizationId: string; leaseId: string; patch: Record<string, unknown> },
): Promise<AiOsAgentLease> {
  const { data, error } = await leasesTable(admin)
    .update(input.patch)
    .eq("id", input.leaseId)
    .eq("organization_id", input.organizationId)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapLease(data as LeaseRow)
}

export async function listExpiredActiveAiOsAgentLeases(
  admin: SupabaseClient,
  input: { organizationId?: string; now?: string },
): Promise<AiOsAgentLease[]> {
  const now = input.now ?? new Date().toISOString()
  let query = leasesTable(admin).select("*").eq("status", "active").lt("expires_at", now)
  if (input.organizationId) query = query.eq("organization_id", input.organizationId)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapLease(row as LeaseRow))
}

export async function insertAiOsAgentHeartbeatEvent(
  admin: SupabaseClient,
  input: {
    agentRegistrationId: string
    organizationId: string
    agentKey: AiOsRuntimeAgent
    instanceId: string
    runtimeStatus: AiOsAgentRuntimeStatus
    healthStatus: AiOsAgentRegistration["healthStatus"]
    metadata?: Record<string, unknown>
  },
): Promise<AiOsAgentHeartbeatEvent> {
  const row = {
    agent_registration_id: input.agentRegistrationId,
    organization_id: input.organizationId,
    agent_key: input.agentKey,
    instance_id: input.instanceId,
    runtime_status: input.runtimeStatus,
    health_status: input.healthStatus,
    metadata: input.metadata ?? {},
  }

  const { data, error } = await heartbeatsTable(admin).insert(row).select("*").single()
  if (error) throw new Error(error.message)
  return mapHeartbeat(data as HeartbeatRow)
}

export function aiAgentRuntimeSchemaCatalog() {
  return {
    runtimeAgents: [...AI_OS_RUNTIME_AGENTS],
    runtimeStatuses: [...AI_OS_AGENT_RUNTIME_STATUSES],
    healthStatuses: [...AI_OS_AGENT_HEALTH_STATUSES],
    leaseStatuses: [...AI_OS_AGENT_LEASE_STATUSES],
    qaMarker: GROWTH_AI_AGENT_RUNTIME_QA_MARKER,
  }
}
