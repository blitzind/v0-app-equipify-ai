import { normalizeDomain } from "@/lib/growth/company-identification/company-identification-normalize"
import {
  buildCompanySignalRollup,
  formatCompanySignalRollupSummary,
  GROWTH_SIGNAL_MOMENTUM_QA_MARKER,
  type GrowthCompanySignalRollup,
  type GrowthSignalWatchlistMatchRef,
} from "@/lib/growth/signals/company-signal-rollup"
import {
  aggregateJobPostingsToHiringVelocity,
  type HiringVelocityMetrics,
} from "@/lib/growth/signals/hiring-velocity"
import { readHiringVelocityFromMetadata } from "@/lib/growth/signals/hiring-velocity-ui-helpers"
import type { GrowthSignalRow } from "@/lib/growth/signals/signal-types"
import type { GrowthProspectSearchCompanyResult } from "@/lib/growth/prospect-search/prospect-search-types"

export type ProspectSearchHiringOverlay = {
  has_recent_hiring: boolean
  hiring_velocity_label: string | null
  jobs_signal_count: number
  hiring_intensity: string | null
  hiring_spike: boolean
}

export type ProspectSearchSignalIntelligenceOverlay = {
  qa_marker: typeof GROWTH_SIGNAL_MOMENTUM_QA_MARKER
  signal_momentum_score: number
  signal_momentum_label: GrowthCompanySignalRollup["momentum_label"]
  recent_signal_count: number
  latest_signal_summary: string | null
  top_signal_types: string[]
  hiring_intensity: string | null
  watchlist_matches: Array<{ watchlist_id: string; watchlist_name: string }>
  signal_evidence_count: number
  rollup: GrowthCompanySignalRollup
  hiring: ProspectSearchHiringOverlay
  display_summary: string
}

function normalizeCompanyName(name: string | null | undefined): string {
  return name?.trim().toLowerCase().replace(/\s+/g, " ") ?? ""
}

function domainFromWebsite(website: string | null | undefined): string | null {
  if (!website?.trim()) return null
  try {
    const url = website.startsWith("http") ? website : `https://${website}`
    return normalizeDomain(new URL(url).hostname)
  } catch {
    return normalizeDomain(website)
  }
}

export function resolveProspectSearchCompanyMatchKeys(
  row: Pick<
    GrowthProspectSearchCompanyResult,
    "website" | "company_name" | "growth_lead_id" | "prospect_id" | "customer_id"
  >,
): { domain: string | null; company_id: string | null; company_name: string | null } {
  return {
    domain: domainFromWebsite(row.website),
    company_id: row.growth_lead_id ?? row.prospect_id ?? row.customer_id ?? null,
    company_name: row.company_name?.trim() || null,
  }
}

function matchesCompany(
  signal: GrowthSignalRow,
  input: { domain?: string | null; company_id?: string | null; company_name?: string | null },
): boolean {
  const domain = normalizeDomain(input.domain)
  const signalDomain = normalizeDomain(signal.domain)

  if (input.company_id && signal.company_id && input.company_id === signal.company_id) {
    return true
  }

  if (domain && signalDomain && domain === signalDomain) return true

  if (!domain) return false

  const company = normalizeCompanyName(input.company_name)
  const signalCompany = normalizeCompanyName(signal.company_name)
  if (company && signalCompany && company === signalCompany && company.length >= 3) return true

  return false
}

function readHiringVelocity(metadata: Record<string, unknown> | undefined): HiringVelocityMetrics | null {
  return readHiringVelocityFromMetadata(metadata)
}

export function buildProspectSearchHiringOverlay(input: {
  domain?: string | null
  company_name?: string | null
  job_postings?: GrowthSignalRow[]
  hire_signals?: GrowthSignalRow[]
}): ProspectSearchHiringOverlay {
  const jobPostings = (input.job_postings ?? []).filter(
    (signal) => signal.signal_type === "job_posting" && matchesCompany(signal, input),
  )
  const hireSignals = (input.hire_signals ?? []).filter(
    (signal) => signal.signal_type === "hire" && matchesCompany(signal, input),
  )

  const derived =
    jobPostings.length > 0
      ? aggregateJobPostingsToHiringVelocity(jobPostings)[0]?.metrics ?? null
      : readHiringVelocity(hireSignals[0]?.metadata)

  const jobs_signal_count = derived?.open_role_count ?? jobPostings.length
  const hiring_spike = derived?.hiring_spike ?? false
  const hiring_intensity = derived?.hiring_intensity ?? null

  let hiring_velocity_label: string | null = null
  if (derived) {
    hiring_velocity_label = `${derived.hiring_velocity_7d} / 7d · ${derived.hiring_velocity_30d} / 30d`
  }

  return {
    has_recent_hiring: jobs_signal_count > 0 || hireSignals.length > 0,
    hiring_velocity_label,
    jobs_signal_count,
    hiring_intensity,
    hiring_spike,
  }
}

export function prospectSearchHiringBadgeLabel(overlay: ProspectSearchHiringOverlay): string | null {
  if (!overlay.has_recent_hiring) return null
  if (overlay.hiring_spike) return "Hiring spike"
  if (overlay.hiring_intensity === "high") return "Active hiring"
  if (overlay.jobs_signal_count > 0) return "Recent hiring"
  return null
}

export function buildProspectSearchSignalIntelligenceOverlay(input: {
  company: Pick<
    GrowthProspectSearchCompanyResult,
    "website" | "company_name" | "growth_lead_id" | "prospect_id" | "customer_id"
  >
  signals: GrowthSignalRow[]
  watchlist_matches?: GrowthSignalWatchlistMatchRef[]
  now?: Date
}): ProspectSearchSignalIntelligenceOverlay {
  const keys = resolveProspectSearchCompanyMatchKeys(input.company)
  const rollup = buildCompanySignalRollup({
    ...keys,
    signals: input.signals,
    watchlist_matches: input.watchlist_matches,
    now: input.now,
  })

  const hiring = buildProspectSearchHiringOverlay({
    ...keys,
    job_postings: input.signals,
    hire_signals: input.signals,
  })

  return {
    qa_marker: GROWTH_SIGNAL_MOMENTUM_QA_MARKER,
    signal_momentum_score: rollup.momentum_score,
    signal_momentum_label: rollup.momentum_label,
    recent_signal_count: rollup.counts_30d,
    latest_signal_summary: rollup.latest_signal_summary,
    top_signal_types: rollup.top_signal_types,
    hiring_intensity: rollup.hiring_intensity ?? hiring.hiring_intensity,
    watchlist_matches: rollup.watchlist_matches,
    signal_evidence_count: rollup.evidence_count,
    rollup,
    hiring,
    display_summary: formatCompanySignalRollupSummary(rollup),
  }
}

export function attachProspectSearchSignalIntelligence(
  company: GrowthProspectSearchCompanyResult,
  overlay: ProspectSearchSignalIntelligenceOverlay | null,
): GrowthProspectSearchCompanyResult {
  if (!overlay || overlay.rollup.total_signal_count === 0) {
    return {
      ...company,
      signal_momentum_score: 0,
      signal_momentum_label: "Quiet",
      recent_signal_count: 0,
      latest_signal_summary: null,
      top_signal_types: [],
      hiring_intensity: null,
      watchlist_matches: [],
      signal_evidence_count: 0,
      signal_intelligence_qa_marker: GROWTH_SIGNAL_MOMENTUM_QA_MARKER,
    }
  }

  return {
    ...company,
    signal_momentum_score: overlay.signal_momentum_score,
    signal_momentum_label: overlay.signal_momentum_label,
    recent_signal_count: overlay.recent_signal_count,
    latest_signal_summary: overlay.latest_signal_summary,
    top_signal_types: overlay.top_signal_types,
    hiring_intensity: overlay.hiring_intensity,
    watchlist_matches: overlay.watchlist_matches,
    signal_evidence_count: overlay.signal_evidence_count,
    signal_intelligence_qa_marker: GROWTH_SIGNAL_MOMENTUM_QA_MARKER,
  }
}

export function sortProspectSearchCompaniesBySignalMomentum(
  companies: GrowthProspectSearchCompanyResult[],
): GrowthProspectSearchCompanyResult[] {
  return [...companies].sort((a, b) => {
    const scoreDelta = (b.signal_momentum_score ?? 0) - (a.signal_momentum_score ?? 0)
    if (scoreDelta !== 0) return scoreDelta
    return (b.recent_signal_count ?? 0) - (a.recent_signal_count ?? 0)
  })
}
