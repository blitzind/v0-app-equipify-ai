/**
 * Phase 6.35C — Sequence Optimization V2 regression checks.
 * Run: pnpm test:growth-sequence-optimization-recommendations
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { generateSequenceOptimizationRecommendations } from "../lib/growth/sequence-optimization/sequence-optimization-engine"
import {
  GROWTH_SEQUENCE_OPTIMIZATION_RECOMMENDATION_TYPES,
  GROWTH_SEQUENCE_OPTIMIZATION_SAFETY_NOTES,
  GROWTH_SEQUENCE_OPTIMIZATION_V2_QA_MARKER,
} from "../lib/growth/sequence-optimization/sequence-optimization-types"

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
}

function main(): void {
  assert.equal(GROWTH_SEQUENCE_OPTIMIZATION_V2_QA_MARKER, "growth-sequence-optimization-v2-v1")
  assert.equal(GROWTH_SEQUENCE_OPTIMIZATION_RECOMMENDATION_TYPES.length, 9)
  assert.ok(GROWTH_SEQUENCE_OPTIMIZATION_SAFETY_NOTES.includes("No automatic sequence"))

  const result = generateSequenceOptimizationRecommendations({
    bySequence: [
      {
        key: "seq-a",
        label: "Outbound A",
        touchCount: 40,
        leadCount: 30,
        opportunities: 2,
        wins: 1,
        attributedRevenue: 8000,
      },
      {
        key: "seq-b",
        label: "Outbound B",
        touchCount: 25,
        leadCount: 20,
        opportunities: 0,
        wins: 0,
        attributedRevenue: 0,
      },
    ],
    bySequenceStep: [
      {
        key: "step-1",
        label: "Step 1 · email",
        touchCount: 20,
        leadCount: 18,
        opportunities: 0,
        wins: 0,
        attributedRevenue: 0,
      },
      {
        key: "step-2",
        label: "Step 2 · email",
        touchCount: 12,
        leadCount: 10,
        opportunities: 1,
        wins: 1,
        attributedRevenue: 8000,
      },
    ],
    byChannel: [
      { key: "email", label: "email", touchCount: 50, leadCount: 40, opportunities: 1, wins: 0, attributedRevenue: 0 },
      { key: "sms", label: "sms", touchCount: 10, leadCount: 8, opportunities: 1, wins: 1, attributedRevenue: 2000 },
    ],
    funnel: [
      { stage: "lead", label: "Lead", count: 50, conversionRatePct: null, revenue: 0 },
      { stage: "reply", label: "Reply", count: 10, conversionRatePct: 20, revenue: 0 },
      { stage: "meeting", label: "Meeting", count: 0, conversionRatePct: 0, revenue: 0 },
      { stage: "opportunity", label: "Opportunity", count: 2, conversionRatePct: null, revenue: 0 },
      { stage: "closed_won", label: "Closed Won", count: 1, conversionRatePct: 50, revenue: 8000 },
    ],
    sequenceLabels: new Map([
      ["seq-a", "Outbound A"],
      ["seq-b", "Outbound B"],
    ]),
    stepLabels: new Map([
      ["step-1", "Step 1 · email"],
      ["step-2", "Step 2 · email"],
    ]),
    stepMeta: [
      {
        stepId: "step-1",
        sequenceId: "seq-a",
        stepOrder: 1,
        channel: "email",
        delayDaysMin: 0,
        delayDaysMax: 5,
      },
      {
        stepId: "step-2",
        sequenceId: "seq-a",
        stepOrder: 2,
        channel: "email",
        delayDaysMin: 3,
        delayDaysMax: 7,
      },
    ],
    sequenceSnapshots: [{ sequenceId: "seq-b", replyPct: 1, revenue: 0 }],
    subjectSignals: [{ key: "curiosity", label: "Subject: curiosity", sends: 10, replyRatePct: 1 }],
    openerSignals: [{ key: "generic", label: "Opener: generic", sends: 12, replyRatePct: 2 }],
    ctaSignals: [{ key: "calendar", label: "CTA: calendar", sends: 15, wins: 0 }],
    painPoints: [{ key: "labor", label: "Labor cost", winCount: 1, leadCount: 1 }],
    channelEffectiveness: [
      { channel: "sms", effectivenessScore: 72, touchCount: 20 },
      { channel: "email", effectivenessScore: 45, touchCount: 80 },
    ],
    replyQualityBySequence: [
      { sequenceId: "seq-b", replyQualityScore: 40, objectionRate: 30, positiveReplyRate: 10, totalReplies: 8 },
    ],
    touchesAnalyzed: 65,
  })

  assert.equal(result.qa_marker, GROWTH_SEQUENCE_OPTIMIZATION_V2_QA_MARKER)
  assert.ok(result.recommendations.length > 0)

  const types = new Set(result.recommendations.map((r) => r.recommendationType))
  assert.ok(types.has("double_down_on_winning_angle"))
  assert.ok(types.has("pause_underperforming_step") || types.has("remove_step"))
  assert.ok(types.has("improve_subject") || types.has("improve_opener"))

  const first = result.recommendations[0]!
  assert.ok(first.expectedImpact.length > 0)
  assert.ok(first.recommendedEdit.length > 0)
  assert.ok(first.evidence.length > 0)
  assert.ok(first.safetyNotes.includes("Approval-only"))

  const filtered = generateSequenceOptimizationRecommendations({
    bySequence: [
      {
        key: "seq-a",
        label: "Outbound A",
        touchCount: 40,
        leadCount: 30,
        opportunities: 2,
        wins: 1,
        attributedRevenue: 8000,
      },
      {
        key: "seq-other",
        label: "Other",
        touchCount: 30,
        leadCount: 20,
        opportunities: 0,
        wins: 0,
        attributedRevenue: 0,
      },
    ],
    bySequenceStep: [],
    byChannel: [],
    funnel: [],
    sequenceLabels: new Map([
      ["seq-a", "Outbound A"],
      ["seq-other", "Other"],
    ]),
    stepLabels: new Map(),
    stepMeta: [],
    sequenceSnapshots: [],
    subjectSignals: [],
    openerSignals: [],
    ctaSignals: [],
    painPoints: [],
    channelEffectiveness: [],
    replyQualityBySequence: [],
    touchesAnalyzed: 40,
    filterSequenceId: "seq-a",
  })

  assert.ok(
    filtered.recommendations.every((r) => r.sequenceId === null || r.sequenceId === "seq-a"),
  )

  assert.match(
    readSource("lib/growth/sequence-optimization/fetch-growth-sequence-optimization-recommendations.ts"),
    /fetchGrowthRevenueAttributionDashboard/,
  )
  assert.match(readSource("app/api/platform/growth/sequences/optimization/recommendations/route.ts"), /fetchGrowthSequenceOptimizationRecommendations/)
  assert.match(readSource("components/growth/growth-sequence-optimization-recommendations.tsx"), /Mark reviewed/)
  assert.match(readSource("components/growth/growth-sequences-dashboard.tsx"), /GrowthSequenceOptimizationRecommendationsSection/)

  console.log("growth-sequence-optimization-recommendations: ok")
}

main()
