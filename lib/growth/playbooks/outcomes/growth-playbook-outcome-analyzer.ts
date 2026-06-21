/** GS-AI-PLAYBOOK-3C — Outcome analyzer (client-safe). */

import { summarizeOutcomeRates } from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-builder"
import type {
  GrowthPlaybookOutcomeGuidanceFilter,
  GrowthPlaybookOutcomeMetrics,
  GrowthPlaybookOutcomeRecord,
  GrowthPlaybookOutcomeSegmentMetrics,
} from "@/lib/growth/playbooks/outcomes/growth-playbook-outcome-types"

function daysSince(iso: string, now = Date.now()): number {
  const ts = Date.parse(iso)
  if (!Number.isFinite(ts)) return 0
  return Math.max(0, Math.round((now - ts) / (1000 * 60 * 60 * 24)))
}

function computeFreshnessDays(records: GrowthPlaybookOutcomeRecord[]): number {
  if (records.length === 0) return 0
  const ages = records.map((row) => daysSince(row.recordedAt))
  return Math.round(ages.reduce((sum, value) => sum + value, 0) / ages.length)
}

function filterRecords(
  records: GrowthPlaybookOutcomeRecord[],
  filter?: GrowthPlaybookOutcomeGuidanceFilter,
): GrowthPlaybookOutcomeRecord[] {
  if (!filter) return records
  return records.filter((row) => {
    if (filter.industryId && row.industryId !== filter.industryId) return false
    if (filter.personaArchetype && row.personaArchetype !== filter.personaArchetype) return false
    if (filter.channel && row.channel !== filter.channel) return false
    return true
  })
}

function buildMetrics(records: GrowthPlaybookOutcomeRecord[]): GrowthPlaybookOutcomeMetrics {
  const rates = summarizeOutcomeRates(records)
  return {
    sampleSize: records.length,
    freshnessDays: computeFreshnessDays(records),
    ...rates,
  }
}

function segmentKey(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join("|") || "global"
}

export function analyzeGrowthPlaybookOutcomes(input: {
  records: GrowthPlaybookOutcomeRecord[]
  filter?: GrowthPlaybookOutcomeGuidanceFilter
}): {
  overall: GrowthPlaybookOutcomeMetrics
  segments: GrowthPlaybookOutcomeSegmentMetrics[]
} {
  const filtered = filterRecords(input.records, input.filter)
  const overall = buildMetrics(filtered)

  const segmentMap = new Map<string, GrowthPlaybookOutcomeRecord[]>()
  for (const record of filtered) {
    for (const key of [
      segmentKey(["industry", record.industryId]),
      segmentKey(["persona", record.personaArchetype]),
      segmentKey(["channel", record.channel]),
      segmentKey(["cta", record.ctaType]),
      segmentKey(["proof", record.proofType]),
      segmentKey(["narrative", record.narrativeType]),
      segmentKey(["industry", record.industryId, "persona", record.personaArchetype]),
      segmentKey([
        "industry",
        record.industryId,
        "persona",
        record.personaArchetype,
        "channel",
        record.channel,
      ]),
    ]) {
      const bucket = segmentMap.get(key) ?? []
      bucket.push(record)
      segmentMap.set(key, bucket)
    }
  }

  const segments: GrowthPlaybookOutcomeSegmentMetrics[] = [...segmentMap.entries()]
    .map(([key, rows]) => {
      const metrics = buildMetrics(rows)
      const sample = rows[0]
      return {
        segmentKey: key,
        industryId: sample?.industryId ?? null,
        personaArchetype: sample?.personaArchetype ?? null,
        channel: key.startsWith("channel|") ? sample?.channel ?? null : null,
        ctaType: key.startsWith("cta|") ? sample?.ctaType ?? null : null,
        proofType: key.startsWith("proof|") ? sample?.proofType ?? null : null,
        narrativeType: key.startsWith("narrative|") ? sample?.narrativeType ?? null : null,
        ...metrics,
      }
    })
    .filter((entry) => entry.sampleSize >= 1)
    .sort((a, b) => b.sampleSize - a.sampleSize)

  return { overall, segments }
}

export function topPerformingOutcomeValues<T extends string>(
  segments: GrowthPlaybookOutcomeSegmentMetrics[],
  prefix: string,
  valueSelector: (segment: GrowthPlaybookOutcomeSegmentMetrics) => T | null,
  metric: "approvalRate" | "replyRate" | "meetingRate" | "operatorHelpfulRate" = "approvalRate",
  minSamples = 3,
): Array<{ value: T; score: number; sampleSize: number }> {
  return segments
    .filter((segment) => segment.segmentKey.startsWith(`${prefix}|`) && segment.sampleSize >= minSamples)
    .map((segment) => ({
      value: valueSelector(segment),
      score: segment[metric] ?? 0,
      sampleSize: segment.sampleSize,
    }))
    .filter((entry): entry is { value: T; score: number; sampleSize: number } => Boolean(entry.value))
    .sort((a, b) => b.score - a.score || b.sampleSize - a.sampleSize)
}

export function bottomPerformingOutcomePatterns(
  segments: GrowthPlaybookOutcomeSegmentMetrics[],
  minSamples = 3,
): string[] {
  const patterns: string[] = []
  for (const segment of segments) {
    if (segment.sampleSize < minSamples) continue
    if (segment.segmentKey.startsWith("cta|") && (segment.approvalRate ?? 100) <= 35) {
      patterns.push(`Generic or weak CTA pattern (${segment.segmentKey.replace("cta|", "")})`)
    }
    if (segment.regenerationRate != null && segment.regenerationRate >= 45) {
      patterns.push(`High regeneration in ${segment.segmentKey}`)
    }
  }
  return [...new Set(patterns)]
}
