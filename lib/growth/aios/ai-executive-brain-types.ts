/** GE-AIOS-2G — Executive Brain types (client-safe). Constitutional §9. */

import type { AiOsRuntimeAgent } from "@/lib/growth/aios/ai-agent-runtime-types"
import type { AiWorkOrderType } from "@/lib/growth/aios/ai-work-order-types"

export const GROWTH_AIOS_2G_PHASE = "GE-AIOS-2G" as const

export const GROWTH_AI_EXECUTIVE_BRAIN_QA_MARKER = "growth-aios-2g-executive-brain-v1" as const

export const GROWTH_AI_EXECUTIVE_BRAIN_SCHEMA_MIGRATION =
  "20271001170000_growth_aios_2g_executive_brain.sql" as const

export const AI_EXECUTIVE_BRAIN_SUBSCRIBER_ID = "executive_brain" as const

export const AI_EXECUTIVE_BRAIN_RUNTIME_STATUSES = [
  "sleeping",
  "idle",
  "planning",
  "delegating",
  "monitoring",
  "escalated",
  "completed",
] as const

export type AiExecutiveBrainRuntimeStatus = (typeof AI_EXECUTIVE_BRAIN_RUNTIME_STATUSES)[number]

export const AI_EXECUTIVE_MISSION_STATUSES = [
  "idle",
  "active",
  "monitoring",
  "escalated",
  "completed",
  "paused",
] as const

export type AiExecutiveMissionStatus = (typeof AI_EXECUTIVE_MISSION_STATUSES)[number]

export const AI_EXECUTIVE_DELEGATION_STATUSES = [
  "issued",
  "monitoring",
  "completed",
  "escalated",
  "cancelled",
] as const

export type AiExecutiveDelegationStatus = (typeof AI_EXECUTIVE_DELEGATION_STATUSES)[number]

export const AI_EXECUTIVE_BRAIN_HEALTH_STATUSES = ["healthy", "degraded", "unhealthy", "offline"] as const

export type AiExecutiveBrainHealthStatus = (typeof AI_EXECUTIVE_BRAIN_HEALTH_STATUSES)[number]

export const AI_EXECUTIVE_BRAIN_HEARTBEAT_STALE_MS = 5 * 60 * 1000

/** Event categories the Executive Brain observes — infrastructure subscription only. */
export const AI_EXECUTIVE_BRAIN_EVENT_CATEGORIES = [
  "work_order",
  "agent",
  "decision",
  "memory",
] as const

export const AI_EXECUTIVE_BRAIN_EVENT_PREFIXES = [
  "work_order.",
  "agent.",
  "decision.",
  "memory.",
] as const

export type AiExecutiveBrainRuntime = {
  id: string
  organizationId: string
  instanceId: string
  runtimeStatus: AiExecutiveBrainRuntimeStatus
  healthStatus: AiExecutiveBrainHealthStatus
  activeMissionCount: number
  activeDelegationCount: number
  lastHeartbeatAt: string
  lastTickAt: string | null
  metadata: Record<string, unknown>
  qaMarker: string
  createdAt: string
  updatedAt: string
}

export type AiExecutiveMissionState = {
  id: string
  organizationId: string
  missionId: string
  executiveRuntimeId: string
  missionStatus: AiExecutiveMissionStatus
  pendingWorkOrderCount: number
  activeWorkOrderCount: number
  completedWorkOrderCount: number
  lastDelegatedAt: string | null
  lastMonitoredAt: string | null
  lastTickAt: string | null
  metadata: Record<string, unknown>
  qaMarker: string
  createdAt: string
  updatedAt: string
}

export type AiExecutiveDelegation = {
  id: string
  organizationId: string
  missionId: string
  executiveRuntimeId: string
  workOrderId: string
  assignedAgent: AiOsRuntimeAgent
  delegationStatus: AiExecutiveDelegationStatus
  delegatedAt: string
  completedAt: string | null
  metadata: Record<string, unknown>
  qaMarker: string
  createdAt: string
}

export type AiExecutiveHeartbeatEvent = {
  id: string
  executiveRuntimeId: string
  organizationId: string
  runtimeStatus: AiExecutiveBrainRuntimeStatus
  healthStatus: AiExecutiveBrainHealthStatus
  metadata: Record<string, unknown>
  createdAt: string
}

export type AiExecutiveEventObservation = {
  id: string
  organizationId: string
  executiveRuntimeId: string
  eventId: string | null
  eventCategory: string
  eventType: string
  missionId: string | null
  workOrderId: string | null
  metadata: Record<string, unknown>
  observedAt: string
  createdAt: string
}

export type AiExecutiveBrainStartInput = {
  organizationId: string
  instanceId: string
  metadata?: Record<string, unknown>
}

export type AiExecutiveBrainHeartbeatInput = {
  organizationId: string
  executiveRuntimeId: string
  runtimeStatus?: AiExecutiveBrainRuntimeStatus
  healthStatus?: AiExecutiveBrainHealthStatus
  metadata?: Record<string, unknown>
}

export type AiExecutiveDelegateWorkOrderInput = {
  organizationId: string
  executiveRuntimeId: string
  missionId: string
  workOrderType: AiWorkOrderType
  assignedAgent?: AiOsRuntimeAgent
  entityType?: string | null
  entityId?: string | null
  priority?: number
  payload?: Record<string, unknown>
  metadata?: Record<string, unknown>
  /** When true, invoke Decision Engine to attach a Decision Record before agents claim. */
  prepareDecision?: boolean
  /** Optional AI evidence enrichment via Decision Intelligence Bridge (GE-AIOS-3B). */
  enableAiEvidence?: boolean
  decisionKey?: string
}

export type AiExecutiveMonitorMissionInput = {
  organizationId: string
  executiveRuntimeId: string
  missionId: string
}

export type AiExecutiveEscalateDelegationInput = {
  organizationId: string
  executiveRuntimeId: string
  delegationId: string
  reason?: string | null
}

export type AiExecutiveCompleteMissionInput = {
  organizationId: string
  executiveRuntimeId: string
  missionId: string
}

export type AiExecutiveBrainHealthReport = {
  organizationId: string
  evaluatedAt: string
  staleThresholdMs: number
  runtimes: Array<{
    runtimeId: string
    instanceId: string
    runtimeStatus: AiExecutiveBrainRuntimeStatus
    healthStatus: AiExecutiveBrainHealthStatus
    lastHeartbeatAt: string
    stale: boolean
    activeMissionCount: number
    activeDelegationCount: number
  }>
}

export function isExecutiveBrainHeartbeatStale(
  lastHeartbeatAt: string,
  thresholdMs: number = AI_EXECUTIVE_BRAIN_HEARTBEAT_STALE_MS,
): boolean {
  const ts = Date.parse(lastHeartbeatAt)
  if (!Number.isFinite(ts)) return true
  return Date.now() - ts > thresholdMs
}

/** Executive Brain delegates Work Orders and may prepare Decision Records — it never claims or executes. */
export const AI_EXECUTIVE_BRAIN_RUNTIME_RULE =
  "Executive Brain observes Missions, delegates Work Orders, optionally prepares Decision Records, and monitors lifecycle — it never claims Work Orders, transitions to executing, or sends outbound." as const
