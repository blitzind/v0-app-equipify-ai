/** GE-AIOS-3A — AI OS Provider service (server-only). Sole LLM gateway for AI OS. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { buildAiOsProviderMessagesFromContextPackage } from "@/lib/growth/aios/ai-provider-context-prompt"
import { invokeAiOsProviderWithFailover } from "@/lib/growth/aios/ai-provider-failover"
import { lookupAiOsModelCapability } from "@/lib/growth/aios/ai-provider-model-registry"
import {
  insertAiProviderRequest,
  updateAiProviderRuntimeCounters,
} from "@/lib/growth/aios/ai-provider-repository"
import { selectAiOsProviderCandidates } from "@/lib/growth/aios/ai-provider-selection-service"
import type {
  AiOsProviderId,
  AiOsProviderInvokeInput,
  AiOsProviderInvokeResult,
} from "@/lib/growth/aios/ai-provider-types"
import { publishAiOsEvent } from "@/lib/growth/aios/ai-event-service"

async function publishProviderAiEvent(
  admin: SupabaseClient,
  input: {
    organizationId: string
    eventType: string
    missionId: string | null
    workOrderId: string | null
    payload?: Record<string, unknown>
  },
) {
  return publishAiOsEvent(admin, {
    organizationId: input.organizationId,
    eventType: input.eventType,
    category: "provider",
    producer: "ai_provider_service",
    source: "ai_provider_service",
    missionId: input.missionId,
    workOrderId: input.workOrderId,
    correlationId: input.workOrderId ?? input.payload?.context_package_id?.toString() ?? undefined,
    payload: input.payload ?? {},
  })
}

export async function invokeAiOsProviderWithContextPackage(
  admin: SupabaseClient,
  input: AiOsProviderInvokeInput,
): Promise<AiOsProviderInvokeResult> {
  const contextPackage = input.contextPackage
  const modelTier = input.modelTier ?? "balanced"
  const messages = buildAiOsProviderMessagesFromContextPackage({
    contextPackage,
    purpose: input.purpose,
  })

  const candidates = selectAiOsProviderCandidates({
    preferredProvider: input.preferredProvider,
    modelTier,
  })
  if (candidates.length === 0) {
    throw new Error("ai_provider_no_candidates_available")
  }

  const primary = candidates[0]
  const capability = lookupAiOsModelCapability(primary.providerId, modelTier)
  const maxOutputTokens = input.maxOutputTokens ?? capability?.maxOutputTokens ?? 4096
  const temperature = input.temperature ?? 0.2

  await publishProviderAiEvent(admin, {
    organizationId: input.organizationId,
    eventType: "ai.requested",
    missionId: contextPackage.missionId,
    workOrderId: contextPackage.workOrderId,
    payload: {
      purpose: input.purpose,
      context_package_id: contextPackage.id,
      provider_id: primary.providerId,
      model_id: primary.modelId,
      candidate_count: candidates.length,
    },
  })

  await updateAiProviderRuntimeCounters(admin, {
    organizationId: input.organizationId,
    requestDelta: 1,
    activeProvider: primary.providerId,
  })

  const failoverResult = await invokeAiOsProviderWithFailover({
    candidates,
    messages,
    temperature,
    maxOutputTokens,
    structuredMode: input.purpose === "research_company" ? "json_object" : "none",
    onProviderDegraded: async ({ providerId, error }) => {
      await updateAiProviderRuntimeCounters(admin, {
        organizationId: input.organizationId,
        degraded: true,
        degradedReason: error.message,
      })
      await publishProviderAiEvent(admin, {
        organizationId: input.organizationId,
        eventType: "ai.provider_degraded",
        missionId: contextPackage.missionId,
        workOrderId: contextPackage.workOrderId,
        payload: {
          provider_id: providerId,
          detail: error.message,
          context_package_id: contextPackage.id,
        },
      })
    },
    onProviderSwitched: async ({ fromProviderId, toProviderId }) => {
      await updateAiProviderRuntimeCounters(admin, {
        organizationId: input.organizationId,
        failoverDelta: 1,
        activeProvider: toProviderId,
      })
      await publishProviderAiEvent(admin, {
        organizationId: input.organizationId,
        eventType: "ai.provider_switched",
        missionId: contextPackage.missionId,
        workOrderId: contextPackage.workOrderId,
        payload: {
          from_provider_id: fromProviderId,
          to_provider_id: toProviderId,
          context_package_id: contextPackage.id,
        },
      })
    },
  })

  if (!failoverResult.ok) {
    await updateAiProviderRuntimeCounters(admin, {
      organizationId: input.organizationId,
      failureDelta: 1,
    })
    const request = await insertAiProviderRequest(admin, {
      organizationId: input.organizationId,
      missionId: contextPackage.missionId,
      workOrderId: contextPackage.workOrderId,
      contextPackageId: contextPackage.id,
      purpose: input.purpose,
      providerId: primary.providerId,
      modelId: primary.modelId,
      requestStatus: "failed",
      failoverCount: Math.max(0, failoverResult.attemptedProviders.length - 1),
      attemptedProviders: failoverResult.attemptedProviders,
      errorDetail: failoverResult.error.message,
    })
    await publishProviderAiEvent(admin, {
      organizationId: input.organizationId,
      eventType: "ai.failed",
      missionId: contextPackage.missionId,
      workOrderId: contextPackage.workOrderId,
      payload: {
        request_id: request.id,
        context_package_id: contextPackage.id,
        detail: failoverResult.error.message,
        attempted_providers: failoverResult.attemptedProviders,
      },
    })
    throw failoverResult.error
  }

  const response = failoverResult.response
  await updateAiProviderRuntimeCounters(admin, {
    organizationId: input.organizationId,
    success: true,
    degraded: false,
    degradedReason: null,
    activeProvider: response.providerId,
    failoverDelta: response.failoverCount,
  })

  const request = await insertAiProviderRequest(admin, {
    organizationId: input.organizationId,
    missionId: contextPackage.missionId,
    workOrderId: contextPackage.workOrderId,
    contextPackageId: contextPackage.id,
    purpose: input.purpose,
    providerId: response.providerId,
    modelId: response.modelId,
    requestStatus: "completed",
    failoverCount: response.failoverCount,
    attemptedProviders: response.attemptedProviders,
    normalizedResponse: response,
    promptTokens: response.usage.promptTokens,
    completionTokens: response.usage.completionTokens,
    estimatedCostUsd: response.usage.estimatedCostUsd,
  })

  await publishProviderAiEvent(admin, {
    organizationId: input.organizationId,
    eventType: "ai.completed",
    missionId: contextPackage.missionId,
    workOrderId: contextPackage.workOrderId,
    payload: {
      request_id: request.id,
      context_package_id: contextPackage.id,
      provider_id: response.providerId,
      model_id: response.modelId,
      failover_count: response.failoverCount,
      prompt_tokens: response.usage.promptTokens,
      completion_tokens: response.usage.completionTokens,
    },
  })

  return { requestId: request.id, response }
}

export async function listRegisteredAiOsProviders(): Promise<AiOsProviderId[]> {
  return selectAiOsProviderCandidates().map((candidate) => candidate.providerId)
}
