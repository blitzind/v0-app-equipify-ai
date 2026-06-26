/** GE-AIOS-2H — Decision Engine persistence (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  normalizeDecisionActions,
  normalizeEvidenceBundle,
  type AiDecisionEvidenceRef,
} from "@/lib/growth/aios/ai-decision-record-types"
import type {
  AiDecisionEngineRecommendation,
  AiDecisionEngineRequest,
  AiDecisionEngineRequestStatus,
  AiDecisionEngineRuntime,
} from "@/lib/growth/aios/ai-decision-engine-types"
import {
  AI_DECISION_ENGINE_REQUEST_STATUSES,
  GROWTH_AI_DECISION_ENGINE_QA_MARKER,
} from "@/lib/growth/aios/ai-decision-engine-types"

type RuntimeRow = {
  id: string
  organization_id: string
  degraded: boolean
  degraded_reason: string | null
  evaluation_count: number
  insufficient_evidence_count: number
  last_evaluation_at: string | null
  last_success_at: string | null
  metadata: Record<string, unknown> | null
  qa_marker: string
  created_at: string
  updated_at: string
}

type RequestRow = {
  id: string
  organization_id: string
  mission_id: string
  work_order_id: string
  decision_key: string
  request_status: string
  evidence_bundle: unknown
  evaluation: Record<string, unknown> | null
  recommendation: Record<string, unknown> | null
  confidence: number
  risk_score: number
  expected_cost_usd: number
  decision_record_id: string | null
  degraded_mode: boolean
  qa_marker: string
  created_at: string
}

function runtimeTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_decision_engine_runtime")
}

function requestTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_decision_engine_requests")
}

function normalizeRequestStatus(value: unknown): AiDecisionEngineRequestStatus {
  if (typeof value === "string" && (AI_DECISION_ENGINE_REQUEST_STATUSES as readonly string[]).includes(value)) {
    return value as AiDecisionEngineRequestStatus
  }
  return "pending"
}

function mapRecommendation(value: unknown): AiDecisionEngineRecommendation {
  if (!value || typeof value !== "object") {
    return {
      chosenAction: { actionKey: "unspecified" },
      rejectedActions: [],
      explanation: "",
      confidenceBand: "insufficient",
      proceed: false,
    }
  }
  const row = value as Record<string, unknown>
  const chosen = row.chosenAction ?? row.chosen_action
  return {
    chosenAction:
      chosen && typeof chosen === "object"
        ? {
            actionKey: String((chosen as Record<string, unknown>).actionKey ?? "unspecified"),
            label: (chosen as Record<string, unknown>).label
              ? String((chosen as Record<string, unknown>).label)
              : null,
          }
        : { actionKey: "unspecified" },
    rejectedActions: normalizeDecisionActions(row.rejectedActions ?? row.rejected_actions),
    explanation: String(row.explanation ?? ""),
    confidenceBand: (row.confidenceBand ?? row.confidence_band ?? "insufficient") as AiDecisionEngineRecommendation["confidenceBand"],
    proceed: Boolean(row.proceed),
  }
}

function mapRequest(row: RequestRow): AiDecisionEngineRequest {
  return {
    id: row.id,
    organizationId: row.organization_id,
    missionId: row.mission_id,
    workOrderId: row.work_order_id,
    decisionKey: row.decision_key,
    requestStatus: normalizeRequestStatus(row.request_status),
    evidenceBundle: normalizeEvidenceBundle(row.evidence_bundle),
    evaluation: row.evaluation ?? {},
    recommendation: mapRecommendation(row.recommendation),
    confidence: Number(row.confidence ?? 0),
    riskScore: Number(row.risk_score ?? 0),
    expectedCostUsd: Number(row.expected_cost_usd ?? 0),
    decisionRecordId: row.decision_record_id,
    degradedMode: row.degraded_mode,
    qaMarker: row.qa_marker,
    createdAt: row.created_at,
  }
}

function mapRuntime(row: RuntimeRow): AiDecisionEngineRuntime {
  return {
    id: row.id,
    organizationId: row.organization_id,
    degraded: row.degraded,
    degradedReason: row.degraded_reason,
    evaluationCount: row.evaluation_count ?? 0,
    insufficientEvidenceCount: row.insufficient_evidence_count ?? 0,
    lastEvaluationAt: row.last_evaluation_at,
    lastSuccessAt: row.last_success_at,
    metadata: row.metadata ?? {},
    qaMarker: row.qa_marker,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function upsertAiDecisionEngineRuntime(
  admin: SupabaseClient,
  input: { organizationId: string; patch?: Record<string, unknown> },
): Promise<AiDecisionEngineRuntime> {
  const row = {
    organization_id: input.organizationId,
    qa_marker: GROWTH_AI_DECISION_ENGINE_QA_MARKER,
    ...(input.patch ?? {}),
  }

  const { data, error } = await runtimeTable(admin)
    .upsert(row, { onConflict: "organization_id" })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapRuntime(data as RuntimeRow)
}

export async function fetchAiDecisionEngineRuntime(
  admin: SupabaseClient,
  input: { organizationId: string },
): Promise<AiDecisionEngineRuntime | null> {
  const { data, error } = await runtimeTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRuntime(data as RuntimeRow) : null
}

export async function insertAiDecisionEngineRequest(
  admin: SupabaseClient,
  input: {
    organizationId: string
    missionId: string
    workOrderId: string
    decisionKey: string
    requestStatus: AiDecisionEngineRequestStatus
    evidenceBundle: AiDecisionEvidenceRef[]
    evaluation: Record<string, unknown>
    recommendation: AiDecisionEngineRecommendation
    confidence: number
    riskScore: number
    expectedCostUsd: number
    decisionRecordId?: string | null
    degradedMode?: boolean
  },
): Promise<AiDecisionEngineRequest> {
  const row = {
    organization_id: input.organizationId,
    mission_id: input.missionId,
    work_order_id: input.workOrderId,
    decision_key: input.decisionKey,
    request_status: input.requestStatus,
    evidence_bundle: input.evidenceBundle,
    evaluation: input.evaluation,
    recommendation: input.recommendation,
    confidence: input.confidence,
    risk_score: input.riskScore,
    expected_cost_usd: input.expectedCostUsd,
    decision_record_id: input.decisionRecordId ?? null,
    degraded_mode: input.degradedMode ?? false,
    qa_marker: GROWTH_AI_DECISION_ENGINE_QA_MARKER,
  }

  const { data, error } = await requestTable(admin).insert(row).select("*").single()
  if (error) throw new Error(error.message)
  return mapRequest(data as RequestRow)
}

export async function listAiDecisionEngineRequestsForWorkOrder(
  admin: SupabaseClient,
  input: { organizationId: string; workOrderId: string; limit?: number },
): Promise<AiDecisionEngineRequest[]> {
  let query = requestTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("work_order_id", input.workOrderId)
    .order("created_at", { ascending: false })

  if (input.limit) query = query.limit(input.limit)

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => mapRequest(row as RequestRow))
}

export function aiDecisionEngineSchemaCatalog() {
  return {
    qaMarker: GROWTH_AI_DECISION_ENGINE_QA_MARKER,
    requestStatuses: [...AI_DECISION_ENGINE_REQUEST_STATUSES],
  }
}
