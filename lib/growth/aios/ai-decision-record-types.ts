/** GE-AIOS-2D — Decision Record types (client-safe). Constitutional §16.2. */

import {
  AI_WORK_ORDER_AGENTS,
  type AiWorkOrderAgent,
} from "@/lib/growth/aios/ai-work-order-types"

export const GROWTH_AIOS_2D_PHASE = "GE-AIOS-2D" as const

export const GROWTH_AI_DECISION_RECORD_QA_MARKER = "growth-aios-2d-decision-record-v1" as const

export const GROWTH_AI_DECISION_RECORD_SCHEMA_MIGRATION =
  "20271001150000_growth_aios_2d_decision_records.sql" as const

export const AI_DECISION_RECORD_SCHEMA_VERSION = "1.0" as const

/** Lifecycle audit events — record rows are never updated. */
export const AI_DECISION_RECORD_LIFECYCLE_EVENTS = [
  "created",
  "linked",
  "superseded",
  "referenced",
] as const

export type AiDecisionRecordLifecycleEvent = (typeof AI_DECISION_RECORD_LIFECYCLE_EVENTS)[number]

export type AiDecisionEvidenceRef = {
  evidenceKey: string
  sourceKey?: string | null
  snippet?: string | null
  trust?: number | null
  freshnessHours?: number | null
  weight?: number | null
  metadata?: Record<string, unknown>
}

export type AiDecisionActionRef = {
  actionKey: string
  label?: string | null
  metadata?: Record<string, unknown>
}

export type AiDecisionRecord = {
  id: string
  organizationId: string
  missionId: string
  workOrderId: string | null
  decisionKey: string
  ownerAgent: AiWorkOrderAgent
  entityType: string | null
  entityId: string | null
  evidenceBundle: AiDecisionEvidenceRef[]
  confidence: number
  riskScore: number
  expectedCostUsd: number
  expectedRoi: number | null
  expectedValueUsd: number | null
  explanation: string
  chosenAction: AiDecisionActionRef
  rejectedActions: AiDecisionActionRef[]
  outcome: Record<string, unknown> | null
  operatorOverride: Record<string, unknown> | null
  learning: Record<string, unknown>
  supersedesDecisionId: string | null
  schemaVersion: string
  auditMetadata: Record<string, unknown>
  qaMarker: string
  createdAt: string
}

export type AiDecisionRecordCreateInput = {
  organizationId: string
  missionId: string
  workOrderId?: string | null
  decisionKey: string
  ownerAgent: AiWorkOrderAgent
  entityType?: string | null
  entityId?: string | null
  evidenceBundle?: AiDecisionEvidenceRef[]
  confidence?: number
  riskScore?: number
  expectedCostUsd?: number
  expectedRoi?: number | null
  expectedValueUsd?: number | null
  explanation?: string
  chosenAction?: AiDecisionActionRef | Record<string, unknown>
  rejectedActions?: AiDecisionActionRef[]
  outcome?: Record<string, unknown> | null
  operatorOverride?: Record<string, unknown> | null
  learning?: Record<string, unknown>
  auditMetadata?: Record<string, unknown>
  linkToWorkOrder?: boolean
}

export type AiDecisionRecordSupersedeInput = {
  organizationId: string
  originalDecisionId: string
  updates: Omit<AiDecisionRecordCreateInput, "organizationId" | "linkToWorkOrder"> & {
    linkToWorkOrder?: boolean
  }
}

export type AiDecisionRecordLinkInput = {
  organizationId: string
  decisionRecordId: string
  workOrderId: string
}

export type AiDecisionRecordListFilter = {
  organizationId: string
  missionId?: string
  workOrderId?: string
  decisionKey?: string
  ownerAgent?: AiWorkOrderAgent
  entityType?: string
  entityId?: string
  limit?: number
}

export type AiDecisionRecordAuditEvent = {
  id: string
  decisionRecordId: string
  organizationId: string
  eventType: AiDecisionRecordLifecycleEvent
  workOrderId: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export function isAiDecisionOwnerAgent(value: unknown): value is AiWorkOrderAgent {
  return typeof value === "string" && (AI_WORK_ORDER_AGENTS as readonly string[]).includes(value)
}

export function clampDecisionConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

export function clampDecisionRiskScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

export function normalizeEvidenceBundle(value: unknown): AiDecisionEvidenceRef[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const ref = row as Record<string, unknown>
      return {
        evidenceKey: String(ref.evidenceKey ?? ref.evidence_key ?? ""),
        sourceKey: ref.sourceKey ? String(ref.sourceKey) : ref.source_key ? String(ref.source_key) : null,
        snippet: ref.snippet ? String(ref.snippet) : null,
        trust: typeof ref.trust === "number" ? ref.trust : null,
        freshnessHours:
          typeof ref.freshnessHours === "number"
            ? ref.freshnessHours
            : typeof ref.freshness_hours === "number"
              ? ref.freshness_hours
              : null,
        weight: typeof ref.weight === "number" ? ref.weight : null,
        metadata: ref.metadata && typeof ref.metadata === "object" ? (ref.metadata as Record<string, unknown>) : {},
      }
    })
    .filter((ref) => ref.evidenceKey.length > 0)
}

export function normalizeDecisionActions(value: unknown): AiDecisionActionRef[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const ref = row as Record<string, unknown>
      return {
        actionKey: String(ref.actionKey ?? ref.action_key ?? ""),
        label: ref.label ? String(ref.label) : null,
        metadata: ref.metadata && typeof ref.metadata === "object" ? (ref.metadata as Record<string, unknown>) : {},
      }
    })
    .filter((ref) => ref.actionKey.length > 0)
}

export function normalizeChosenAction(value: unknown): AiDecisionActionRef {
  if (!value || typeof value !== "object") return { actionKey: "unspecified" }
  const ref = value as Record<string, unknown>
  const actionKey = String(ref.actionKey ?? ref.action_key ?? "unspecified")
  return {
    actionKey,
    label: ref.label ? String(ref.label) : null,
    metadata: ref.metadata && typeof ref.metadata === "object" ? (ref.metadata as Record<string, unknown>) : {},
  }
}

/** Decision Records publish events; they do not invoke AI or providers. */
export const AI_DECISION_RECORD_RUNTIME_RULE =
  "Decision Records reference Work Orders and publish Events — they do not invoke AI, providers, or Memory." as const
