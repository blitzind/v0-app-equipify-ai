import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { GrowthPersonalizationSource } from "@/lib/growth/personalization/personalization-types"

export async function recordPersonalizationPerformanceSnapshot(
  admin: SupabaseClient,
  input: {
    generationId: string
    leadId: string
    sourceType: GrowthPersonalizationSource
    attributionScore: number
    replyRate?: number | null
    meetingRate?: number | null
  },
): Promise<void> {
  await admin.schema("growth").from("personalization_performance_snapshots").insert({
    generation_id: input.generationId,
    lead_id: input.leadId,
    source_type: input.sourceType,
    attribution_score: input.attributionScore,
    reply_rate: input.replyRate ?? null,
    meeting_rate: input.meetingRate ?? null,
  })
}

export async function listPersonalizationPerformanceSnapshots(admin: SupabaseClient, input?: { limit?: number }) {
  let query = admin
    .schema("growth")
    .from("personalization_performance_snapshots")
    .select("*")
    .order("recorded_at", { ascending: false })
  if (input?.limit) query = query.limit(input.limit)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    leadLabel: "Lead",
    sourceType: String(row.source_type) as GrowthPersonalizationSource,
    attributionScore: Number(row.attribution_score ?? 0),
    replyRate: row.reply_rate == null ? null : Number(row.reply_rate),
    meetingRate: row.meeting_rate == null ? null : Number(row.meeting_rate),
    recordedAt: String(row.recorded_at ?? ""),
  }))
}

export function computeAttributionScore(input: {
  evidenceCoverageScore: number
  personalizationScore: number
  performedWell?: boolean
}): number {
  let score = Math.round(input.evidenceCoverageScore * 0.55 + input.personalizationScore * 0.45)
  if (input.performedWell) score = Math.min(100, score + 10)
  return Math.max(0, Math.min(100, score))
}
