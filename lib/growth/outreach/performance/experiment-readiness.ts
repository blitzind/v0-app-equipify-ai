/** Experiment readiness infrastructure — no randomization (Phase 4.6H). Client-safe. */

import {
  GROWTH_OUTREACH_PERFORMANCE_QA_MARKER,
  type OutreachPerformanceExperimentComparisonKey,
  type OutreachPerformanceExperimentReadiness,
} from "@/lib/growth/outreach/performance/performance-types"

function comparisonId(dimension: string, armA: string, armB: string): string {
  return `oexp-${dimension}-${armA}-vs-${armB}`
}

export function buildOutreachPerformanceExperimentReadiness(): OutreachPerformanceExperimentReadiness {
  const predefinedComparisons: OutreachPerformanceExperimentComparisonKey[] = [
    {
      comparisonId: comparisonId("subject", "memory_aware", "research_observation"),
      dimension: "subject",
      armAKey: "memory_aware",
      armBKey: "research_observation",
      armALabel: "Memory-aware subjects",
      armBLabel: "Research observation subjects",
    },
    {
      comparisonId: comparisonId("opener", "memory_backed", "research_backed"),
      dimension: "strategy",
      armAKey: "memory_backed",
      armBKey: "research_backed",
      armALabel: "Memory-backed openers",
      armBLabel: "Research-backed openers",
    },
    {
      comparisonId: comparisonId("cta", "question_based", "meeting"),
      dimension: "cta",
      armAKey: "question_based",
      armBKey: "meeting",
      armALabel: "Question CTAs",
      armBLabel: "Meeting CTAs",
    },
    {
      comparisonId: comparisonId("personalization", "high_memory_utilization", "low_memory_utilization"),
      dimension: "personalization",
      armAKey: "76-100",
      armBKey: "0-25",
      armALabel: "High memory utilization (76–100%)",
      armBLabel: "Low memory utilization (0–25%)",
    },
  ]

  return {
    qa_marker: GROWTH_OUTREACH_PERFORMANCE_QA_MARKER,
    supportedDimensions: ["strategy", "subject", "cta", "personalization"],
    predefinedComparisons,
    notes: [
      "Comparison keys are stable — future experiments can reference armAKey/armBKey without changing production behavior.",
      "No randomization or holdout assignment is performed by this module.",
      "Use outreach_performance_attributions.attribution_id for experiment arm assignment when experiments launch.",
    ],
  }
}

export function filterAttributedSendsForComparison<T extends { subjectCategory?: string; openerStrategyKey?: string; ctaCategory?: string; memoryUtilizationPercentage?: number | null }>(
  rows: T[],
  comparison: OutreachPerformanceExperimentComparisonKey,
): { armA: T[]; armB: T[] } {
  const inArm = (row: T, armKey: string): boolean => {
    switch (comparison.dimension) {
      case "subject":
        return row.subjectCategory === armKey
      case "strategy":
        return row.openerStrategyKey === armKey
      case "cta":
        return row.ctaCategory === armKey
      case "personalization":
        if (armKey === "76-100") return (row.memoryUtilizationPercentage ?? 0) >= 76
        if (armKey === "0-25") return (row.memoryUtilizationPercentage ?? 0) <= 25
        return false
      default:
        return false
    }
  }

  return {
    armA: rows.filter((row) => inArm(row, comparison.armAKey)),
    armB: rows.filter((row) => inArm(row, comparison.armBKey)),
  }
}
