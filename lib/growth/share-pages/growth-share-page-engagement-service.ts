/** Growth Engine SP-INT-1 — Share page engagement signal assembly (server-only). */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  deriveGrowthSharePageIntelligenceSignals,
  buildGrowthSharePageIntelligenceMetrics,
} from "@/lib/growth/share-pages/growth-share-page-intelligence-mappings"
import type {
  GrowthSharePageIntelligenceSignal,
  GrowthSharePageIntelligenceMetrics,
} from "@/lib/growth/share-pages/growth-share-page-intelligence-types"
import {
  fetchGrowthSharePageById,
  getSharePageAnalyticsSummary,
} from "@/lib/growth/share-pages/share-page-repository"

export type GrowthSharePageEngagementSignalSnapshot = {
  metrics: GrowthSharePageIntelligenceMetrics
  signals: GrowthSharePageIntelligenceSignal[]
  sessionCount: number
  primarySessionId: string | null
}

async function loadSharePageSessionStats(
  admin: SupabaseClient,
  sharePageId: string,
  sessionId?: string | null,
): Promise<{ sessionCount: number; primarySessionId: string | null }> {
  let query = admin
    .schema("growth")
    .from("share_page_views")
    .select("session_key, visitor_fingerprint_hash")
    .eq("share_page_id", sharePageId)
    .limit(100)

  if (sessionId?.trim()) {
    query = query.eq("session_key", sessionId.trim())
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)

  const sessionKeys = new Set<string>()
  for (const row of data ?? []) {
    const key =
      (typeof row.session_key === "string" && row.session_key.trim()) ||
      (typeof row.visitor_fingerprint_hash === "string" && row.visitor_fingerprint_hash.trim()) ||
      ""
    if (key) sessionKeys.add(key)
  }

  const primarySessionId =
    sessionId?.trim() ||
    (typeof data?.[0]?.session_key === "string" ? data[0].session_key : null)

  return {
    sessionCount: sessionKeys.size,
    primarySessionId,
  }
}

export async function buildGrowthSharePageEngagementSignals(
  admin: SupabaseClient,
  input: {
    sharePageId: string
    sessionId?: string | null
  },
): Promise<GrowthSharePageEngagementSignalSnapshot | null> {
  const page = await fetchGrowthSharePageById(admin, input.sharePageId)
  if (!page) return null

  const [analytics, sessions] = await Promise.all([
    getSharePageAnalyticsSummary(admin, input.sharePageId).catch(() => null),
    loadSharePageSessionStats(admin, input.sharePageId, input.sessionId),
  ])

  const metrics = buildGrowthSharePageIntelligenceMetrics({
    page,
    analytics,
    sessionCount: sessions.sessionCount,
    primarySessionId: sessions.primarySessionId,
  })

  const signals = deriveGrowthSharePageIntelligenceSignals({
    totalViews: metrics.totalViews,
    ctaClicks: metrics.ctaClicks,
    calendarClicks: metrics.calendarClicks,
    sessionCount: metrics.sessionCount,
    highIntent: metrics.sharePageEngagementScore >= 60,
  })

  return {
    metrics,
    signals,
    sessionCount: sessions.sessionCount,
    primarySessionId: sessions.primarySessionId,
  }
}
