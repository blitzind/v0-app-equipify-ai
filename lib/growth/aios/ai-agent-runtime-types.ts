/** GE-AIOS-2C — AI Agent Runtime types (client-safe). Constitutional §12.2. */

import {
  AI_WORK_ORDER_AGENTS,
  AI_WORK_ORDER_TYPES,
  type AiWorkOrderAgent,
  type AiWorkOrderType,
} from "@/lib/growth/aios/ai-work-order-types"

export const GROWTH_AIOS_2C_PHASE = "GE-AIOS-2C" as const

export const GROWTH_AI_AGENT_RUNTIME_QA_MARKER = "growth-aios-2c-ai-agent-runtime-v1" as const

export const GROWTH_AI_AGENT_RUNTIME_SCHEMA_MIGRATION =
  "20271001140000_growth_aios_2c_ai_agent_runtime.sql" as const

/** Constitutional runtime agents — excludes executive_brain (delegates, never claims). */
export const AI_OS_RUNTIME_AGENTS = AI_WORK_ORDER_AGENTS.filter(
  (agent) => agent !== "executive_brain",
) as readonly Exclude<AiWorkOrderAgent, "executive_brain">[]

export type AiOsRuntimeAgent = (typeof AI_OS_RUNTIME_AGENTS)[number]

/** Constitutional agent lifecycle states (§12.2). */
export const AI_OS_AGENT_RUNTIME_STATUSES = [
  "sleeping",
  "idle",
  "planning",
  "working",
  "waiting",
  "monitoring",
  "escalated",
  "recovery",
  "completed",
] as const

export type AiOsAgentRuntimeStatus = (typeof AI_OS_AGENT_RUNTIME_STATUSES)[number]

export const AI_OS_AGENT_HEALTH_STATUSES = ["healthy", "degraded", "unhealthy", "offline"] as const

export type AiOsAgentHealthStatus = (typeof AI_OS_AGENT_HEALTH_STATUSES)[number]

export const AI_OS_AGENT_LEASE_STATUSES = ["active", "released", "expired", "failed", "escalated"] as const

export type AiOsAgentLeaseStatus = (typeof AI_OS_AGENT_LEASE_STATUSES)[number]

export const AI_OS_AGENT_DEFAULT_LEASE_TTL_MS = 15 * 60 * 1000
export const AI_OS_AGENT_HEARTBEAT_STALE_MS = 5 * 60 * 1000
export const AI_OS_AGENT_DEFAULT_MAX_CONCURRENT_LEASES = 1

export type AiOsAgentRegistration = {
  id: string
  organizationId: string
  agentKey: AiOsRuntimeAgent
  instanceId: string
  runtimeStatus: AiOsAgentRuntimeStatus
  healthStatus: AiOsAgentHealthStatus
  activeLeaseCount: number
  maxConcurrentLeases: number
  lastHeartbeatAt: string
  metadata: Record<string, unknown>
  qaMarker: string
  createdAt: string
  updatedAt: string
}

export type AiOsAgentCapability = {
  id: string
  organizationId: string
  agentKey: AiOsRuntimeAgent
  workOrderType: AiWorkOrderType
  enabled: boolean
  maxConcurrent: number
  metadata: Record<string, unknown>
  qaMarker: string
  createdAt: string
  updatedAt: string
}

export type AiOsAgentLease = {
  id: string
  organizationId: string
  workOrderId: string
  agentRegistrationId: string
  agentKey: AiOsRuntimeAgent
  instanceId: string
  status: AiOsAgentLeaseStatus
  leasedAt: string
  expiresAt: string
  releasedAt: string | null
  releaseReason: string | null
  metadata: Record<string, unknown>
  qaMarker: string
  createdAt: string
}

export type AiOsAgentHeartbeatEvent = {
  id: string
  agentRegistrationId: string
  organizationId: string
  agentKey: AiOsRuntimeAgent
  instanceId: string
  runtimeStatus: AiOsAgentRuntimeStatus
  healthStatus: AiOsAgentHealthStatus
  metadata: Record<string, unknown>
  createdAt: string
}

export type AiOsAgentRegisterInput = {
  organizationId: string
  agentKey: AiOsRuntimeAgent
  instanceId: string
  maxConcurrentLeases?: number
  runtimeStatus?: AiOsAgentRuntimeStatus
  metadata?: Record<string, unknown>
  seedDefaultCapabilities?: boolean
}

export type AiOsAgentHeartbeatInput = {
  organizationId: string
  agentRegistrationId: string
  runtimeStatus?: AiOsAgentRuntimeStatus
  healthStatus?: AiOsAgentHealthStatus
  metadata?: Record<string, unknown>
}

export type AiOsAgentCapabilityInput = {
  organizationId: string
  agentKey: AiOsRuntimeAgent
  workOrderType: AiWorkOrderType
  enabled?: boolean
  maxConcurrent?: number
  metadata?: Record<string, unknown>
}

export type AiOsAgentClaimWorkOrderInput = {
  organizationId: string
  agentRegistrationId: string
  workOrderId: string
  leaseTtlMs?: number
  metadata?: Record<string, unknown>
}

export type AiOsAgentReleaseLeaseInput = {
  organizationId: string
  leaseId: string
  reason?: string
  releaseWorkOrderTo?: "waiting" | "planning"
}

export type AiOsAgentFailLeaseInput = {
  organizationId: string
  leaseId: string
  failureReason?: string
}

export type AiOsAgentEscalateLeaseInput = {
  organizationId: string
  leaseId: string
  reason?: string
}

export type AiOsAgentRetryWorkOrderInput = {
  organizationId: string
  agentRegistrationId: string
  workOrderId: string
  reason?: string
}

export type AiOsAgentHealthReport = {
  organizationId: string
  evaluatedAt: string
  staleThresholdMs: number
  agents: Array<{
    registrationId: string
    agentKey: AiOsRuntimeAgent
    instanceId: string
    healthStatus: AiOsAgentHealthStatus
    lastHeartbeatAt: string
    stale: boolean
    activeLeaseCount: number
  }>
  expiredLeases: number
}

export function isAiOsRuntimeAgent(value: unknown): value is AiOsRuntimeAgent {
  return typeof value === "string" && (AI_OS_RUNTIME_AGENTS as readonly string[]).includes(value)
}

export function isAiOsAgentRuntimeStatus(value: unknown): value is AiOsAgentRuntimeStatus {
  return typeof value === "string" && (AI_OS_AGENT_RUNTIME_STATUSES as readonly string[]).includes(value)
}

export function isAiOsAgentHealthStatus(value: unknown): value is AiOsAgentHealthStatus {
  return typeof value === "string" && (AI_OS_AGENT_HEALTH_STATUSES as readonly string[]).includes(value)
}

export function isAiWorkOrderTypeForRuntime(value: unknown): value is AiWorkOrderType {
  return typeof value === "string" && (AI_WORK_ORDER_TYPES as readonly string[]).includes(value)
}

export function isAgentHeartbeatStale(
  lastHeartbeatAt: string,
  thresholdMs = AI_OS_AGENT_HEARTBEAT_STALE_MS,
): boolean {
  return Date.now() - new Date(lastHeartbeatAt).getTime() > thresholdMs
}

/** Runtime rule: agents publish events; never invoke other agents directly. */
export const AI_OS_AGENT_RUNTIME_COUPLING_RULE =
  "Agents claim Work Orders and publish Events — they SHALL NOT call other agents directly." as const
