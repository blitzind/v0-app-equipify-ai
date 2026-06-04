/** CTA performance intelligence (Phase 4.6E). Client-safe. */

import { groupOutreachPerformanceBy, topAndBottomPerformers } from "@/lib/growth/outreach/performance/performance-aggregator"
import type {
  OutreachPerformanceAttributedSend,
  OutreachPerformanceGroupRow,
} from "@/lib/growth/outreach/performance/performance-types"

export type CtaPerformanceAggregation = {
  topPerformers: OutreachPerformanceGroupRow[]
  lowestPerformers: OutreachPerformanceGroupRow[]
  byCategory: OutreachPerformanceGroupRow[]
}

export function aggregateCtaPerformance(rows: OutreachPerformanceAttributedSend[]): CtaPerformanceAggregation {
  const byCategory = groupOutreachPerformanceBy(
    rows,
    (row) => row.ctaCategory,
    (key) => `CTA: ${key}`,
  )
  const ranked = topAndBottomPerformers(byCategory)

  return {
    topPerformers: ranked.topPerformers,
    lowestPerformers: ranked.lowestPerformers,
    byCategory,
  }
}
