import "server-only"

import { getAiEnvConfig } from "@/lib/ai/config"
import { aiDebugLog } from "@/lib/ai/ai-debug"
import type { AiProviderId, AiTaskId } from "@/lib/ai/types"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { recordAiUsageLog } from "@/lib/ai/usage"
import { createAiAlert } from "@/lib/ai/alerts/create-ai-alert"

export type AiCacheRowRead = {
  response_json: unknown | null
  response_text: string | null
  confidence_score: number | null
}

function tryServiceRole() {
  try {
    return createServiceRoleSupabaseClient()
  } catch {
    return null
  }
}

/** When true (default), insert ai_usage_logs row with zero tokens/cost for observability. Cost dashboards sum estimated_cost — zeros do not inflate spend. */
export function shouldLogCacheHitsToUsage(): boolean {
  const raw = process.env.AI_LOG_CACHE_HITS_TO_USAGE
  if (raw === "0" || raw === "false") return false
  return true
}

export async function readAiCache(params: {
  storageKey: string
  organizationId: string
}): Promise<AiCacheRowRead | null> {
  if (!params.organizationId?.trim()) return null
  const svc = tryServiceRole()
  if (!svc) return null
  try {
    const { data, error } = await svc
      .from("ai_cache")
      .select("response_json, response_text, confidence_score, expires_at")
      .eq("storage_key", params.storageKey)
      .eq("organization_id", params.organizationId)
      .maybeSingle()

    if (error || !data) return null
    const exp = data.expires_at as string | null
    if (exp != null && new Date(exp).getTime() <= Date.now()) {
      return null
    }
    return {
      response_json: data.response_json as unknown | null,
      response_text: typeof data.response_text === "string" ? data.response_text : null,
      confidence_score:
        data.confidence_score != null ? Number(data.confidence_score) : null,
    }
  } catch (e) {
    await createAiAlert({
      organizationId: params.organizationId,
      alertType: "cache_error_spike",
      severity: "warning",
      title: "AI cache read failure",
      message: "AI cache read failed. Falling back to provider calls.",
      metadata: {
        sourceType: "ai_cache",
        sourceId: "read",
        count: 1,
        threshold: 1,
      },
      dedupeWindowMinutes: 20,
    })
    if (getAiEnvConfig().debug) {
      aiDebugLog("ai_cache_read_failed", {
        message: e instanceof Error ? e.message : String(e),
      })
    }
    return null
  }
}

export async function recordCacheHitMeta(params: {
  storageKey: string
  organizationId: string
  task: AiTaskId
  provider: AiProviderId
  model: string
  /** When true (e.g. tests), only bump hit_count — no ai_usage_logs row. */
  skipUsageLog?: boolean
  /** Merged into ai_usage_logs.metadata (e.g. promptId / promptVersion). */
  usageMetadata?: Record<string, unknown>
}): Promise<void> {
  const svc = tryServiceRole()
  if (!svc) return
  try {
    const { data: row } = await svc
      .from("ai_cache")
      .select("hit_count")
      .eq("storage_key", params.storageKey)
      .eq("organization_id", params.organizationId)
      .maybeSingle()

    await svc
      .from("ai_cache")
      .update({
        hit_count: (typeof row?.hit_count === "number" ? row.hit_count : 0) + 1,
        last_hit_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("storage_key", params.storageKey)
      .eq("organization_id", params.organizationId)
  } catch (e) {
    await createAiAlert({
      organizationId: params.organizationId,
      alertType: "cache_error_spike",
      severity: "warning",
      title: "AI cache hit update failure",
      message: "AI cache hit counter update failed.",
      metadata: {
        task: params.task,
        provider: params.provider,
        model: params.model,
        sourceType: "ai_cache",
        sourceId: "hit_update",
        count: 1,
        threshold: 1,
      },
      dedupeWindowMinutes: 20,
    })
    if (getAiEnvConfig().debug) {
      aiDebugLog("ai_cache_hit_update_failed", {
        message: e instanceof Error ? e.message : String(e),
      })
    }
  }

  if (!params.skipUsageLog && shouldLogCacheHitsToUsage()) {
    /**
     * Cache-hit rows use zero tokens and zero estimated_cost — they do not represent provider spend.
     * Month-to-date **cost** on Settings → AI Usage sums `estimated_cost`; those totals exclude real token burn for hits.
     * Request volume may include these rows when AI_LOG_CACHE_HITS_TO_USAGE is not disabled.
     */
    await recordAiUsageLog({
      organization_id: params.organizationId,
      task: params.task,
      provider: params.provider,
      model: params.model,
      prompt_tokens: 0,
      completion_tokens: 0,
      estimated_cost: 0,
      duration_ms: 0,
      success: true,
      cache_hit: true,
      budget_blocked: false,
      metadata: params.usageMetadata,
    })
  }
}

export async function writeAiCache(params: {
  organizationId: string
  storageKey: string
  task: AiTaskId
  inputHash: string
  modelSignature: string
  responseJson: unknown | null
  responseText: string | null
  confidenceScore: number | null
  ttlSeconds: number | null
}): Promise<void> {
  if (!params.organizationId?.trim()) return
  const svc = tryServiceRole()
  if (!svc) return
  const expiresAt =
    params.ttlSeconds != null && params.ttlSeconds > 0
      ? new Date(Date.now() + params.ttlSeconds * 1000).toISOString()
      : null

  try {
    const { data: existing } = await svc
      .from("ai_cache")
      .select("hit_count")
      .eq("storage_key", params.storageKey)
      .maybeSingle()
    const preserveHits = typeof existing?.hit_count === "number" ? existing.hit_count : 0

    const { error } = await svc.from("ai_cache").upsert(
      {
        organization_id: params.organizationId,
        storage_key: params.storageKey,
        task: params.task,
        input_hash: params.inputHash,
        model_signature: params.modelSignature,
        response_json: params.responseJson,
        response_text: params.responseText,
        confidence_score: params.confidenceScore,
        expires_at: expiresAt,
        hit_count: preserveHits,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "storage_key" },
    )
    if (error && getAiEnvConfig().debug) {
      aiDebugLog("ai_cache_write_failed", { message: error.message })
    }
  } catch (e) {
    await createAiAlert({
      organizationId: params.organizationId,
      alertType: "cache_error_spike",
      severity: "warning",
      title: "AI cache write failure",
      message: "AI cache write failed for a cacheable task.",
      metadata: {
        task: params.task,
        sourceType: "ai_cache",
        sourceId: "write",
        count: 1,
        threshold: 1,
      },
      dedupeWindowMinutes: 20,
    })
    if (getAiEnvConfig().debug) {
      aiDebugLog("ai_cache_write_failed", {
        message: e instanceof Error ? e.message : String(e),
      })
    }
  }
}

export type AiCacheOverviewRow = {
  task: string
  hit_count: number
  last_hit_at: string | null
  expires_at: string | null
  updated_at: string
  storage_key: string
}

export async function fetchOrganizationAiCacheOverview(
  organizationId: string,
): Promise<{ rows: AiCacheOverviewRow[]; totalHits: number }> {
  const svc = tryServiceRole()
  if (!svc) return { rows: [], totalHits: 0 }
  try {
    let totalHits = 0
    const pageSize = 1000
    let offset = 0
    for (;;) {
      const { data, error } = await svc
        .from("ai_cache")
        .select("hit_count")
        .eq("organization_id", organizationId)
        .range(offset, offset + pageSize - 1)
      if (error || !data?.length) break
      for (const r of data) {
        totalHits += typeof r.hit_count === "number" ? r.hit_count : 0
      }
      if (data.length < pageSize) break
      offset += pageSize
    }

    const { data: recent, error: recentErr } = await svc
      .from("ai_cache")
      .select("task, hit_count, last_hit_at, expires_at, updated_at, storage_key")
      .eq("organization_id", organizationId)
      .order("last_hit_at", { ascending: false, nullsFirst: false })
      .limit(40)

    if (recentErr || !recent) return { rows: [], totalHits }

    const rows: AiCacheOverviewRow[] = recent.map((r) => ({
      task: String(r.task ?? ""),
      hit_count: typeof r.hit_count === "number" ? r.hit_count : 0,
      last_hit_at: r.last_hit_at != null ? String(r.last_hit_at) : null,
      expires_at: r.expires_at != null ? String(r.expires_at) : null,
      updated_at: String(r.updated_at ?? ""),
      storage_key: String(r.storage_key ?? ""),
    }))
    return { rows, totalHits }
  } catch {
    return { rows: [], totalHits: 0 }
  }
}
