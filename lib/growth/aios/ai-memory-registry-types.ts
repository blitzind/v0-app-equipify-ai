/** GE-AIOS-2F — Memory Registry types (client-safe). Constitutional §8. */

import {
  AI_WORK_ORDER_AGENTS,
  type AiWorkOrderAgent,
} from "@/lib/growth/aios/ai-work-order-types"

export const GROWTH_AIOS_2F_PHASE = "GE-AIOS-2F" as const

export const GROWTH_AI_MEMORY_REGISTRY_QA_MARKER = "growth-aios-2f-memory-registry-v1" as const

export const GROWTH_AI_MEMORY_REGISTRY_SCHEMA_MIGRATION =
  "20271001160000_growth_aios_2f_memory_registry.sql" as const

export const AI_MEMORY_REGISTRY_SCHEMA_VERSION = "1.0" as const

/** Constitutional memory categories for AI OS registry (GE-AIOS-2F scope). */
export const AI_MEMORY_REGISTRY_TYPES = [
  "organization",
  "mission",
  "company",
  "lead",
  "relationship",
  "conversation",
  "research",
  "decision",
  "provider",
  "playbook",
  "strategy",
] as const

export type AiMemoryRegistryType = (typeof AI_MEMORY_REGISTRY_TYPES)[number]

export const AI_MEMORY_REGISTRY_LIFECYCLE_STATUSES = [
  "observed",
  "created",
  "active",
  "referenced",
  "archived",
  "forgotten",
] as const

export type AiMemoryRegistryLifecycleStatus = (typeof AI_MEMORY_REGISTRY_LIFECYCLE_STATUSES)[number]

export const AI_MEMORY_REGISTRY_LIFECYCLE_EVENTS = [
  "created",
  "updated",
  "referenced",
  "linked",
  "archived",
] as const

export type AiMemoryRegistryLifecycleEvent = (typeof AI_MEMORY_REGISTRY_LIFECYCLE_EVENTS)[number]

export const AI_MEMORY_RETENTION_POLICIES = ["standard", "permanent"] as const

export type AiMemoryRetentionPolicy = (typeof AI_MEMORY_RETENTION_POLICIES)[number]

export const AI_MEMORY_PRIVACY_SCOPES = ["organization", "mission", "entity"] as const

export type AiMemoryPrivacyScope = (typeof AI_MEMORY_PRIVACY_SCOPES)[number]

export type AiMemorySourceRef = {
  sourceSystem: string
  sourceTable: string
  sourceRecordId?: string | null
  sourceKey?: string | null
}

export type AiMemoryRegistryEntry = {
  id: string
  organizationId: string
  missionId: string | null
  memoryType: AiMemoryRegistryType
  ownerAgent: AiWorkOrderAgent
  entityType: string | null
  entityId: string | null
  sourceSystem: string
  sourceTable: string
  sourceRecordId: string | null
  sourceKey: string | null
  label: string
  description: string
  lifecycleStatus: AiMemoryRegistryLifecycleStatus
  retentionPolicy: AiMemoryRetentionPolicy
  privacyScope: AiMemoryPrivacyScope
  schemaVersion: string
  auditMetadata: Record<string, unknown>
  qaMarker: string
  createdAt: string
  updatedAt: string
  referencedAt: string | null
  archivedAt: string | null
}

export type AiMemoryRegistryRegisterInput = {
  organizationId: string
  missionId?: string | null
  memoryType: AiMemoryRegistryType
  ownerAgent?: AiWorkOrderAgent
  entityType?: string | null
  entityId?: string | null
  sourceSystem: string
  sourceTable: string
  sourceRecordId?: string | null
  sourceKey?: string | null
  label?: string
  description?: string
  lifecycleStatus?: AiMemoryRegistryLifecycleStatus
  retentionPolicy?: AiMemoryRetentionPolicy
  privacyScope?: AiMemoryPrivacyScope
  auditMetadata?: Record<string, unknown>
}

export type AiMemoryRegistryReferenceInput = {
  organizationId: string
  memoryRegistryId: string
  workOrderId?: string | null
  decisionRecordId?: string | null
  metadata?: Record<string, unknown>
}

export type AiMemoryRegistryLinkWorkOrderInput = {
  organizationId: string
  memoryRegistryId: string
  workOrderId: string
}

export type AiMemoryRegistryLinkDecisionRecordInput = {
  organizationId: string
  memoryRegistryId: string
  decisionRecordId: string
}

export type AiMemoryRegistryArchiveInput = {
  organizationId: string
  memoryRegistryId: string
  reason?: string | null
}

export type AiMemoryRegistryListFilter = {
  organizationId: string
  missionId?: string
  memoryType?: AiMemoryRegistryType
  ownerAgent?: AiWorkOrderAgent
  entityType?: string
  entityId?: string
  lifecycleStatus?: AiMemoryRegistryLifecycleStatus | AiMemoryRegistryLifecycleStatus[]
  sourceSystem?: string
  sourceTable?: string
  limit?: number
}

export type AiMemoryRegistryAuditEvent = {
  id: string
  memoryRegistryId: string
  organizationId: string
  eventType: AiMemoryRegistryLifecycleEvent
  workOrderId: string | null
  decisionRecordId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export function isAiMemoryRegistryType(value: unknown): value is AiMemoryRegistryType {
  return typeof value === "string" && (AI_MEMORY_REGISTRY_TYPES as readonly string[]).includes(value)
}

export function isAiMemoryOwnerAgent(value: unknown): value is AiWorkOrderAgent {
  return typeof value === "string" && (AI_WORK_ORDER_AGENTS as readonly string[]).includes(value)
}

export function normalizeMemorySourceRef(value: unknown): AiMemorySourceRef | null {
  if (!value || typeof value !== "object") return null
  const ref = value as Record<string, unknown>
  const sourceSystem = String(ref.sourceSystem ?? ref.source_system ?? "").trim()
  const sourceTable = String(ref.sourceTable ?? ref.source_table ?? "").trim()
  if (!sourceSystem || !sourceTable) return null
  return {
    sourceSystem,
    sourceTable,
    sourceRecordId: ref.sourceRecordId ? String(ref.sourceRecordId) : ref.source_record_id ? String(ref.source_record_id) : null,
    sourceKey: ref.sourceKey ? String(ref.sourceKey) : ref.source_key ? String(ref.source_key) : null,
  }
}

/** Memory Registry owns metadata only — it references existing stores and does not invoke AI. */
export const AI_MEMORY_REGISTRY_RUNTIME_RULE =
  "Memory Registry references existing Growth stores and publishes Events — it does not summarize, learn, or invoke AI." as const
