/** Deterministic company-level Intent Signals rollup (Milestone E). Client-safe. */

import { normalizeDomain } from "@/lib/growth/company-identification/company-identification-normalize"
import { readHiringVelocityFromMetadata } from "@/lib/growth/signals/hiring-velocity-ui-helpers"
import { readPersonSignalMetadata } from "@/lib/growth/signals/person-signal-metadata"
import type { GrowthSignalRow, GrowthSignalType } from "@/lib/growth/signals/signal-types"

export const GROWTH_SIGNAL_MOMENTUM_QA_MARKER = "growth-signal-momentum-v1" as const

export const GROWTH_SIGNAL_MOMENTUM_LABELS = [
  "Quiet",
  "Emerging",
  "Active",
  "High Intent",
  "Priority",
] as const

export type GrowthSignalMomentumLabel = (typeof GROWTH_SIGNAL_MOMENTUM_LABELS)[number]

export type GrowthSignalWatchlistMatchRef = {
  watchlist_id: string
  watchlist_name: string
  signal_id: string
}

export type GrowthCompanySignalRollupInput = {
  domain?: string | null
  company_id?: string | null
  company_name?: string | null
  organization_id?: string | null
  signals: GrowthSignalRow[]
  watchlist_matches?: GrowthSignalWatchlistMatchRef[]
  now?: Date
}

export type GrowthCompanySignalRollup = {
  qa_marker: typeof GROWTH_SIGNAL_MOMENTUM_QA_MARKER
  total_signal_count: number
  high_urgency_count: number
  news_count: number
  job_posting_count: number
  hiring_signal_count: number
  job_change_count: number
  promotion_count: number
  people_signal_count: number
  watchlist_match_count: number
  average_signal_score: number
  max_signal_score: number
  latest_signal_at: string | null
  latest_signal_summary: string | null
  top_signal_types: GrowthSignalType[]
  top_categories: string[]
  hiring_intensity: string | null
  momentum_score: number
  momentum_label: GrowthSignalMomentumLabel
  momentum_base_score: number
  watchlist_boost: number
  evidence_count: number
  signal_ids: string[]
  counts_24h: number
  counts_7d: number
  counts_30d: number
  counts_90d: number
  watchlist_matches: Array<{ watchlist_id: string; watchlist_name: string }>
}

const MS_24H = 24 * 60 * 60 * 1000
const MS_7D = 7 * MS_24H
const MS_30D = 30 * MS_24H
const MS_90D = 90 * MS_24H

const HIGH_URGENCY = new Set(["high", "urgent"])

function normalizeCompanyName(name: string | null | undefined): string {
  return name?.trim().toLowerCase().replace(/\s+/g, " ") ?? ""
}

function parseOccurredMs(iso: string): number {
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : 0
}

export function formatSignalTypeLabel(type: GrowthSignalType): string {
  switch (type) {
    case "website_visitor":
      return "Website"
    case "news_event":
      return "News"
    case "job_posting":
      return "Jobs"
    case "hire":
      return "Hiring"
    case "job_change":
      return "Job Change"
    case "promotion":
      return "Promotion"
    default:
      return type.replace(/_/g, " ")
  }
}

export function signalMatchesCompanyRollupTarget(
  signal: GrowthSignalRow,
  target: { domain?: string | null; company_id?: string | null; company_name?: string | null },
): boolean {
  const targetDomain = normalizeDomain(target.domain)
  const signalDomain = normalizeDomain(signal.domain)

  if (target.company_id && signal.company_id && target.company_id === signal.company_id) {
    return true
  }

  if (targetDomain && signalDomain && targetDomain === signalDomain) {
    return true
  }

  if (!targetDomain) return false

  const targetName = normalizeCompanyName(target.company_name)
  const signalName = normalizeCompanyName(signal.company_name)
  if (
    targetName &&
    signalName &&
    targetName === signalName &&
    targetName.length >= 3
  ) {
    return true
  }

  return false
}

export function filterSignalsForCompanyRollup(
  signals: GrowthSignalRow[],
  target: { domain?: string | null; company_id?: string | null; company_name?: string | null },
): GrowthSignalRow[] {
  return signals.filter((signal) => signalMatchesCompanyRollupTarget(signal, target))
}

function countInWindow(signals: GrowthSignalRow[], cutoffMs: number, nowMs: number): number {
  return signals.filter((signal) => {
    const ms = parseOccurredMs(signal.occurred_at)
    return ms >= cutoffMs && ms <= nowMs
  }).length
}

function computeRecencyScore(latestMs: number, nowMs: number): number {
  if (latestMs <= 0) return 0
  const ageHours = (nowMs - latestMs) / (60 * 60 * 1000)
  if (ageHours <= 24) return 20
  if (ageHours <= 72) return 16
  if (ageHours <= 168) return 12
  if (ageHours <= 720) return 8
  if (ageHours <= 2160) return 4
  return 0
}

function computeVolumeScore(count30d: number): number {
  if (count30d <= 0) return 0
  if (count30d === 1) return 6
  if (count30d <= 3) return 12
  if (count30d <= 6) return 16
  return 20
}

function computeCategoryBoost(signals: GrowthSignalRow[]): number {
  let boost = 0
  const hasNews = signals.some((s) => s.signal_type === "news_event")
  const hasHiring = signals.some((s) => s.signal_type === "hire" || s.signal_type === "job_posting")
  const hasPeople = signals.some(
    (s) =>
      (s.signal_type === "job_change" || s.signal_type === "promotion") &&
      (readPersonSignalMetadata(s).identity_confidence ?? 0) >= 0.75,
  )
  if (hasNews) boost += 2
  if (hasHiring) boost += 3
  if (hasPeople) boost += 4
  return Math.min(8, boost)
}

export function deriveMomentumLabel(score: number): GrowthSignalMomentumLabel {
  if (score >= 76) return "Priority"
  if (score >= 56) return "High Intent"
  if (score >= 36) return "Active"
  if (score >= 16) return "Emerging"
  return "Quiet"
}

export function buildCompanySignalRollup(input: GrowthCompanySignalRollupInput): GrowthCompanySignalRollup {
  const nowMs = (input.now ?? new Date()).getTime()
  const cutoff24h = nowMs - MS_24H
  const cutoff7d = nowMs - MS_7D
  const cutoff30d = nowMs - MS_30D
  const cutoff90d = nowMs - MS_90D

  const matched = filterSignalsForCompanyRollup(input.signals, input)
  const activeSignals = matched.filter((signal) => signal.suppression_state === "active")

  if (activeSignals.length === 0) {
    return {
      qa_marker: GROWTH_SIGNAL_MOMENTUM_QA_MARKER,
      total_signal_count: 0,
      high_urgency_count: 0,
      news_count: 0,
      job_posting_count: 0,
      hiring_signal_count: 0,
      job_change_count: 0,
      promotion_count: 0,
      people_signal_count: 0,
      watchlist_match_count: 0,
      average_signal_score: 0,
      max_signal_score: 0,
      latest_signal_at: null,
      latest_signal_summary: null,
      top_signal_types: [],
      top_categories: [],
      hiring_intensity: null,
      momentum_score: 0,
      momentum_label: "Quiet",
      momentum_base_score: 0,
      watchlist_boost: 0,
      evidence_count: 0,
      signal_ids: [],
      counts_24h: 0,
      counts_7d: 0,
      counts_30d: 0,
      counts_90d: 0,
      watchlist_matches: [],
    }
  }

  const sorted = [...activeSignals].sort(
    (a, b) => parseOccurredMs(b.occurred_at) - parseOccurredMs(a.occurred_at),
  )
  const latest = sorted[0]!

  const typeCounts = new Map<GrowthSignalType, number>()
  const categoryCounts = new Map<string, number>()
  let highUrgency = 0
  let newsCount = 0
  let jobPostingCount = 0
  let hiringCount = 0
  let jobChangeCount = 0
  let promotionCount = 0
  let scoreSum = 0
  let maxScore = 0
  let evidenceCount = 0

  for (const signal of activeSignals) {
    typeCounts.set(signal.signal_type, (typeCounts.get(signal.signal_type) ?? 0) + 1)
    const category = signal.category?.trim()
    if (category) categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1)
    if (HIGH_URGENCY.has(signal.urgency)) highUrgency += 1
    if (signal.signal_type === "news_event") newsCount += 1
    if (signal.signal_type === "job_posting") jobPostingCount += 1
    if (signal.signal_type === "hire") hiringCount += 1
    if (signal.signal_type === "job_change") jobChangeCount += 1
    if (signal.signal_type === "promotion") promotionCount += 1
    scoreSum += signal.signal_score
    maxScore = Math.max(maxScore, signal.signal_score)
    if (signal.evidence_summary?.trim()) evidenceCount += 1
  }

  const signalIds = new Set(activeSignals.map((signal) => signal.id))
  const watchlistMatchesRaw = (input.watchlist_matches ?? []).filter((match) =>
    signalIds.has(match.signal_id),
  )
  const watchlistById = new Map<string, { watchlist_id: string; watchlist_name: string }>()
  for (const match of watchlistMatchesRaw) {
    watchlistById.set(match.watchlist_id, {
      watchlist_id: match.watchlist_id,
      watchlist_name: match.watchlist_name,
    })
  }
  const watchlistMatches = [...watchlistById.values()]

  const hireSignal = activeSignals.find((signal) => signal.signal_type === "hire")
  const hiringIntensity =
    readHiringVelocityFromMetadata(hireSignal?.metadata)?.hiring_intensity ??
    readHiringVelocityFromMetadata(
      activeSignals.find((signal) => signal.signal_type === "job_posting")?.metadata,
    )?.hiring_intensity ??
    null

  const counts24h = countInWindow(activeSignals, cutoff24h, nowMs)
  const counts7d = countInWindow(activeSignals, cutoff7d, nowMs)
  const counts30d = countInWindow(activeSignals, cutoff30d, nowMs)
  const counts90d = countInWindow(activeSignals, cutoff90d, nowMs)

  const recentMaxScore = Math.min(30, Math.round((maxScore / 100) * 30))
  const volumeScore = computeVolumeScore(counts30d)
  const recencyScore = computeRecencyScore(parseOccurredMs(latest.occurred_at), nowMs)
  const urgencyScore = Math.min(15, highUrgency * 5)
  const watchlistBoost = Math.min(10, watchlistMatches.length * 5)
  const categoryBoost = computeCategoryBoost(activeSignals)

  const momentumBaseScore = recentMaxScore + volumeScore + recencyScore + urgencyScore + categoryBoost
  const momentumScore = Math.min(100, momentumBaseScore + watchlistBoost)

  const top_signal_types = [...typeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([type]) => type)

  const top_categories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category]) => category)

  const latestSummary =
    latest.evidence_summary?.trim() ||
    latest.title?.trim() ||
    `${formatSignalTypeLabel(latest.signal_type)} activity`

  return {
    qa_marker: GROWTH_SIGNAL_MOMENTUM_QA_MARKER,
    total_signal_count: activeSignals.length,
    high_urgency_count: highUrgency,
    news_count: newsCount,
    job_posting_count: jobPostingCount,
    hiring_signal_count: hiringCount,
    job_change_count: jobChangeCount,
    promotion_count: promotionCount,
    people_signal_count: jobChangeCount + promotionCount,
    watchlist_match_count: watchlistMatches.length,
    average_signal_score: Number((scoreSum / activeSignals.length).toFixed(2)),
    max_signal_score: maxScore,
    latest_signal_at: latest.occurred_at,
    latest_signal_summary: latestSummary,
    top_signal_types,
    top_categories,
    hiring_intensity: hiringIntensity,
    momentum_score: momentumScore,
    momentum_label: deriveMomentumLabel(momentumScore),
    momentum_base_score: momentumBaseScore,
    watchlist_boost: watchlistBoost,
    evidence_count: evidenceCount,
    signal_ids: activeSignals.map((signal) => signal.id),
    counts_24h: counts24h,
    counts_7d: counts7d,
    counts_30d: counts30d,
    counts_90d: counts90d,
    watchlist_matches: watchlistMatches,
  }
}

export function formatCompanySignalRollupSummary(rollup: GrowthCompanySignalRollup): string {
  if (rollup.total_signal_count === 0) return "—"
  const latest = rollup.latest_signal_summary ?? "Recent activity"
  return `${rollup.counts_30d} recent signal${rollup.counts_30d === 1 ? "" : "s"} · latest: ${latest}`
}
