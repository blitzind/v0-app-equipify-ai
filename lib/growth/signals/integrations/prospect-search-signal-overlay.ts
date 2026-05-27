import type { GrowthSignalRow } from "@/lib/growth/signals/signal-types"
import {
  aggregateJobPostingsToHiringVelocity,
  type HiringVelocityMetrics,
} from "@/lib/growth/signals/hiring-velocity"
import { readHiringVelocityFromMetadata } from "@/lib/growth/signals/hiring-velocity-ui-helpers"

export type ProspectSearchHiringOverlay = {
  has_recent_hiring: boolean
  hiring_velocity_label: string | null
  jobs_signal_count: number
  hiring_intensity: string | null
  hiring_spike: boolean
}

function normalizeDomain(domain: string | null | undefined): string {
  return domain?.trim().toLowerCase() ?? ""
}

function normalizeCompanyName(name: string | null | undefined): string {
  return name?.trim().toLowerCase() ?? ""
}

function matchesCompany(
  signal: GrowthSignalRow,
  input: { domain?: string | null; company_name?: string | null },
): boolean {
  const domain = normalizeDomain(input.domain)
  const company = normalizeCompanyName(input.company_name)
  const signalDomain = normalizeDomain(signal.domain)
  const signalCompany = normalizeCompanyName(signal.company_name)

  if (domain && signalDomain && domain === signalDomain) return true
  if (company && signalCompany && company === signalCompany) return true
  return false
}

function readHiringVelocity(metadata: Record<string, unknown> | undefined): HiringVelocityMetrics | null {
  return readHiringVelocityFromMetadata(metadata)
}

/**
 * Read-only overlay helper for Prospect Search result rows.
 * Does not mutate UI — consumers decide whether to render badges.
 */
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
