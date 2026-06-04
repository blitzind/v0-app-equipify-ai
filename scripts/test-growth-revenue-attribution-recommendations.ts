/**
 * Phase 6.32B-3 — Attribution closed-loop recommendations regression.
 * Run: pnpm test:growth-revenue-attribution-recommendations
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { generateAttributionRecommendations } from "../lib/growth/revenue-attribution/attribution-recommendation-engine"
import {
  GROWTH_ATTRIBUTION_RECOMMENDATION_TYPES,
  GROWTH_REVENUE_ATTRIBUTION_RECOMMENDATIONS_QA_MARKER,
} from "../lib/growth/revenue-attribution/attribution-recommendation-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  assert.equal(GROWTH_REVENUE_ATTRIBUTION_RECOMMENDATIONS_QA_MARKER, "growth-revenue-attribution-recommendations-v1")
  assert.equal(GROWTH_ATTRIBUTION_RECOMMENDATION_TYPES.length, 7)

  const result = generateAttributionRecommendations({
    funnel: [
      { stage: "lead", label: "Lead", count: 100, conversionRatePct: null, revenue: 0 },
      { stage: "reply", label: "Reply", count: 20, conversionRatePct: 20, revenue: 0 },
      { stage: "meeting", label: "Meeting", count: 2, conversionRatePct: 10, revenue: 0 },
      { stage: "opportunity", label: "Opportunity", count: 2, conversionRatePct: 100, revenue: 0 },
      { stage: "closed_won", label: "Closed Won", count: 1, conversionRatePct: 50, revenue: 5000 },
    ],
    byChannel: [
      { key: "email", label: "email", touchCount: 50, leadCount: 40, opportunities: 2, wins: 1, attributedRevenue: 5000 },
      { key: "sms", label: "sms", touchCount: 30, leadCount: 25, opportunities: 0, wins: 0, attributedRevenue: 0 },
    ],
    bySequence: [
      { key: "seq-a", label: "Seq A", touchCount: 40, leadCount: 30, opportunities: 2, wins: 1, attributedRevenue: 5000 },
      { key: "seq-b", label: "Seq B", touchCount: 20, leadCount: 15, opportunities: 0, wins: 0, attributedRevenue: 0 },
    ],
    bySequenceStep: [],
    byCampaign: [
      { key: "camp-1", label: "Camp 1", touchCount: 15, leadCount: 10, opportunities: 0, wins: 0, attributedRevenue: 0 },
    ],
    byRep: [
      { key: "rep-1", label: "rep-1", touchCount: 20, leadCount: 10, opportunities: 1, wins: 1, attributedRevenue: 5000 },
    ],
    bySenderMailbox: [],
    byIndustry: [],
    byLeadSource: [],
    ctaCategories: [{ key: "fifteen_minute", label: "CTA: fifteen_minute", sendCount: 10, wins: 1, positiveReplies: 2 }],
    painPoints: [{ key: "labor_cost", label: "Labor cost pressure", winCount: 1, leadCount: 1 }],
    touchesAnalyzed: 80,
  })

  assert.ok(result.recommendations.length > 0)
  assert.ok(result.highConfidenceWins.length > 0)
  assert.ok(result.rollups.channel.topChannels.length > 0)
  assert.ok(result.funnelBottlenecks.length > 0 || result.suggestedTests.length > 0)

  const first = result.recommendations[0]!
  assert.ok(first.safetyNotes.includes("Advisory"))
  assert.ok(first.evidence.length > 0)
  assert.ok(first.confidence >= 0 && first.confidence <= 98)

  assert.match(
    readSource("lib/growth/revenue-attribution/fetch-growth-revenue-attribution-recommendations.ts"),
    /listAttributionTouchesInRange/,
  )
  assert.match(readSource("lib/growth/revenue-attribution/attribution-recommendation-queries.ts"), /outreach_performance_attributions/)
  assert.match(readSource("app/api/platform/growth/revenue-attribution/recommendations/route.ts"), /fetchGrowthRevenueAttributionRecommendations/)
  assert.match(readSource("components/growth/growth-revenue-attribution-recommendations.tsx"), /Mark reviewed/)
  assert.match(readSource("components/growth/growth-revenue-attribution-dashboard.tsx"), /GrowthRevenueAttributionRecommendationsSection/)

  console.log("growth revenue attribution recommendations tests passed")
}

main()
