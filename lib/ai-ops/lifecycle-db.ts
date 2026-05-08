/**
 * AI Ops Phase 5 — lifecycle rows + append-only events (Supabase).
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { RecommendationCategory } from "./types"
import type { RecommendationLifecycleState } from "./types"

export type LifecycleRow = {
  recommendation_key: string
  category: string
  state: RecommendationLifecycleState
  notes: string | null
  updated_at: string
  updated_by: string | null
  created_at: string
}

export async function loadLifecycleMap(
  supabase: SupabaseClient,
  organizationId: string,
  keys: string[],
): Promise<Map<string, LifecycleRow>> {
  const map = new Map<string, LifecycleRow>()
  if (keys.length === 0) return map
  const { data, error } = await supabase
    .from("ai_ops_recommendation_lifecycle")
    .select("recommendation_key, category, state, notes, updated_at, updated_by, created_at")
    .eq("organization_id", organizationId)
    .in("recommendation_key", keys)
  if (error || !data) return map
  for (const row of data as LifecycleRow[]) {
    map.set(row.recommendation_key, row)
  }
  return map
}

export async function upsertLifecycleState(args: {
  supabase: SupabaseClient
  organizationId: string
  recommendationKey: string
  category: RecommendationCategory
  state: RecommendationLifecycleState
  notes?: string | null
  userId: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString()
  const { data: existing } = await args.supabase
    .from("ai_ops_recommendation_lifecycle")
    .select("id")
    .eq("organization_id", args.organizationId)
    .eq("recommendation_key", args.recommendationKey)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await args.supabase
      .from("ai_ops_recommendation_lifecycle")
      .update({
        category: args.category,
        state: args.state,
        notes: args.notes ?? null,
        updated_by: args.userId,
        updated_at: now,
      })
      .eq("id", (existing as { id: string }).id)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }

  const { error } = await args.supabase.from("ai_ops_recommendation_lifecycle").insert({
    organization_id: args.organizationId,
    recommendation_key: args.recommendationKey,
    category: args.category,
    state: args.state,
    notes: args.notes ?? null,
    updated_by: args.userId,
    updated_at: now,
    created_at: now,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export type RecommendationEventRow = {
  id: string
  event_type: string
  outcome: string | null
  metadata: Record<string, unknown>
  created_at: string
  actor_user_id: string | null
}

export async function insertRecommendationEvent(args: {
  supabase: SupabaseClient
  organizationId: string
  recommendationKey: string
  category: RecommendationCategory
  eventType: string
  actorUserId: string | null
  outcome?: string | null
  metadata?: Record<string, unknown>
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { data, error } = await args.supabase
    .from("ai_ops_recommendation_events")
    .insert({
      organization_id: args.organizationId,
      recommendation_key: args.recommendationKey,
      category: args.category,
      event_type: args.eventType,
      actor_user_id: args.actorUserId,
      outcome: args.outcome ?? null,
      metadata: args.metadata ?? {},
    })
    .select("id")
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  return { ok: true, id: (data as { id: string } | null)?.id }
}

export async function listRecommendationEvents(
  supabase: SupabaseClient,
  organizationId: string,
  recommendationKey: string,
  limit = 80,
): Promise<RecommendationEventRow[]> {
  const { data, error } = await supabase
    .from("ai_ops_recommendation_events")
    .select("id, event_type, outcome, metadata, created_at, actor_user_id")
    .eq("organization_id", organizationId)
    .eq("recommendation_key", recommendationKey)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data as RecommendationEventRow[]
}
