/** Subject performance intelligence (Phase 4.6C). Client-safe. */

import { groupOutreachPerformanceBy, topAndBottomPerformers } from "@/lib/growth/outreach/performance/performance-aggregator"
import type {
  OutreachPerformanceAttributedSend,
  OutreachPerformanceGroupRow,
} from "@/lib/growth/outreach/performance/performance-types"

export type SubjectPerformanceAggregation = {
  topPerformers: OutreachPerformanceGroupRow[]
  lowestPerformers: OutreachPerformanceGroupRow[]
  byCategory: OutreachPerformanceGroupRow[]
  byEvidenceSource: OutreachPerformanceGroupRow[]
  memoryAwareVsGeneric: OutreachPerformanceGroupRow[]
  researchBackedVsGeneric: OutreachPerformanceGroupRow[]
}

export function aggregateSubjectPerformance(rows: OutreachPerformanceAttributedSend[]): SubjectPerformanceAggregation {
  const byCategory = groupOutreachPerformanceBy(
    rows,
    (row) => row.subjectCategory,
    (key) => `Subject category: ${key}`,
  )
  const byEvidenceSource = groupOutreachPerformanceBy(
    rows,
    (row) => row.subjectEvidenceSource,
    (key) => `Subject evidence: ${key}`,
  )
  const memoryAwareVsGeneric = groupOutreachPerformanceBy(
    rows,
    (row) => (row.subjectMemoryAware ? "memory_aware" : "non_memory"),
    (key) => (key === "memory_aware" ? "Memory-aware subjects" : "Non-memory subjects"),
  )
  const researchBackedVsGeneric = groupOutreachPerformanceBy(
    rows,
    (row) => (row.subjectResearchBacked ? "research_backed" : "non_research"),
    (key) => (key === "research_backed" ? "Research-backed subjects" : "Non-research subjects"),
  )

  const byStrategy = groupOutreachPerformanceBy(
    rows,
    (row) => row.subjectStrategyKey,
    (key) => `Subject strategy: ${key}`,
  )
  const ranked = topAndBottomPerformers(byStrategy)

  return {
    topPerformers: ranked.topPerformers,
    lowestPerformers: ranked.lowestPerformers,
    byCategory,
    byEvidenceSource,
    memoryAwareVsGeneric,
    researchBackedVsGeneric,
  }
}
