/** GE-AIOS-2J — Context Assembly types (client-safe). Constitutional §14. */

import type { AiDecisionEvidenceRef } from "@/lib/growth/aios/ai-decision-record-types"
import type { AiWorkOrderAgent, AiWorkOrderStatus, AiWorkOrderType } from "@/lib/growth/aios/ai-work-order-types"

export const GROWTH_AIOS_2J_PHASE = "GE-AIOS-2J" as const

export const GROWTH_AI_CONTEXT_ASSEMBLY_QA_MARKER =
  "growth-aios-2j-context-assembly-v1" as const

export const GROWTH_AI_CONTEXT_ASSEMBLY_SCHEMA_MIGRATION =
  "20271001190000_growth_aios_2j_context_assembly.sql" as const

export const AI_CONTEXT_PACKAGE_SCHEMA_VERSION = "1.0" as const

export const AI_CONTEXT_ASSEMBLY_VALIDATION_FAILURES = [
  "work_order_not_found",
  "work_order_mission_mismatch",
  "missing_work_order_context",
  "checksum_mismatch",
  "empty_evidence_bundle",
] as const

export type AiContextAssemblyValidationFailure =
  (typeof AI_CONTEXT_ASSEMBLY_VALIDATION_FAILURES)[number]

export type AiContextWorkOrderSection = {
  workOrderId: string
  missionId: string
  workOrderType: AiWorkOrderType
  status: AiWorkOrderStatus
  ownerAgent: AiWorkOrderAgent
  assignedAgent: AiWorkOrderAgent
  entityType: string | null
  entityId: string | null
  priority: number
  payload: Record<string, unknown>
  decisionRecordIds: string[]
  memoryRefIds: string[]
}

export type AiContextMissionSection = {
  missionId: string
  title: string
  objectiveType: string
  status: string
  currentValue: number
  targetValue: number
  autonomyLevel: string | null
  safetyMode: string | null
  currentStageId: string | null
  sourceTable: string
}

export type AiContextDecisionSummary = {
  decisionRecordId: string
  decisionKey: string
  confidence: number
  riskScore: number
  explanation: string
  createdAt: string
  sourceTable: string
}

export type AiContextMemoryReference = {
  memoryRegistryId: string
  memoryType: string
  sourceSystem: string
  sourceTable: string
  sourceRecordId: string | null
  label: string
}

export type AiContextEventSummary = {
  eventId: string
  eventType: string
  category: string
  occurredAt: string
  producer: string
}

export type AiContextEntityMetadata = {
  entityType: string
  entityId: string
  sourceSystem: string
  sourceTable: string
  projection: Record<string, unknown>
}

export type AiContextPackageContent = {
  contextVersion: string
  workOrderContext: AiContextWorkOrderSection
  missionContext: AiContextMissionSection | null
  decisionHistory: AiContextDecisionSummary[]
  memoryReferences: AiContextMemoryReference[]
  relatedEvents: AiContextEventSummary[]
  evidenceBundle: AiDecisionEvidenceRef[]
  entityMetadata: AiContextEntityMetadata | null
  sourceKeys: string[]
}

export type AiContextPackage = AiContextPackageContent & {
  id: string
  organizationId: string
  missionId: string
  workOrderId: string
  checksum: string
  reusedFromPackageId: string | null
  qaMarker: string
  createdAt: string
}

export type AiContextAssemblyInput = {
  organizationId: string
  workOrderId: string
  contextVersion?: string
  forceReassemble?: boolean
  source?: string
}

export type AiContextAssemblyResult = {
  contextPackage: AiContextPackage
  reused: boolean
}

export type AiContextAssemblyRuntime = {
  id: string
  organizationId: string
  assemblyCount: number
  reuseCount: number
  validationFailureCount: number
  lastAssembledAt: string | null
  metadata: Record<string, unknown>
  qaMarker: string
  createdAt: string
  updatedAt: string
}

/** Context Assembly reads only — never modifies sources or executes Work Orders. */
export const AI_CONTEXT_ASSEMBLY_RUNTIME_RULE =
  "Context Assembly gathers read-only context from AI OS subsystems into immutable Context Packages — it does not invoke LLMs, execute Work Orders, or create Decision Records." as const
