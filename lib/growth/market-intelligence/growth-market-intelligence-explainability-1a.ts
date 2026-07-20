/** GE-AIOS-MARKET-INTELLIGENCE-LOOP-1A — Operator explainability lines (client-safe). */

import type { MarketIntelligenceSegmentMetrics } from "@/lib/growth/market-intelligence/growth-market-intelligence-loop-1a-types"

export function buildMarketIntelligenceExplainabilityLines(input: {
  action: string
  confidencePercent: number
  segment: MarketIntelligenceSegmentMetrics
  baselineSegment?: MarketIntelligenceSegmentMetrics | null
  supportingOpportunityCount?: number
}): string[] {
  const lines: string[] = [input.action, `Confidence: ${input.confidencePercent}%`, "Evidence:"]

  if (input.segment.researched > 0) {
    lines.push(`${input.segment.researched} researched`)
  }
  if (input.segment.qualified > 0) {
    lines.push(`${input.segment.qualified} qualified`)
  }
  if (input.segment.meetings > 0) {
    lines.push(`${input.segment.meetings} meetings`)
  }
  if (input.segment.won > 0) {
    lines.push(`${input.segment.won} customers`)
  }
  if (input.segment.churn === 0 && input.segment.retained > 0) {
    lines.push("No increase in churn")
  }

  if (input.baselineSegment) {
    const qualDelta =
      (input.segment.qualificationRate ?? 0) - (input.baselineSegment.qualificationRate ?? 0)
    if (qualDelta > 0) {
      lines.push(`Qualification increased ${Math.round(qualDelta)}% vs ${input.baselineSegment.segmentLabel}`)
    }
    const meetingDelta = (input.segment.meetingRate ?? 0) - (input.baselineSegment.meetingRate ?? 0)
    if (meetingDelta > 0) {
      lines.push(`Meetings increased ${Math.round(meetingDelta)}% vs ${input.baselineSegment.segmentLabel}`)
    }
    const winDelta = (input.segment.winRate ?? 0) - (input.baselineSegment.winRate ?? 0)
    if (winDelta > 0) {
      lines.push(`Win rate increased ${Math.round(winDelta)}% vs ${input.baselineSegment.segmentLabel}`)
    }
  }

  if ((input.supportingOpportunityCount ?? 0) > 0) {
    lines.push(`${input.supportingOpportunityCount} supporting opportunities`)
  }

  return lines
}

export function summarizeMarketIntelligenceProposal(
  recommendations: Array<{ explainabilityLines: string[] }>,
): string {
  const first = recommendations[0]?.explainabilityLines[0]
  return first ?? "Strategic improvements available for your review."
}
