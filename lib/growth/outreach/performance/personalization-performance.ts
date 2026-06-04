/** Personalization utilization performance intelligence (Phase 4.6F). Client-safe. */

import {
  aggregateContextUtilizationBuckets,
  aggregateMemoryCoverageBuckets,
  aggregateMemoryUtilizationBuckets,
  aggregateResearchConfidenceBuckets,
  groupOutreachPerformanceBy,
} from "@/lib/growth/outreach/performance/performance-aggregator"
import type {
  OutreachPerformanceAttributedSend,
  OutreachPerformanceGroupRow,
  OutreachPerformanceUtilizationBucketRow,
} from "@/lib/growth/outreach/performance/performance-types"

export type PersonalizationPerformanceAggregation = {
  contextUtilizationBuckets: OutreachPerformanceUtilizationBucketRow[]
  memoryUtilizationBuckets: OutreachPerformanceUtilizationBucketRow[]
  researchConfidenceBuckets: OutreachPerformanceUtilizationBucketRow[]
  memoryCoverageBuckets: OutreachPerformanceUtilizationBucketRow[]
  leadEngineGuidanceComparison: OutreachPerformanceGroupRow[]
}

export function aggregatePersonalizationPerformance(
  rows: OutreachPerformanceAttributedSend[],
): PersonalizationPerformanceAggregation {
  return {
    contextUtilizationBuckets: aggregateContextUtilizationBuckets(rows),
    memoryUtilizationBuckets: aggregateMemoryUtilizationBuckets(rows),
    researchConfidenceBuckets: aggregateResearchConfidenceBuckets(rows),
    memoryCoverageBuckets: aggregateMemoryCoverageBuckets(rows),
    leadEngineGuidanceComparison: groupOutreachPerformanceBy(
      rows,
      (row) => (row.leadEngineGuidanceUsed ? "lead_engine_guidance" : "no_lead_engine_guidance"),
      (key) =>
        key === "lead_engine_guidance" ? "Lead Engine guidance present" : "No Lead Engine guidance",
    ),
  }
}
