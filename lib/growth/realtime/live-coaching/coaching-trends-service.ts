import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildCoachingTrendsPayload,
  coachingTrendsSinceIso,
  parseCoachingTrendsDateRangeDays,
  parseCoachingTrendsProviderFilter,
  parseCoachingTrendsRiskFilter,
} from "@/lib/growth/realtime/live-coaching/coaching-trends-aggregation"
import type { CoachingTrendsPayload } from "@/lib/growth/realtime/live-coaching/coaching-trends-types"
import { buildLiveCoachingTrendsQaProofMarker } from "@/lib/growth/realtime/live-coaching/live-coaching-production-proof"
import { listLiveCoachingSessionInsightsSince } from "@/lib/growth/realtime/live-coaching/session-insights-repository"

export async function fetchLiveCoachingTrendsPayload(
  admin: SupabaseClient,
  input: {
    rangeDays?: string | null
    provider?: string | null
    risk?: string | null
  },
): Promise<CoachingTrendsPayload> {
  const dateRangeDays = parseCoachingTrendsDateRangeDays(input.rangeDays)
  const providerId = parseCoachingTrendsProviderFilter(input.provider)
  const riskLevel = parseCoachingTrendsRiskFilter(input.risk)
  const sinceIso = coachingTrendsSinceIso(dateRangeDays)

  const queryResult = await listLiveCoachingSessionInsightsSince(admin, {
    sinceIso,
    providerId,
    riskLevel,
  })

  return buildCoachingTrendsPayload({
    rollups: queryResult.rollups,
    filters: { dateRangeDays, providerId, riskLevel },
    meta: {
      total: queryResult.total,
      limit: queryResult.limit,
      truncated: queryResult.truncated,
    },
    qaProof: buildLiveCoachingTrendsQaProofMarker({
      sessionCount: queryResult.rollups.length,
      truncated: queryResult.truncated,
    }),
  })
}
