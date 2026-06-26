/** GE-AIOS-3A — Provider persistence (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  AI_OS_PROVIDER_REQUEST_STATUSES,
  GROWTH_AI_PROVIDER_ADAPTERS_QA_MARKER,
  type AiOsProviderId,
  type AiOsProviderNormalizedResponse,
  type AiOsProviderRequestStatus,
  type AiOsProviderRuntime,
} from "@/lib/growth/aios/ai-provider-types"

type RuntimeRow = {
  id: string
  organization_id: string
  degraded: boolean
  degraded_reason: string | null
  active_provider: string | null
  request_count: number
  failure_count: number
  failover_count: number
  last_request_at: string | null
  last_success_at: string | null
  metadata: Record<string, unknown> | null
  qa_marker: string
  created_at: string
  updated_at: string
}

type RequestRow = {
  id: string
  organization_id: string
  mission_id: string | null
  work_order_id: string | null
  context_package_id: string | null
  purpose: string
  provider_id: string
  model_id: string
  request_status: string
  failover_count: number
  attempted_providers: unknown
  normalized_response: Record<string, unknown> | null
  error_detail: string | null
  prompt_tokens: number
  completion_tokens: number
  estimated_cost_usd: number
  qa_marker: string
  created_at: string
}

function runtimeTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_provider_runtime")
}

function requestTable(admin: SupabaseClient) {
  return admin.schema("growth").from("ai_provider_requests")
}

function normalizeRequestStatus(value: unknown): AiOsProviderRequestStatus {
  if (typeof value === "string" && (AI_OS_PROVIDER_REQUEST_STATUSES as readonly string[]).includes(value)) {
    return value as AiOsProviderRequestStatus
  }
  return "pending"
}

function mapRuntime(row: RuntimeRow): AiOsProviderRuntime {
  return {
    id: row.id,
    organizationId: row.organization_id,
    degraded: row.degraded,
    degradedReason: row.degraded_reason,
    activeProvider: row.active_provider as AiOsProviderId | null,
    requestCount: row.request_count,
    failureCount: row.failure_count,
    failoverCount: row.failover_count,
    lastRequestAt: row.last_request_at,
    lastSuccessAt: row.last_success_at,
    metadata: row.metadata ?? {},
    qaMarker: row.qa_marker,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function aiProviderSchemaCatalog() {
  return {
    qaMarker: GROWTH_AI_PROVIDER_ADAPTERS_QA_MARKER,
    tables: ["ai_provider_runtime", "ai_provider_requests"],
  }
}

export async function fetchAiProviderRuntime(
  admin: SupabaseClient,
  input: { organizationId: string },
): Promise<AiOsProviderRuntime | null> {
  const { data, error } = await runtimeTable(admin)
    .select("*")
    .eq("organization_id", input.organizationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? mapRuntime(data as RuntimeRow) : null
}

export async function upsertAiProviderRuntime(
  admin: SupabaseClient,
  input: { organizationId: string },
): Promise<AiOsProviderRuntime> {
  const existing = await fetchAiProviderRuntime(admin, input)
  if (existing) return existing

  const { data, error } = await runtimeTable(admin)
    .insert({
      organization_id: input.organizationId,
      qa_marker: GROWTH_AI_PROVIDER_ADAPTERS_QA_MARKER,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapRuntime(data as RuntimeRow)
}

export async function updateAiProviderRuntimeCounters(
  admin: SupabaseClient,
  input: {
    organizationId: string
    requestDelta?: number
    failureDelta?: number
    failoverDelta?: number
    activeProvider?: AiOsProviderId | null
    degraded?: boolean
    degradedReason?: string | null
    success?: boolean
  },
): Promise<AiOsProviderRuntime> {
  const runtime = await upsertAiProviderRuntime(admin, { organizationId: input.organizationId })
  const patch: Record<string, unknown> = {
    request_count: runtime.requestCount + (input.requestDelta ?? 0),
    failure_count: runtime.failureCount + (input.failureDelta ?? 0),
    failover_count: runtime.failoverCount + (input.failoverDelta ?? 0),
    last_request_at: new Date().toISOString(),
  }
  if (input.activeProvider !== undefined) patch.active_provider = input.activeProvider
  if (input.degraded !== undefined) patch.degraded = input.degraded
  if (input.degradedReason !== undefined) patch.degraded_reason = input.degradedReason
  if (input.success) patch.last_success_at = new Date().toISOString()

  const { data, error } = await runtimeTable(admin)
    .update(patch)
    .eq("id", runtime.id)
    .select("*")
    .single()
  if (error) throw new Error(error.message)
  return mapRuntime(data as RuntimeRow)
}

export async function insertAiProviderRequest(
  admin: SupabaseClient,
  input: {
    organizationId: string
    missionId?: string | null
    workOrderId?: string | null
    contextPackageId?: string | null
    purpose: string
    providerId: AiOsProviderId
    modelId: string
    requestStatus: AiOsProviderRequestStatus
    failoverCount?: number
    attemptedProviders?: AiOsProviderId[]
    normalizedResponse?: AiOsProviderNormalizedResponse | null
    errorDetail?: string | null
    promptTokens?: number
    completionTokens?: number
    estimatedCostUsd?: number
  },
): Promise<{ id: string; createdAt: string }> {
  const row = {
    organization_id: input.organizationId,
    mission_id: input.missionId ?? null,
    work_order_id: input.workOrderId ?? null,
    context_package_id: input.contextPackageId ?? null,
    purpose: input.purpose,
    provider_id: input.providerId,
    model_id: input.modelId,
    request_status: input.requestStatus,
    failover_count: input.failoverCount ?? 0,
    attempted_providers: input.attemptedProviders ?? [],
    normalized_response: input.normalizedResponse ?? null,
    error_detail: input.errorDetail ?? null,
    prompt_tokens: input.promptTokens ?? 0,
    completion_tokens: input.completionTokens ?? 0,
    estimated_cost_usd: input.estimatedCostUsd ?? 0,
    qa_marker: GROWTH_AI_PROVIDER_ADAPTERS_QA_MARKER,
  }

  const { data, error } = await requestTable(admin).insert(row).select("id, created_at").single()
  if (error) throw new Error(error.message)
  const result = data as RequestRow
  return { id: result.id, createdAt: result.created_at }
}
