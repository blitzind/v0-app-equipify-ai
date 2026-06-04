/** Opener performance intelligence (Phase 4.6D). Client-safe. */

import { groupOutreachPerformanceBy, topAndBottomPerformers } from "@/lib/growth/outreach/performance/performance-aggregator"
import type {
  OutreachPerformanceAttributedSend,
  OutreachPerformanceGroupRow,
} from "@/lib/growth/outreach/performance/performance-types"

export type OpenerPerformanceAggregation = {
  topPerformers: OutreachPerformanceGroupRow[]
  lowestPerformers: OutreachPerformanceGroupRow[]
  byStrategy: OutreachPerformanceGroupRow[]
  byEvidenceSource: OutreachPerformanceGroupRow[]
  byResearchConfidenceTier: OutreachPerformanceGroupRow[]
}

export function aggregateOpenerPerformance(rows: OutreachPerformanceAttributedSend[]): OpenerPerformanceAggregation {
  const byStrategy = groupOutreachPerformanceBy(
    rows,
    (row) => row.openerStrategyKey,
    (key) => `Opener: ${key}`,
  )
  const byEvidenceSource = groupOutreachPerformanceBy(
    rows,
    (row) => row.openerEvidenceSource ?? "none",
    (key) => `Opener evidence: ${key}`,
  )
  const byResearchConfidenceTier = groupOutreachPerformanceBy(
    rows,
    (row) => row.openerResearchConfidenceTier ?? "none",
    (key) => `Research tier: ${key}`,
  )
  const ranked = topAndBottomPerformers(byStrategy)

  return {
    topPerformers: ranked.topPerformers,
    lowestPerformers: ranked.lowestPerformers,
    byStrategy,
    byEvidenceSource,
    byResearchConfidenceTier,
  }
}
