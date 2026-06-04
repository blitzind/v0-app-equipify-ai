import type { GrowthAttributionDimensionRow, GrowthAttributionFunnelStep } from "@/lib/growth/revenue-attribution/revenue-attribution-dashboard-types"
import type {
  AttributionRecommendationEngineInput,
  GrowthAttributionClosedLoopRollups,
  GrowthAttributionPersonalizationInsightRollup,
} from "@/lib/growth/revenue-attribution/attribution-recommendation-types"

function weakestFunnelStage(funnel: GrowthAttributionFunnelStep[]): {
  stage: string | null
  conversionPct: number | null
} {
  let weakest: { stage: string; conversionPct: number } | null = null
  for (let i = 1; i < funnel.length; i++) {
    const step = funnel[i]
    if (step.conversionRatePct == null) continue
    if (!weakest || step.conversionRatePct < weakest.conversionPct) {
      weakest = { stage: step.stage, conversionPct: step.conversionRatePct }
    }
  }
  return { stage: weakest?.stage ?? null, conversionPct: weakest?.conversionPct ?? null }
}

export function buildAttributionClosedLoopRollups(
  input: AttributionRecommendationEngineInput,
): GrowthAttributionClosedLoopRollups {
  const bottleneck = weakestFunnelStage(input.funnel)

  const personalization: GrowthAttributionPersonalizationInsightRollup = {
    topPainPoints: (input.painPoints ?? []).slice(0, 8),
    topCtaCategories: (input.ctaCategories ?? []).slice(0, 8).map((row) => ({
      key: row.key,
      label: row.label,
      sendCount: row.sendCount,
      positiveReplyRatePct:
        row.sendCount > 0 ? Math.round((row.positiveReplies / row.sendCount) * 1000) / 10 : null,
    })),
    note: "Read-only rollup for future personalization systems. No auto copy changes.",
  }

  return {
    personalization,
    sequence: {
      topSequences: input.bySequence.filter((r) => r.wins > 0).slice(0, 8),
      underperformingSequences: input.bySequence
        .filter((r) => r.key !== "no_sequence" && r.touchCount >= 8 && r.wins === 0)
        .slice(0, 8),
    },
    channel: {
      topChannels: input.byChannel.filter((r) => r.wins > 0).slice(0, 8),
      bottleneckStage: bottleneck.stage,
      bottleneckConversionPct: bottleneck.conversionPct,
    },
    sender: {
      topMailboxes: input.bySenderMailbox.filter((r) => r.wins > 0).slice(0, 8),
      highVolumeZeroWinMailboxes: input.bySenderMailbox
        .filter((r) => r.key !== "no_sender" && r.touchCount >= 10 && r.wins === 0)
        .slice(0, 8),
    },
    industry: {
      topIndustries: input.byIndustry.filter((r) => r.wins > 0).slice(0, 8),
      weakIndustries: input.byIndustry
        .filter((r) => r.key !== "unknown" && r.leadCount >= 5 && r.wins === 0)
        .slice(0, 8),
    },
    generatedAt: new Date().toISOString(),
  }
}

export function medianAttributedRevenue(rows: GrowthAttributionDimensionRow[]): number {
  const values = rows.map((r) => r.attributedRevenue).filter((v) => v > 0).sort((a, b) => a - b)
  if (values.length === 0) return 0
  const mid = Math.floor(values.length / 2)
  return values.length % 2 === 0 ? (values[mid - 1]! + values[mid]!) / 2 : values[mid]!
}
