import {
  buildAttributionClosedLoopRollups,
  medianAttributedRevenue,
} from "@/lib/growth/revenue-attribution/attribution-closed-loop-rollups"
import {
  GROWTH_ATTRIBUTION_RECOMMENDATION_SAFETY_NOTES,
  GROWTH_REVENUE_ATTRIBUTION_RECOMMENDATIONS_QA_MARKER,
  type AttributionRecommendationEngineInput,
  type GrowthAttributionImpactedDimension,
  type GrowthAttributionRecommendation,
  type GrowthAttributionRecommendationEvidence,
  type GrowthAttributionRecommendationType,
  type GrowthRevenueAttributionRecommendationsPayload,
} from "@/lib/growth/revenue-attribution/attribution-recommendation-types"
import type { GrowthAttributionDimensionRow, GrowthAttributionFunnelStep } from "@/lib/growth/revenue-attribution/revenue-attribution-dashboard-types"

const MIN_TOUCHES_FOR_UNDERPERFORM = 8
const MIN_LEADS_FOR_REP = 5

function confidenceScore(input: {
  wins: number
  leadCount: number
  touchCount: number
  revenue?: number
}): number {
  const raw =
    35 +
    input.wins * 18 +
    Math.min(input.leadCount, 20) * 2.5 +
    Math.min(input.touchCount, 50) * 0.4 +
    (input.revenue && input.revenue > 0 ? 10 : 0)
  return Math.max(0, Math.min(98, Math.round(raw)))
}

function recId(type: string, dimension: string, key: string): string {
  return `${type}:${dimension}:${key}`.slice(0, 120)
}

function evidenceRow(
  label: string,
  value: string,
  metric?: string,
): GrowthAttributionRecommendationEvidence {
  return { label, value, metric }
}

function pushRecommendation(
  list: GrowthAttributionRecommendation[],
  seen: Set<string>,
  rec: GrowthAttributionRecommendation,
): void {
  if (seen.has(rec.id)) return
  seen.add(rec.id)
  list.push(rec)
}

function topPerformerRecs(
  rows: GrowthAttributionDimensionRow[],
  dimension: GrowthAttributionImpactedDimension,
  medianRevenue: number,
  seen: Set<string>,
  out: GrowthAttributionRecommendation[],
): void {
  for (const row of rows) {
    if (row.wins < 1 || row.attributedRevenue <= 0) continue
    if (row.key === "no_sequence" || row.key === "no_step" || row.key === "no_sender" || row.key === "unassigned")
      continue
    if (row.attributedRevenue < medianRevenue && row.wins < 2) continue

    const conf = confidenceScore({
      wins: row.wins,
      leadCount: row.leadCount,
      touchCount: row.touchCount,
      revenue: row.attributedRevenue,
    })
    if (conf < 55) continue

    pushRecommendation(out, seen, {
      id: recId("double_down", dimension, row.key),
      recommendationType: "double_down",
      title: `Scale ${row.label}`,
      explanation: `${row.label} shows attributed wins and revenue in the selected window. Consider allocating more qualified volume after human review.`,
      evidence: [
        evidenceRow("Attributed revenue", `$${Math.round(row.attributedRevenue).toLocaleString()}`, "revenue"),
        evidenceRow("Wins", String(row.wins), "wins"),
        evidenceRow("Leads touched", String(row.leadCount), "leads"),
        evidenceRow("Touches", String(row.touchCount), "touches"),
      ],
      confidence: conf,
      impactedDimension: dimension,
      dimensionKey: row.key,
      dimensionLabel: row.label,
      recommendedAction: "Review capacity and test incremental volume on this dimension — no automatic enrollment changes.",
      safetyNotes: GROWTH_ATTRIBUTION_RECOMMENDATION_SAFETY_NOTES,
      category: "high_confidence_win",
    })
  }
}

function underperformerRecs(
  rows: GrowthAttributionDimensionRow[],
  dimension: GrowthAttributionImpactedDimension,
  seen: Set<string>,
  out: GrowthAttributionRecommendation[],
): void {
  for (const row of rows) {
    if (row.touchCount < MIN_TOUCHES_FOR_UNDERPERFORM || row.wins > 0) continue
    if (row.key === "no_sequence" || row.key === "no_step" || row.key === "no_sender" || row.key === "unattributed")
      continue

    const type: GrowthAttributionRecommendationType =
      row.touchCount >= 25 ? "pause_candidate" : row.touchCount >= 15 ? "reduce_volume" : "investigate"

    pushRecommendation(out, seen, {
      id: recId(type, dimension, row.key),
      recommendationType: type,
      title: `Review ${row.label}`,
      explanation: `High touch volume (${row.touchCount}) with zero attributed wins in range. May indicate targeting, copy, or follow-up gaps.`,
      evidence: [
        evidenceRow("Touches", String(row.touchCount), "touches"),
        evidenceRow("Leads", String(row.leadCount), "leads"),
        evidenceRow("Wins", "0", "wins"),
      ],
      confidence: confidenceScore({ wins: 0, leadCount: row.leadCount, touchCount: row.touchCount }),
      impactedDimension: dimension,
      dimensionKey: row.key,
      dimensionLabel: row.label,
      recommendedAction:
        type === "pause_candidate"
          ? "Human review before pausing campaigns or sequences — advisory pause only."
          : "Audit list fit and message-market match before reducing volume.",
      safetyNotes: GROWTH_ATTRIBUTION_RECOMMENDATION_SAFETY_NOTES,
      category: "underperformer",
    })
  }
}

function funnelBottleneckRecs(
  funnel: GrowthAttributionFunnelStep[],
  seen: Set<string>,
  out: GrowthAttributionRecommendation[],
): void {
  const stages = funnel.filter((s) => s.stage !== "lead")
  let weakest: GrowthAttributionFunnelStep | null = null
  for (const step of stages) {
    if (step.conversionRatePct == null) continue
    if (!weakest || (weakest.conversionRatePct ?? 100) > step.conversionRatePct) weakest = step
  }
  if (!weakest || weakest.conversionRatePct == null || weakest.conversionRatePct > 35) return

  const prev = funnel[funnel.findIndex((s) => s.stage === weakest.stage) - 1]
  const type: GrowthAttributionRecommendationType =
    weakest.stage === "reply" || weakest.stage === "meeting"
      ? "improve_follow_up"
      : weakest.stage === "opportunity"
        ? "improve_targeting"
        : "investigate"

  pushRecommendation(out, seen, {
    id: recId(type, "funnel", weakest.stage),
    recommendationType: type,
    title: `Funnel bottleneck at ${weakest.label}`,
    explanation: `Conversion into ${weakest.label} is ${weakest.conversionRatePct}% — the weakest step in the attributed funnel for this window.`,
    evidence: [
      evidenceRow("Stage", weakest.label),
      evidenceRow("Count", String(weakest.count)),
      evidenceRow("Conversion", `${weakest.conversionRatePct}%`),
      evidenceRow("Prior stage", prev?.label ?? "—", prev ? String(prev.count) : undefined),
    ],
    confidence: Math.min(90, 50 + Math.round((35 - weakest.conversionRatePct) * 1.2)),
    impactedDimension: "funnel",
    dimensionKey: weakest.stage,
    dimensionLabel: weakest.label,
    recommendedAction:
      type === "improve_follow_up"
        ? "Review reply SLAs, meeting scheduling, and human follow-up cadence."
        : "Review ICP fit and qualification criteria before opportunity creation.",
    safetyNotes: GROWTH_ATTRIBUTION_RECOMMENDATION_SAFETY_NOTES,
    category: "funnel_bottleneck",
  })
}

function repConversionRecs(
  rows: GrowthAttributionDimensionRow[],
  seen: Set<string>,
  out: GrowthAttributionRecommendation[],
): void {
  const eligible = rows.filter((r) => r.key !== "unassigned" && r.leadCount >= MIN_LEADS_FOR_REP)
  if (eligible.length < 2) return

  const rates = eligible.map((r) => ({ row: r, rate: r.leadCount > 0 ? r.wins / r.leadCount : 0 }))
  const avg = rates.reduce((s, x) => s + x.rate, 0) / rates.length

  for (const { row, rate } of rates) {
    if (row.wins >= 1 && rate >= avg * 1.25) {
      pushRecommendation(out, seen, {
        id: recId("double_down", "rep", row.key),
        recommendationType: "double_down",
        title: `Rep outperforming: ${row.label}`,
        explanation: `Win rate on touched leads (${Math.round(rate * 1000) / 10}%) exceeds team average (${Math.round(avg * 1000) / 10}%) in range.`,
        evidence: [
          evidenceRow("Wins", String(row.wins)),
          evidenceRow("Leads", String(row.leadCount)),
          evidenceRow("Win rate", `${Math.round(rate * 1000) / 10}%`),
        ],
        confidence: confidenceScore({ wins: row.wins, leadCount: row.leadCount, touchCount: row.touchCount }),
        impactedDimension: "rep",
        dimensionKey: row.key,
        dimensionLabel: row.label,
        recommendedAction: "Study rep playbook and handoffs — share patterns with team manually.",
        safetyNotes: GROWTH_ATTRIBUTION_RECOMMENDATION_SAFETY_NOTES,
        category: "high_confidence_win",
      })
    } else if (row.wins === 0 && row.leadCount >= MIN_LEADS_FOR_REP * 2) {
      pushRecommendation(out, seen, {
        id: recId("investigate", "rep", row.key),
        recommendationType: "investigate",
        title: `Rep conversion review: ${row.label}`,
        explanation: `No attributed wins across ${row.leadCount} leads in range — review coaching and handoff quality.`,
        evidence: [
          evidenceRow("Leads", String(row.leadCount)),
          evidenceRow("Touches", String(row.touchCount)),
        ],
        confidence: confidenceScore({ wins: 0, leadCount: row.leadCount, touchCount: row.touchCount }),
        impactedDimension: "rep",
        dimensionKey: row.key,
        dimensionLabel: row.label,
        recommendedAction: "Manager review of active pipeline and response times.",
        safetyNotes: GROWTH_ATTRIBUTION_RECOMMENDATION_SAFETY_NOTES,
        category: "underperformer",
      })
    }
  }
}

function ctaAndPainRecs(
  input: AttributionRecommendationEngineInput,
  seen: Set<string>,
  out: GrowthAttributionRecommendation[],
): void {
  for (const row of input.ctaCategories ?? []) {
    if (row.wins < 1 && row.sendCount < 5) continue
    if (row.wins >= 1) {
      pushRecommendation(out, seen, {
        id: recId("double_down", "cta", row.key),
        recommendationType: "double_down",
        title: `CTA performing: ${row.label}`,
        explanation: `Outreach CTA category correlated with ${row.wins} attributed win(s) in window.`,
        evidence: [
          evidenceRow("Sends tracked", String(row.sendCount)),
          evidenceRow("Wins", String(row.wins)),
          evidenceRow("Positive replies", String(row.positiveReplies)),
        ],
        confidence: confidenceScore({ wins: row.wins, leadCount: row.wins, touchCount: row.sendCount }),
        impactedDimension: "cta",
        dimensionKey: row.key,
        dimensionLabel: row.label,
        recommendedAction: "A/B test similar CTA framing in approved copy — human approval required.",
        safetyNotes: GROWTH_ATTRIBUTION_RECOMMENDATION_SAFETY_NOTES,
        category: "high_confidence_win",
      })
    }
  }

  for (const row of input.painPoints ?? []) {
    if (row.winCount < 1) continue
    pushRecommendation(out, seen, {
      id: recId("improve_copy", "pain_point", row.key),
      recommendationType: "improve_copy",
      title: `Pain point resonates: ${row.label}`,
      explanation: `Research pain theme appears on ${row.winCount} closed-won path(s) — strong messaging signal.`,
      evidence: [
        evidenceRow("Wins", String(row.winCount)),
        evidenceRow("Leads", String(row.leadCount)),
      ],
      confidence: confidenceScore({ wins: row.winCount, leadCount: row.leadCount, touchCount: row.leadCount }),
      impactedDimension: "pain_point",
      dimensionKey: row.key,
      dimensionLabel: row.label,
      recommendedAction: "Emphasize this pain theme in human-reviewed personalization — no auto template changes.",
      safetyNotes: GROWTH_ATTRIBUTION_RECOMMENDATION_SAFETY_NOTES,
      category: "high_confidence_win",
    })
  }
}

function suggestedTestRecs(
  input: AttributionRecommendationEngineInput,
  seen: Set<string>,
  out: GrowthAttributionRecommendation[],
): void {
  if (input.touchesAnalyzed < 20) return

  const replyStep = input.funnel.find((s) => s.stage === "reply")
  const meetingStep = input.funnel.find((s) => s.stage === "meeting")
  if (replyStep && meetingStep && replyStep.count > 3 && meetingStep.count === 0) {
    pushRecommendation(out, seen, {
      id: recId("investigate", "funnel", "reply_to_meeting"),
      recommendationType: "investigate",
      title: "Test meeting conversion path",
      explanation: "Replies recorded but no meeting touches in range — test calendar CTA and human scheduling follow-up.",
      evidence: [
        evidenceRow("Replies", String(replyStep.count)),
        evidenceRow("Meetings", "0"),
      ],
      confidence: 62,
      impactedDimension: "funnel",
      dimensionKey: "reply_to_meeting",
      dimensionLabel: "Reply → Meeting",
      recommendedAction: "Run a controlled test on meeting CTA and rep follow-up SLAs.",
      safetyNotes: GROWTH_ATTRIBUTION_RECOMMENDATION_SAFETY_NOTES,
      category: "suggested_test",
    })
  }

  const channelWithReplies = input.byChannel.find((c) => c.leadCount >= 5 && c.wins === 0 && c.touchCount >= 10)
  if (channelWithReplies) {
    pushRecommendation(out, seen, {
      id: recId("improve_copy", "channel", channelWithReplies.key),
      recommendationType: "improve_copy",
      title: `Copy test on ${channelWithReplies.label}`,
      explanation: "Engagement without wins may indicate messaging mismatch — suggest human-reviewed copy experiment.",
      evidence: [
        evidenceRow("Channel", channelWithReplies.label),
        evidenceRow("Touches", String(channelWithReplies.touchCount)),
        evidenceRow("Leads", String(channelWithReplies.leadCount)),
      ],
      confidence: 58,
      impactedDimension: "channel",
      dimensionKey: channelWithReplies.key,
      dimensionLabel: channelWithReplies.label,
      recommendedAction: "Design an A/B copy test with operator approval — metrics only, no auto send.",
      safetyNotes: GROWTH_ATTRIBUTION_RECOMMENDATION_SAFETY_NOTES,
      category: "suggested_test",
    })
  }
}

export function generateAttributionRecommendations(
  input: AttributionRecommendationEngineInput,
): GrowthRevenueAttributionRecommendationsPayload {
  const seen = new Set<string>()
  const all: GrowthAttributionRecommendation[] = []

  const medianRev = medianAttributedRevenue([
    ...input.byChannel,
    ...input.bySequence,
    ...input.byCampaign,
    ...input.byIndustry,
    ...input.byLeadSource,
  ])

  topPerformerRecs(input.byChannel, "channel", medianRev, seen, all)
  topPerformerRecs(input.bySequence, "sequence", medianRev, seen, all)
  topPerformerRecs(input.byCampaign, "campaign", medianRev, seen, all)
  topPerformerRecs(input.byIndustry, "industry", medianRev, seen, all)
  topPerformerRecs(input.byLeadSource, "lead_source", medianRev, seen, all)
  topPerformerRecs(input.bySenderMailbox, "sender_mailbox", medianRev, seen, all)

  underperformerRecs(input.byCampaign, "campaign", seen, all)
  underperformerRecs(input.bySequence, "sequence", seen, all)
  underperformerRecs(input.bySenderMailbox, "sender_mailbox", seen, all)

  funnelBottleneckRecs(input.funnel, seen, all)
  repConversionRecs(input.byRep, seen, all)
  ctaAndPainRecs(input, seen, all)
  suggestedTestRecs(input, seen, all)

  all.sort((a, b) => b.confidence - a.confidence || b.title.localeCompare(a.title))

  const rollups = buildAttributionClosedLoopRollups(input)

  return {
    qa_marker: GROWTH_REVENUE_ATTRIBUTION_RECOMMENDATIONS_QA_MARKER,
    recommendations: all,
    rollups,
    highConfidenceWins: all.filter((r) => r.category === "high_confidence_win"),
    underperformers: all.filter((r) => r.category === "underperformer"),
    funnelBottlenecks: all.filter((r) => r.category === "funnel_bottleneck"),
    suggestedTests: all.filter((r) => r.category === "suggested_test"),
    lastCalculatedAt: new Date().toISOString(),
  }
}
