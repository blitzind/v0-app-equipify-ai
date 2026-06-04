import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { generateSequenceOptimizationRecommendations } from "@/lib/growth/sequence-optimization/sequence-optimization-engine"
import { loadSequenceOptimizationSignals } from "@/lib/growth/sequence-optimization/sequence-optimization-queries"
import {
  GROWTH_SEQUENCE_OPTIMIZATION_V2_QA_MARKER,
  type GrowthSequenceOptimizationRecommendationsPayload,
} from "@/lib/growth/sequence-optimization/sequence-optimization-types"
import { isGrowthAttributionTouchLedgerSchemaReady } from "@/lib/growth/revenue-attribution/attribution-touch-schema-health"
import {
  loadCtaCategorySignals,
  loadPainPointSignals,
} from "@/lib/growth/revenue-attribution/attribution-recommendation-queries"
import { fetchGrowthRevenueAttributionDashboard } from "@/lib/growth/revenue-attribution/revenue-attribution-dashboard"
import {
  loadSequenceLabels,
  loadSequenceStepLabels,
  listAttributionTouchesInRange,
} from "@/lib/growth/revenue-attribution/revenue-attribution-dashboard-queries"

function emptyPayload(): GrowthSequenceOptimizationRecommendationsPayload {
  const now = new Date().toISOString()
  return {
    qa_marker: GROWTH_SEQUENCE_OPTIMIZATION_V2_QA_MARKER,
    recommendations: [],
    winningAngles: [],
    copyImprovements: [],
    stepStructure: [],
    channelTiming: [],
    underperformers: [],
    rollups: {
      topSequences: [],
      weakSteps: [],
      topSubjectCategories: [],
      topOpenerStrategies: [],
      channelScores: [],
      generatedAt: now,
    },
    touchesAnalyzed: 0,
    lastCalculatedAt: now,
  }
}

export async function fetchGrowthSequenceOptimizationRecommendations(
  admin: SupabaseClient,
  input?: {
    dateFrom?: string
    dateTo?: string
    channel?: string | null
    repUserId?: string | null
    sequenceId?: string | null
    attributionModel?: import("@/lib/growth/revenue-attribution/revenue-attribution-dashboard-types").GrowthAttributionModel
  },
): Promise<GrowthSequenceOptimizationRecommendationsPayload> {
  if (!(await isGrowthAttributionTouchLedgerSchemaReady(admin))) {
    return emptyPayload()
  }

  const dashboard = await fetchGrowthRevenueAttributionDashboard(admin, {
    dateFrom: input?.dateFrom,
    dateTo: input?.dateTo,
    channel: input?.channel ?? null,
    repUserId: input?.repUserId ?? null,
    sequenceId: input?.sequenceId ?? null,
    attributionModel: input?.attributionModel,
  })

  const filters = dashboard.filters
  const touches = await listAttributionTouchesInRange(admin, filters)
  const wonTouches = touches.filter((t) => t.touchType === "opportunity_won")
  const wonLeadIds = [...new Set(wonTouches.map((t) => t.leadId))]

  const [signals, sequenceLabels, stepLabels, ctaCategories, painPoints] = await Promise.all([
    loadSequenceOptimizationSignals(admin, filters),
    loadSequenceLabels(admin),
    loadSequenceStepLabels(admin),
    loadCtaCategorySignals(admin, filters, wonLeadIds).catch(() => []),
    loadPainPointSignals(admin, wonTouches).catch(() => []),
  ])

  const ctaSignals = ctaCategories.map((row) => ({
    key: row.key,
    label: row.label,
    sends: row.sendCount,
    wins: row.wins,
  }))

  return generateSequenceOptimizationRecommendations({
    bySequence: dashboard.bySequence,
    bySequenceStep: dashboard.bySequenceStep,
    byChannel: dashboard.byChannel,
    funnel: dashboard.funnel,
    sequenceLabels,
    stepLabels,
    stepMeta: signals.stepMeta,
    sequenceSnapshots: signals.sequenceSnapshots,
    subjectSignals: signals.outreach.subjectSignals,
    openerSignals: signals.outreach.openerSignals,
    ctaSignals,
    painPoints,
    channelEffectiveness: signals.channelEffectiveness.map((row) => ({
      channel: row.channel,
      effectivenessScore: row.effectivenessScore,
      touchCount: row.touchCount,
    })),
    replyQualityBySequence: signals.replyQualityBySequence,
    touchesAnalyzed: dashboard.touchesAnalyzed,
    filterSequenceId: input?.sequenceId ?? null,
  })
}
