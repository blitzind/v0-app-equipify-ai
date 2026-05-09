import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { getAiEnvConfig } from "@/lib/ai/config"
import type { PlanId } from "@/lib/plans"
import type { AidenTrackedFeatureKey } from "@/lib/aiden/tier-capabilities"

function monthStartUtcIso(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString()
}

function tryServiceRole() {
  try {
    return createServiceRoleSupabaseClient()
  } catch {
    return null
  }
}

function sanitizeMetadata(meta: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!meta || typeof meta !== "object") return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(meta)) {
    if (k.length > 64) continue
    if (typeof v === "string") out[k] = v.slice(0, 500)
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v
    else if (typeof v === "boolean") out[k] = v
  }
  return out
}

/** Persist one AIden usage row (service role). Best-effort — failures are logged in debug only. */
export async function recordAidenUsageEvent(params: {
  organizationId: string
  userId: string
  featureKey: AidenTrackedFeatureKey
  planTier: PlanId
  promptTokens?: number
  completionTokens?: number
  durationMs?: number
  metadata?: Record<string, unknown>
}): Promise<void> {
  const supabase = tryServiceRole()
  if (!supabase) {
    if (getAiEnvConfig().debug) {
      console.warn("[aiden] usage event skipped (no service role)", params.featureKey)
    }
    return
  }

  const { error } = await supabase.from("aiden_usage_events").insert({
    organization_id: params.organizationId,
    user_id: params.userId,
    feature_key: params.featureKey,
    plan_tier: params.planTier,
    prompt_tokens: Math.max(0, Math.floor(params.promptTokens ?? 0)),
    completion_tokens: Math.max(0, Math.floor(params.completionTokens ?? 0)),
    duration_ms: Math.max(0, Math.floor(params.durationMs ?? 0)),
    metadata: sanitizeMetadata(params.metadata),
  })

  if (error && getAiEnvConfig().debug) {
    console.warn("[aiden] usage event insert failed", error.message)
  }
}

/** Month-to-date counts per feature (UTC month); uses caller Supabase client (member RLS). */
export async function fetchAidenUsageCountsMtd(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<{ support_chat: number; feature_request: number }> {
  const since = monthStartUtcIso()
  const empty = { support_chat: 0, feature_request: 0 }
  try {
    const { data, error } = await supabase
      .from("aiden_usage_events")
      .select("feature_key")
      .eq("organization_id", organizationId)
      .gte("created_at", since)

    if (error || !data?.length) return empty

    let support_chat = 0
    let feature_request = 0
    for (const row of data as { feature_key: string }[]) {
      if (row.feature_key === "support_chat") support_chat++
      else if (row.feature_key === "feature_request") feature_request++
    }
    return { support_chat, feature_request }
  } catch {
    return empty
  }
}
