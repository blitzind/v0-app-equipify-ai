/** Outreach performance grouping and aggregation (Phase 4.6). Client-safe. */

import {
  bucketNumericScore,
  bucketUtilizationPercentage,
  computeOutreachPerformanceRates,
  sortPerformanceGroups,
} from "@/lib/growth/outreach/performance/performance-metrics"
import type {
  OutreachPerformanceAttributedSend,
  OutreachPerformanceExecutiveSummary,
  OutreachPerformanceGroupRow,
  OutreachPerformanceUtilizationBucketRow,
} from "@/lib/growth/outreach/performance/performance-types"

export function groupOutreachPerformanceBy<T>(
  rows: OutreachPerformanceAttributedSend[],
  selector: (row: OutreachPerformanceAttributedSend) => T,
  label: (value: T) => string,
): OutreachPerformanceGroupRow[] {
  const groups = new Map<string, OutreachPerformanceAttributedSend[]>()

  for (const row of rows) {
    const value = selector(row)
    const key = String(value)
    const bucket = groups.get(key) ?? []
    bucket.push(row)
    groups.set(key, bucket)
  }

  return [...groups.entries()].map(([groupKey, groupRows]) => {
    const metrics = computeOutreachPerformanceRates(groupRows)
    return {
      groupKey,
      groupLabel: label(groupKey),
      ...metrics,
    }
  })
}

export function buildExecutiveSummary(
  rows: OutreachPerformanceAttributedSend[],
  measurementWindowDays: number,
): OutreachPerformanceExecutiveSummary {
  const metrics = computeOutreachPerformanceRates(rows)
  return {
    ...metrics,
    attributedSendCount: rows.length,
    measurementWindowDays,
  }
}

export function topAndBottomPerformers(
  rows: OutreachPerformanceGroupRow[],
  limit = 5,
): { topPerformers: OutreachPerformanceGroupRow[]; lowestPerformers: OutreachPerformanceGroupRow[] } {
  const eligible = rows.filter((row) => row.sends >= 1)
  return {
    topPerformers: sortPerformanceGroups(eligible, "desc").slice(0, limit),
    lowestPerformers: sortPerformanceGroups(eligible, "asc").slice(0, limit),
  }
}

export function aggregateUtilizationBuckets(
  rows: OutreachPerformanceAttributedSend[],
  selector: (row: OutreachPerformanceAttributedSend) => number | null | undefined,
  bucketFn: (value: number | null | undefined) => {
    bucketLabel: string
    bucketMin: number
    bucketMax: number
  },
): OutreachPerformanceUtilizationBucketRow[] {
  const groups = new Map<string, OutreachPerformanceAttributedSend[]>()

  for (const row of rows) {
    const bucket = bucketFn(selector(row))
    const bucketRows = groups.get(bucket.bucketLabel) ?? []
    bucketRows.push(row)
    groups.set(bucket.bucketLabel, bucketRows)
  }

  return [...groups.entries()].map(([bucketLabel, bucketRows]) => {
    const bucket = bucketFn(selector(bucketRows[0]!))
    return {
      bucketLabel,
      bucketMin: bucket.bucketMin,
      bucketMax: bucket.bucketMax,
      ...computeOutreachPerformanceRates(bucketRows),
    }
  })
}

export function aggregateContextUtilizationBuckets(
  rows: OutreachPerformanceAttributedSend[],
): OutreachPerformanceUtilizationBucketRow[] {
  return aggregateUtilizationBuckets(rows, (row) => row.contextUtilizationPercentage, bucketUtilizationPercentage)
}

export function aggregateMemoryUtilizationBuckets(
  rows: OutreachPerformanceAttributedSend[],
): OutreachPerformanceUtilizationBucketRow[] {
  return aggregateUtilizationBuckets(rows, (row) => row.memoryUtilizationPercentage, bucketUtilizationPercentage)
}

export function aggregateResearchConfidenceBuckets(
  rows: OutreachPerformanceAttributedSend[],
): OutreachPerformanceUtilizationBucketRow[] {
  return aggregateUtilizationBuckets(rows, (row) => row.researchConfidence, (value) =>
    bucketNumericScore(value, "Research confidence"),
  )
}

export function aggregateMemoryCoverageBuckets(
  rows: OutreachPerformanceAttributedSend[],
): OutreachPerformanceUtilizationBucketRow[] {
  return aggregateUtilizationBuckets(rows, (row) => row.memoryCoverageScore, (value) =>
    bucketNumericScore(value, "Memory coverage"),
  )
}
