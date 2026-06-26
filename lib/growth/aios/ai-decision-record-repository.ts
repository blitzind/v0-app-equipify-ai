/** GE-AIOS-2D — Decision Record persistence (server-only, insert-only records). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  AI_DECISION_RECORD_LIFECYCLE_EVENTS,
  GROWTH_AI_DECISION_RECORD_QA_MARKER,
  AI_DECISION_RECORD_SCHEMA_VERSION,
  clampDecisionConfidence,
  clampDecisionRiskScore,
  isAiDecisionOwnerAgent,
  normalizeChosenAction,
  normalizeDecisionActions,
  normalizeEvidenceBundle,
  type AiDecisionRecord,
  type AiDecisionRecordAuditEvent,
  type AiDecisionRecordCreateInput,
  type AiDecisionRecordLifecycleEvent,
  type AiDecisionRecordListFilter,
} from "@/lib/growth/aios/ai-decision-record-types"
import type { AiWorkOrderAgent } from "@/lib/growth/aios/ai-work-order-types"

type DecisionRow = {
  id: string
  organization_id: string
  mission_id: string
  work_order_id: string | null
  decision_key: string
  owner_agent: string
  entity_type: string | null
  entity_id: string | null
  evidence_bundle: unknown
  confidence: number
  risk_score: number
  expected_cost_usd: number
  expected_roi: number | null
  expected_value_usd: number | null
  explanation: string
  chosen_action: unknown
  rejected_actions: unknown
  outcome: Record<string, unknown> | null
  operator_override: Record<string, unknown> | null
  learning: Record<string, unknown> | null
  supersedes_decision_id: string | null
  schema_version: string
  audit_metadata: Record<string, unknown> | null
  qa_marker: string
  created_at: string
}

type AuditRow = {
  id: string
  decision_record_id: string
  organization_id: string
  event_type: string
  work_order_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

function decisionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_decision_records")
}

function auditTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_decision_record_audit_events")
}

function normalizeLifecycle(value: unknown): AiDecisionRecordLifecycleEvent {
  if (typeof value === "string" && (AI_DECISION_RECORD_LIFECYCLE_EVENTS as readonly string[]).includes(value)) {
    return value as AiDecisionRecordLifecycleEvent
  }
  return "created"
}

function mapDecision(row: DecisionRow): AiDecisionRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    missionId: row.mission_id,
    workOrderId: row.work_order_id,
    decisionKey: row.decision_key,
    ownerAgent: (isAiDecisionOwnerAgent(row.owner_agent) ? row.owner_agent : "research") as AiWorkOrderAgent,
    entityType: row.entity_type,
    entityId: row.entity_id,
    evidenceBundle: normalizeEvidenceBundle(row.evidence_bundle),
    confidence: clampDecisionConfidence(Number(row.confidence ?? 0)),
    riskScore: clampDecisionRiskScore(Number(row.risk_score ?? 0)),
    expectedCostUsd: Number(row.expected_cost_usd ?? 0),
    expectedRoi: row.expected_roi == null ? null : Number(row.expected_roi),
    expectedValueUsd: row.expected_value_usd == null ? null : Number(row.expected_value_usd),
    explanation: row.explanation ?? "",
    chosenAction: normalizeChosenAction(row.chosen_action),
    rejectedActions: normalizeDecisionActions(row.rejected_actions),
    outcome: row.outcome ?? null,
    operatorOverride: row.operator_override ?? null,
    learning: row.learning ?? {},
    supersedesDecisionId: row.supersedes_decision_id,
    schemaVersion: row.schema_version,
    auditMetadata: row.audit_metadata ?? {},
    qaMarker: row.qa_marker,
    createdAt: row.created_at,
  }
}

function mapAudit(row: AuditRow): AiDecisionRecordAuditEvent {
  return {
    id: row.id,
    decisionRecordId: row.decision_record_id,
    organizationId: row.organization_id,
    eventType: normalizeLifecycle(row.event_type),
    workOrderId: row.work_order_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  }
}

export async function insertAiDecisionRecord(
  admin: SupabaseClient,
  input: AiDecisionRecordCreateInput & { supersedesDecisionId?: string | null },
): Promise<AiDecisionRecord> {
  if (!isAiDecisionOwnerAgent(input.ownerAgent)) throw new Error("ai_decision_invalid_owner_agent")

  const row = {
    organization_id: input.organizationId,
    mission_id: input.missionId,
    work_order_id: input.workOrderId ?? null,
    decision_key: input.decisionKey,
    owner_agent: input.ownerAgent,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    evidence_bundle: input.evidenceBundle ?? [],
    confidence: clampDecisionConfidence(input.confidence ?? 0),
    risk_score: clampDecisionRiskScore(input.riskScore ?? 0),
    expected_cost_usd: input.expectedCostUsd ?? 0,
    expected_roi: input.expectedRoi ?? null,
    expected_value_usd: input.expectedValueUsd ?? null,
    explanation: input.explanation ?? "",
    chosen_action: input.chosenAction ?? { actionKey: "unspecified" },
    rejected_actions: input.rejectedActions ?? [],
    outcome: input.outcome ?? null,
    operator_override: input.operatorOverride ?? null,
    learning: input.learning ?? {},
    supersedes_decision_id: input.supersedesDecisionId ?? null,
    schema_version: AI_DECISION_RECORD_SCHEMA_VERSION,
    audit_metadata: input.auditMetadata ?? {},
    qa_marker: GROWTH_AI_DECISION_RECORD_QA_MARKER,
  }

  const { data, error } = await decisionsTable(admin).insert(row).select("*").single()
  if (error) throw new Error(error.message)
  return mapDecision(data as DecisionRow)
}

export async function fetchAiDecisionRecordById(
  admin: SupabaseClient,
  input: { organizationId: string; decisionRecordId: string },
): Promise<AiDecisionRecord | null> {
  const { data, error } = await decisionsTable(admin)
    .select("*")
    .eq("id", input.decisionRecordId)
    .eq("organization_id", input.organizationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapDecision(data as DecisionRow) : null
}

export async function fetchAiDecisionRecordsByIds(
  admin: SupabaseClient,
  input: { organizationId: string; decisionRecordIds: string[] },
): Promise<AiDecisionRecord[]> {
  if (input.decisionRecordIds.length === 0) return []

  const { data, error } = await decisionsTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .in("id", input.decisionRecordIds)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapDecision(row as DecisionRow))
}

export async function listAiDecisionRecords(
  admin: SupabaseClient,
  filter: AiDecisionRecordListFilter,
): Promise<AiDecisionRecord[]> {
  let query = decisionsTable(admin).select("*").eq("organization_id", filter.organizationId)

  if (filter.missionId) query = query.eq("mission_id", filter.missionId)
  if (filter.workOrderId) query = query.eq("work_order_id", filter.workOrderId)
  if (filter.decisionKey) query = query.eq("decision_key", filter.decisionKey)
  if (filter.ownerAgent) query = query.eq("owner_agent", filter.ownerAgent)
  if (filter.entityType) query = query.eq("entity_type", filter.entityType)
  if (filter.entityId) query = query.eq("entity_id", filter.entityId)

  query = query.order("created_at", { ascending: false })
  if (filter.limit) query = query.limit(filter.limit)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapDecision(row as DecisionRow))
}

export async function insertAiDecisionRecordAuditEvent(
  admin: SupabaseClient,
  input: {
    decisionRecordId: string
    organizationId: string
    eventType: AiDecisionRecordLifecycleEvent
    workOrderId?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<AiDecisionRecordAuditEvent> {
  const row = {
    decision_record_id: input.decisionRecordId,
    organization_id: input.organizationId,
    event_type: input.eventType,
    work_order_id: input.workOrderId ?? null,
    metadata: input.metadata ?? {},
  }

  const { data, error } = await auditTable(admin).insert(row).select("*").single()
  if (error) throw new Error(error.message)
  return mapAudit(data as AuditRow)
}

export async function listAiDecisionRecordAuditEvents(
  admin: SupabaseClient,
  input: { organizationId: string; decisionRecordId: string; limit?: number },
): Promise<AiDecisionRecordAuditEvent[]> {
  let query = auditTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("decision_record_id", input.decisionRecordId)
    .order("created_at", { ascending: false })

  if (input.limit) query = query.limit(input.limit)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapAudit(row as AuditRow))
}

export function aiDecisionRecordSchemaCatalog() {
  return {
    lifecycleEvents: [...AI_DECISION_RECORD_LIFECYCLE_EVENTS],
    schemaVersion: AI_DECISION_RECORD_SCHEMA_VERSION,
    qaMarker: GROWTH_AI_DECISION_RECORD_QA_MARKER,
  }
}
