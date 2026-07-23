/**
 * AVA-GROWTH-OPERATOR-1E — Growth Intelligence & Continuous Optimization certification.
 * Run: pnpm test:ava-growth-operator-1e-growth-intelligence
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import {
  GROWTH_AIOS_GROWTH_OPERATOR_1E_QA_MARKER,
  GROWTH_EXECUTIVE_RECOMMENDATION_CATEGORIES,
} from "../lib/growth/aios/growth-intelligence/growth-executive-growth-intelligence-types-1e"
import {
  assertGrowthIntelligenceRecommendationGovernance,
  GROWTH_EXECUTIVE_GROWTH_INTELLIGENCE_MUTATION_POLICY,
} from "../lib/growth/aios/growth-intelligence/growth-executive-growth-intelligence-governance-1e"
import {
  collectAllExecutiveGrowthRecommendations,
  collectExecutiveRecommendationsFromClosedLoopInsights,
  collectExecutiveRecommendationsFromSegmentAnalytics,
} from "../lib/growth/aios/growth-intelligence/growth-executive-growth-intelligence-collectors-1e"
import {
  buildGrowthExecutiveGrowthReport,
  synthesizeGrowthExecutiveGrowthIntelligence,
} from "../lib/growth/aios/growth-intelligence/growth-executive-growth-intelligence-synthesizer-1e"
import type { GrowthLearningInsight } from "../lib/growth/aios/learning/growth-closed-loop-learning-types"

export const AVA_GROWTH_OPERATOR_1E_QA_MARKER = "ava-growth-operator-1e-growth-intelligence-v1" as const

const ROOT = process.cwd()

function closedLoopInsightFixture(overrides: Partial<GrowthLearningInsight> = {}): GrowthLearningInsight {
  return {
    id: "insight-fixture",
    organizationId: "org-fixture",
    insightType: "channel_performance",
    title: "Email outperforming LinkedIn",
    summary: "Shorter first-touch emails outperform longer messages in recent observations.",
    recommendedAdjustment: "test_variant",
    targetSystem: "communication_engine",
    confidence: 0.72,
    impact: 0.4,
    sampleSize: 12,
    evidence: [{ source: "email", label: "Reply rate", value: "18%" }],
    status: "advisory",
    createdAt: "2026-07-23T12:00:00.000Z",
    ...overrides,
  }
}

function runCertification(): void {
  console.log(`[${AVA_GROWTH_OPERATOR_1E_QA_MARKER}] AVA-GROWTH-OPERATOR-1E certification`)

  assert.equal(GROWTH_AIOS_GROWTH_OPERATOR_1E_QA_MARKER, AVA_GROWTH_OPERATOR_1E_QA_MARKER)

  const docPath = path.join(ROOT, "docs/AVA-GROWTH-OPERATOR-1E_GROWTH_INTELLIGENCE.md")
  assert.ok(fs.existsSync(docPath), "1E documentation must exist")

  assert.equal(GROWTH_EXECUTIVE_GROWTH_INTELLIGENCE_MUTATION_POLICY.autoMutateIcp, false)
  assert.equal(GROWTH_EXECUTIVE_GROWTH_INTELLIGENCE_MUTATION_POLICY.autoMutateBudgets, false)
  assert.equal(GROWTH_EXECUTIVE_GROWTH_INTELLIGENCE_MUTATION_POLICY.recommendationOnly, true)
  assert.ok(
    assertGrowthIntelligenceRecommendationGovernance({
      requiresOperatorApproval: true,
      recommendationOnly: true,
    }),
  )

  assert.ok(GROWTH_EXECUTIVE_RECOMMENDATION_CATEGORIES.includes("icp"))
  assert.ok(GROWTH_EXECUTIVE_RECOMMENDATION_CATEGORIES.includes("discovery"))
  assert.ok(GROWTH_EXECUTIVE_RECOMMENDATION_CATEGORIES.includes("outreach"))
  assert.ok(GROWTH_EXECUTIVE_RECOMMENDATION_CATEGORIES.includes("organizational_learning"))

  const closedLoopRecs = collectExecutiveRecommendationsFromClosedLoopInsights({
    insights: [closedLoopInsightFixture()],
  })
  assert.ok(closedLoopRecs.length >= 1)
  assert.equal(closedLoopRecs[0]?.requiresOperatorApproval, true)
  assert.equal(closedLoopRecs[0]?.recommendationOnly, true)
  assert.match(closedLoopRecs[0]?.headline ?? "", /^I recommend/)

  const segmentRecs = collectExecutiveRecommendationsFromSegmentAnalytics({
    segments: [
      {
        dimension: "industry",
        segmentKey: "electrical_utilities",
        segmentLabel: "Electrical Utilities",
        researched: 214,
        admitted: 2,
        qualified: 0,
        meetings: 0,
        approvals: 0,
        opportunities: 0,
        won: 0,
        lost: 0,
        retained: 0,
        expansion: 0,
        churn: 0,
        lifetimeValue: null,
        researchRate: null,
        admissionRate: null,
        qualificationRate: 0,
        meetingRate: 0,
        approvalRate: null,
        opportunityRate: null,
        winRate: null,
        retentionRate: null,
        expansionRate: null,
      },
      {
        dimension: "industry",
        segmentKey: "commercial_kitchen_equipment",
        segmentLabel: "Commercial Kitchen Equipment",
        researched: 48,
        admitted: 22,
        qualified: 14,
        meetings: 4,
        approvals: 3,
        opportunities: 2,
        won: 0,
        lost: 0,
        retained: 0,
        expansion: 0,
        churn: 0,
        lifetimeValue: null,
        researchRate: null,
        admissionRate: null,
        qualificationRate: 29,
        meetingRate: 8,
        approvalRate: null,
        opportunityRate: null,
        winRate: null,
        retentionRate: null,
        expansionRate: null,
      },
    ],
  })
  assert.ok(segmentRecs.some((row) => /retiring|expanding/i.test(row.headline)))

  const intelligence = synthesizeGrowthExecutiveGrowthIntelligence({
    generatedAt: "2026-07-23T12:00:00.000Z",
    closedLoopInsights: [closedLoopInsightFixture()],
    segmentMetrics: [
      {
        dimension: "industry",
        segmentKey: "electrical_utilities",
        segmentLabel: "Electrical Utilities",
        researched: 214,
        admitted: 2,
        qualified: 0,
        meetings: 0,
        approvals: 0,
        opportunities: 0,
        won: 0,
        lost: 0,
        retained: 0,
        expansion: 0,
        churn: 0,
        lifetimeValue: null,
        researchRate: null,
        admissionRate: null,
        qualificationRate: 0,
        meetingRate: 0,
        approvalRate: null,
        opportunityRate: null,
        winRate: null,
        retentionRate: null,
        expansionRate: null,
      },
    ],
    salesOutcomes: {
      qaMarker: "ge-aios-17a-specialist-execution-bridge-v1",
      outcomes: [],
      dailySummary: {
        qaMarker: "ge-aios-17a-specialist-execution-bridge-v1",
        generatedAt: "2026-07-23T12:00:00.000Z",
        researched: 12,
        qualified: 4,
        strong_opportunities: 2,
        outreach_prepared: 3,
        meetings_prepared: 1,
        approvals_pending: 2,
      },
    },
  })

  assert.equal(intelligence.qaMarker, AVA_GROWTH_OPERATOR_1E_QA_MARKER)
  assert.ok(intelligence.recommendations.length >= 1)
  for (const rec of intelligence.recommendations) {
    assert.equal(rec.requiresOperatorApproval, true)
    assert.equal(rec.recommendationOnly, true)
  }

  const report = buildGrowthExecutiveGrowthReport({
    generatedAt: "2026-07-23T12:00:00.000Z",
    recommendations: intelligence.recommendations,
    salesOutcomes: {
      qaMarker: "ge-aios-17a-specialist-execution-bridge-v1",
      outcomes: [],
      dailySummary: {
        qaMarker: "ge-aios-17a-specialist-execution-bridge-v1",
        generatedAt: "2026-07-23T12:00:00.000Z",
        researched: 12,
        qualified: 4,
        strong_opportunities: 2,
        outreach_prepared: 3,
        meetings_prepared: 1,
        approvals_pending: 2,
      },
    },
  })

  assert.equal(report.title, "Executive Growth Report")
  assert.ok(report.whatImproved.length >= 1)
  assert.ok(report.topRecommendations.length >= 1)
  assert.ok(report.decisionsRequiringApproval.every((line) => /approval/i.test(line)))

  const merged = collectAllExecutiveGrowthRecommendations({
    closedLoopInsights: [closedLoopInsightFixture(), closedLoopInsightFixture({ id: "dup" })],
    segmentMetrics: [],
  })
  assert.ok(merged.length >= 1)

  const collectorsSource = fs.readFileSync(
    path.join(ROOT, "lib/growth/aios/growth-intelligence/growth-executive-growth-intelligence-collectors-1e.ts"),
    "utf8",
  )
  assert.match(collectorsSource, /closed_loop_learning/)
  assert.match(collectorsSource, /market_intelligence/)
  assert.match(collectorsSource, /portfolio_health/)
  assert.doesNotMatch(collectorsSource, /upsertClosedLoop|insertLearningEngine/)

  const homeSection = fs.readFileSync(
    path.join(ROOT, "components/growth/workspace/executive-briefing/growth-home-executive-growth-report-section.tsx"),
    "utf8",
  )
  assert.match(homeSection, /requires your approval/)
  assert.match(homeSection, /GROWTH_AIOS_GROWTH_OPERATOR_1E_QA_MARKER/)

  console.log(`[${AVA_GROWTH_OPERATOR_1E_QA_MARKER}] PASS`)
}

runCertification()
