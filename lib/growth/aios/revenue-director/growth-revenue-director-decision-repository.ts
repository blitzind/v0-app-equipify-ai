/** GE-AI-3B — Revenue Director decision ledger repository (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  GrowthRevenueDirectorDecisionEventRecord,
  GrowthRevenueDirectorDecisionEventType,
  GrowthRevenueDirectorDecisionRecord,
  GrowthRevenueDirectorDecisionStatus,
  GrowthRevenueDirectorDecisionType,
  GrowthRevenueDirectorWorkflowRequestRecord,
  GrowthRevenueDirectorWorkflowRequestStatus,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-decision-types"
import {
  GROWTH_REVENUE_DIRECTOR_DECISION_EVENT_TYPES,
  GROWTH_REVENUE_DIRECTOR_DECISION_STATUSES,
  GROWTH_REVENUE_DIRECTOR_DECISION_TYPES,
  GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_QA_MARKER,
  GROWTH_REVENUE_DIRECTOR_WORKFLOW_REQUEST_STATUSES,
} from "@/lib/growth/aios/revenue-director/growth-revenue-director-decision-types"
import type { GrowthRevenueDirectorWorkflowRequestType } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"
import { GROWTH_REVENUE_DIRECTOR_WORKFLOW_REQUEST_TYPES } from "@/lib/growth/aios/revenue-director/growth-revenue-director-types"

type DecisionRow = {
  id: string
  organization_id: string
  snapshot_hash: string
  decision_type: string
  status: string
  title: string
  summary: string
  confidence: number
  priority_score: number
  evidence: unknown
  risks: unknown
  created_at: string
  updated_at: string
  superseded_at: string | null
}

type WorkflowRequestRow = {
  id: string
  organization_id: string
  decision_id: string
  request_type: string
  target_workflow_agent: string
  status: string
  advisory: boolean
  subject_type: string | null
  subject_id: string | null
  objective_id: string | null
  mission_id: string | null
  lead_id: string | null
  title: string
  summary: string
  priority_score: number
  requires_human_approval: boolean
  idempotency_key: string
  correlation_id: string
  evidence: unknown
  route: string | null
  created_at: string
  updated_at: string
  accepted_at: string | null
  dispatched_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  superseded_at: string | null
}

type EventRow = {
  id: string
  organization_id: string
  decision_id: string | null
  workflow_request_id: string | null
  event_type: string
  payload: Record<string, unknown> | null
  created_at: string
}

const DECISION_SELECT =
  "id, organization_id, snapshot_hash, decision_type, status, title, summary, confidence, priority_score, evidence, risks, created_at, updated_at, superseded_at"

const WORKFLOW_REQUEST_SELECT =
  "id, organization_id, decision_id, request_type, target_workflow_agent, status, advisory, subject_type, subject_id, objective_id, mission_id, lead_id, title, summary, priority_score, requires_human_approval, idempotency_key, correlation_id, evidence, route, created_at, updated_at, accepted_at, dispatched_at, completed_at, cancelled_at, superseded_at"

const EVENT_SELECT =
  "id, organization_id, decision_id, workflow_request_id, event_type, payload, created_at"

function decisionsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("revenue_director_decisions")
}

function workflowRequestsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("revenue_director_workflow_requests")
}

function eventsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("revenue_director_decision_events")
}

function isDecisionType(value: string): value is GrowthRevenueDirectorDecisionType {
  return (GROWTH_REVENUE_DIRECTOR_DECISION_TYPES as readonly string[]).includes(value)
}

function isDecisionStatus(value: string): value is GrowthRevenueDirectorDecisionStatus {
  return (GROWTH_REVENUE_DIRECTOR_DECISION_STATUSES as readonly string[]).includes(value)
}

function isWorkflowRequestStatus(value: string): value is GrowthRevenueDirectorWorkflowRequestStatus {
  return (GROWTH_REVENUE_DIRECTOR_WORKFLOW_REQUEST_STATUSES as readonly string[]).includes(value)
}

function isWorkflowRequestType(value: string): value is GrowthRevenueDirectorWorkflowRequestType {
  return (GROWTH_REVENUE_DIRECTOR_WORKFLOW_REQUEST_TYPES as readonly string[]).includes(value)
}

function isEventType(value: string): value is GrowthRevenueDirectorDecisionEventType {
  return (GROWTH_REVENUE_DIRECTOR_DECISION_EVENT_TYPES as readonly string[]).includes(value)
}

function normalizeEvidence(value: unknown): GrowthRevenueDirectorDecisionRecord["evidence"] {
  if (!Array.isArray(value)) return []
  return value
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const record = row as Record<string, unknown>
      return {
        source: String(record.source ?? "unknown"),
        label: String(record.label ?? ""),
        value: record.value as string | number | boolean | undefined,
      }
    })
}

function normalizeRisks(value: unknown): GrowthRevenueDirectorDecisionRecord["risks"] {
  if (!Array.isArray(value)) return []
  return value
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const record = row as Record<string, unknown>
      return {
        label: String(record.label ?? ""),
        severity: String(record.severity ?? "medium"),
        summary: String(record.summary ?? ""),
      }
    })
}

export function mapRevenueDirectorDecisionRow(row: DecisionRow): GrowthRevenueDirectorDecisionRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    snapshotHash: row.snapshot_hash,
    decisionType: isDecisionType(row.decision_type) ? row.decision_type : "executive_orchestration_snapshot",
    status: isDecisionStatus(row.status) ? row.status : "proposed",
    title: row.title,
    summary: row.summary ?? "",
    confidence: Number(row.confidence ?? 0),
    priorityScore: Number(row.priority_score ?? 0),
    evidence: normalizeEvidence(row.evidence),
    risks: normalizeRisks(row.risks),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    supersededAt: row.superseded_at,
  }
}

export function mapRevenueDirectorWorkflowRequestRow(
  row: WorkflowRequestRow,
): GrowthRevenueDirectorWorkflowRequestRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    decisionId: row.decision_id,
    requestType: isWorkflowRequestType(row.request_type) ? row.request_type : "wait",
    targetWorkflowAgent: row.target_workflow_agent,
    status: isWorkflowRequestStatus(row.status) ? row.status : "proposed",
    advisory: true,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    objectiveId: row.objective_id,
    missionId: row.mission_id,
    leadId: row.lead_id,
    title: row.title,
    summary: row.summary ?? "",
    priorityScore: Number(row.priority_score ?? 0),
    requiresHumanApproval: row.requires_human_approval,
    idempotencyKey: row.idempotency_key,
    correlationId: row.correlation_id,
    evidence: normalizeEvidence(row.evidence),
    route: row.route,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    acceptedAt: row.accepted_at,
    dispatchedAt: row.dispatched_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    supersededAt: row.superseded_at,
  }
}

export function mapRevenueDirectorDecisionEventRow(row: EventRow): GrowthRevenueDirectorDecisionEventRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    decisionId: row.decision_id,
    workflowRequestId: row.workflow_request_id,
    eventType: isEventType(row.event_type) ? row.event_type : "proposed",
    payload: row.payload ?? {},
    createdAt: row.created_at,
  }
}

export function revenueDirectorDecisionLedgerSchemaCatalog() {
  return {
    qaMarker: GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_QA_MARKER,
    tables: [
      "revenue_director_decisions",
      "revenue_director_workflow_requests",
      "revenue_director_decision_events",
    ],
  }
}

export async function fetchRevenueDirectorDecisionBySnapshotHash(
  admin: SupabaseClient,
  input: { organizationId: string; snapshotHash: string },
): Promise<GrowthRevenueDirectorDecisionRecord | null> {
  const { data, error } = await decisionsTable(admin)
    .select(DECISION_SELECT)
    .eq("organization_id", input.organizationId)
    .eq("snapshot_hash", input.snapshotHash)
    .in("status", ["proposed", "accepted"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRevenueDirectorDecisionRow(data as DecisionRow) : null
}

export async function fetchRevenueDirectorDecisionById(
  admin: SupabaseClient,
  input: { organizationId: string; decisionId: string },
): Promise<GrowthRevenueDirectorDecisionRecord | null> {
  const { data, error } = await decisionsTable(admin)
    .select(DECISION_SELECT)
    .eq("organization_id", input.organizationId)
    .eq("id", input.decisionId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRevenueDirectorDecisionRow(data as DecisionRow) : null
}

export async function insertRevenueDirectorDecision(
  admin: SupabaseClient,
  input: {
    organizationId: string
    snapshotHash: string
    decisionType?: GrowthRevenueDirectorDecisionType
    title: string
    summary: string
    confidence: number
    priorityScore: number
    evidence: GrowthRevenueDirectorDecisionRecord["evidence"]
    risks: GrowthRevenueDirectorDecisionRecord["risks"]
  },
): Promise<GrowthRevenueDirectorDecisionRecord> {
  const existing = await fetchRevenueDirectorDecisionBySnapshotHash(admin, {
    organizationId: input.organizationId,
    snapshotHash: input.snapshotHash,
  })
  if (existing) return existing

  const { data, error } = await decisionsTable(admin)
    .insert({
      organization_id: input.organizationId,
      snapshot_hash: input.snapshotHash,
      decision_type: input.decisionType ?? "executive_orchestration_snapshot",
      status: "proposed",
      title: input.title,
      summary: input.summary,
      confidence: input.confidence,
      priority_score: input.priorityScore,
      evidence: input.evidence,
      risks: input.risks,
      qa_marker: GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_QA_MARKER,
    })
    .select(DECISION_SELECT)
    .single()

  if (error) {
    if (error.message.includes("duplicate")) {
      const retry = await fetchRevenueDirectorDecisionBySnapshotHash(admin, {
        organizationId: input.organizationId,
        snapshotHash: input.snapshotHash,
      })
      if (retry) return retry
    }
    throw new Error(error.message)
  }
  return mapRevenueDirectorDecisionRow(data as DecisionRow)
}

export async function updateRevenueDirectorDecisionStatus(
  admin: SupabaseClient,
  input: {
    organizationId: string
    decisionId: string
    status: GrowthRevenueDirectorDecisionStatus
    supersededAt?: string | null
  },
): Promise<GrowthRevenueDirectorDecisionRecord> {
  const patch: Record<string, unknown> = { status: input.status }
  if (input.supersededAt !== undefined) patch.superseded_at = input.supersededAt

  const { data, error } = await decisionsTable(admin)
    .update(patch)
    .eq("organization_id", input.organizationId)
    .eq("id", input.decisionId)
    .select(DECISION_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapRevenueDirectorDecisionRow(data as DecisionRow)
}

export async function fetchRevenueDirectorWorkflowRequestById(
  admin: SupabaseClient,
  input: { organizationId: string; workflowRequestId: string },
): Promise<GrowthRevenueDirectorWorkflowRequestRecord | null> {
  const { data, error } = await workflowRequestsTable(admin)
    .select(WORKFLOW_REQUEST_SELECT)
    .eq("organization_id", input.organizationId)
    .eq("id", input.workflowRequestId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRevenueDirectorWorkflowRequestRow(data as WorkflowRequestRow) : null
}

export async function fetchRevenueDirectorWorkflowRequestByIdempotencyKey(
  admin: SupabaseClient,
  input: { organizationId: string; idempotencyKey: string },
): Promise<GrowthRevenueDirectorWorkflowRequestRecord | null> {
  const { data, error } = await workflowRequestsTable(admin)
    .select(WORKFLOW_REQUEST_SELECT)
    .eq("organization_id", input.organizationId)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRevenueDirectorWorkflowRequestRow(data as WorkflowRequestRow) : null
}

export async function insertRevenueDirectorWorkflowRequest(
  admin: SupabaseClient,
  input: Omit<GrowthRevenueDirectorWorkflowRequestRecord, "id" | "createdAt" | "updatedAt"> & {
    id?: string
  },
): Promise<GrowthRevenueDirectorWorkflowRequestRecord> {
  const existing = await fetchRevenueDirectorWorkflowRequestByIdempotencyKey(admin, {
    organizationId: input.organizationId,
    idempotencyKey: input.idempotencyKey,
  })
  if (existing) return existing

  const { data, error } = await workflowRequestsTable(admin)
    .insert({
      id: input.id,
      organization_id: input.organizationId,
      decision_id: input.decisionId,
      request_type: input.requestType,
      target_workflow_agent: input.targetWorkflowAgent,
      status: input.status,
      advisory: true,
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      objective_id: input.objectiveId,
      mission_id: input.missionId,
      lead_id: input.leadId,
      title: input.title,
      summary: input.summary,
      priority_score: input.priorityScore,
      requires_human_approval: input.requiresHumanApproval,
      idempotency_key: input.idempotencyKey,
      correlation_id: input.correlationId,
      evidence: input.evidence,
      route: input.route,
      qa_marker: GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_QA_MARKER,
    })
    .select(WORKFLOW_REQUEST_SELECT)
    .single()

  if (error) {
    if (error.message.includes("duplicate")) {
      const retry = await fetchRevenueDirectorWorkflowRequestByIdempotencyKey(admin, {
        organizationId: input.organizationId,
        idempotencyKey: input.idempotencyKey,
      })
      if (retry) return retry
    }
    throw new Error(error.message)
  }
  return mapRevenueDirectorWorkflowRequestRow(data as WorkflowRequestRow)
}

export async function updateRevenueDirectorWorkflowRequestStatus(
  admin: SupabaseClient,
  input: {
    organizationId: string
    workflowRequestId: string
    status: GrowthRevenueDirectorWorkflowRequestStatus
    acceptedAt?: string | null
    dispatchedAt?: string | null
    cancelledAt?: string | null
    completedAt?: string | null
    supersededAt?: string | null
  },
): Promise<GrowthRevenueDirectorWorkflowRequestRecord> {
  const patch: Record<string, unknown> = { status: input.status }
  if (input.acceptedAt !== undefined) patch.accepted_at = input.acceptedAt
  if (input.dispatchedAt !== undefined) patch.dispatched_at = input.dispatchedAt
  if (input.cancelledAt !== undefined) patch.cancelled_at = input.cancelledAt
  if (input.completedAt !== undefined) patch.completed_at = input.completedAt
  if (input.supersededAt !== undefined) patch.superseded_at = input.supersededAt

  const { data, error } = await workflowRequestsTable(admin)
    .update(patch)
    .eq("organization_id", input.organizationId)
    .eq("id", input.workflowRequestId)
    .select(WORKFLOW_REQUEST_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapRevenueDirectorWorkflowRequestRow(data as WorkflowRequestRow)
}

export async function insertRevenueDirectorDecisionEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    decisionId?: string | null
    workflowRequestId?: string | null
    eventType: GrowthRevenueDirectorDecisionEventType
    payload?: Record<string, unknown>
  },
): Promise<GrowthRevenueDirectorDecisionEventRecord> {
  const { data, error } = await eventsTable(admin)
    .insert({
      organization_id: input.organizationId,
      decision_id: input.decisionId ?? null,
      workflow_request_id: input.workflowRequestId ?? null,
      event_type: input.eventType,
      payload: input.payload ?? {},
      qa_marker: GROWTH_REVENUE_DIRECTOR_DECISION_LEDGER_QA_MARKER,
    })
    .select(EVENT_SELECT)
    .single()
  if (error) throw new Error(error.message)
  return mapRevenueDirectorDecisionEventRow(data as EventRow)
}

export async function listRevenueDirectorDecisionsForOrganization(
  admin: SupabaseClient,
  input: { organizationId: string; status?: GrowthRevenueDirectorDecisionStatus[]; limit?: number },
): Promise<GrowthRevenueDirectorDecisionRecord[]> {
  let query = decisionsTable(admin)
    .select(DECISION_SELECT)
    .eq("organization_id", input.organizationId)
    .order("updated_at", { ascending: false })

  if (input.status?.length) query = query.in("status", input.status)
  if (input.limit) query = query.limit(input.limit)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapRevenueDirectorDecisionRow(row as DecisionRow))
}

export async function listRevenueDirectorWorkflowRequestsForOrganization(
  admin: SupabaseClient,
  input: {
    organizationId: string
    status?: GrowthRevenueDirectorWorkflowRequestStatus[]
    decisionId?: string
    limit?: number
  },
): Promise<GrowthRevenueDirectorWorkflowRequestRecord[]> {
  let query = workflowRequestsTable(admin)
    .select(WORKFLOW_REQUEST_SELECT)
    .eq("organization_id", input.organizationId)
    .order("priority_score", { ascending: false })

  if (input.status?.length) query = query.in("status", input.status)
  if (input.decisionId) query = query.eq("decision_id", input.decisionId)
  if (input.limit) query = query.limit(input.limit)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapRevenueDirectorWorkflowRequestRow(row as WorkflowRequestRow))
}

export async function listRevenueDirectorDecisionEventsForOrganization(
  admin: SupabaseClient,
  input: { organizationId: string; limit?: number },
): Promise<GrowthRevenueDirectorDecisionEventRecord[]> {
  const { data, error } = await eventsTable(admin)
    .select(EVENT_SELECT)
    .eq("organization_id", input.organizationId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 50)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapRevenueDirectorDecisionEventRow(row as EventRow))
}

export async function supersedeStaleRevenueDirectorDecisions(
  admin: SupabaseClient,
  input: { organizationId: string; currentSnapshotHash: string; supersededAt: string },
): Promise<GrowthRevenueDirectorDecisionRecord[]> {
  const { data, error } = await decisionsTable(admin)
    .update({ status: "superseded", superseded_at: input.supersededAt })
    .eq("organization_id", input.organizationId)
    .eq("status", "proposed")
    .neq("snapshot_hash", input.currentSnapshotHash)
    .select(DECISION_SELECT)

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapRevenueDirectorDecisionRow(row as DecisionRow))
}
