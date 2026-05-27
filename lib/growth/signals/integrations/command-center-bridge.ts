import type { GrowthSignalRow } from "@/lib/growth/signals/signal-types"
import {
  formatDepartmentDistribution,
  readHiringVelocityFromMetadata,
} from "@/lib/growth/signals/hiring-velocity-ui-helpers"

export type CommandCenterHiringMetrics = {
  recent_hiring_signals_count: number
  top_hiring_companies: Array<{
    company_name: string
    domain: string | null
    open_role_count: number
    hiring_spike: boolean
  }>
  hiring_spikes: Array<{
    company_name: string
    domain: string | null
    hiring_velocity_7d: number
  }>
}

/**
 * Read-only Command Center hiring metrics helper (Milestone C).
 */
export function buildCommandCenterHiringMetrics(input: {
  job_postings?: GrowthSignalRow[]
  hire_signals?: GrowthSignalRow[]
}): CommandCenterHiringMetrics {
  const jobPostings = (input.job_postings ?? []).filter((signal) => signal.signal_type === "job_posting")
  const hireSignals = (input.hire_signals ?? []).filter((signal) => signal.signal_type === "hire")

  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recentJobCount = jobPostings.filter((signal) => Date.parse(signal.occurred_at) >= recentCutoff).length
  const recentHireCount = hireSignals.filter((signal) => Date.parse(signal.occurred_at) >= recentCutoff).length

  const top_hiring_companies = hireSignals
    .map((signal) => {
      const metrics = readHiringVelocityFromMetadata(signal.metadata)
      return {
        company_name: signal.company_name?.trim() || signal.domain?.trim() || "—",
        domain: signal.domain,
        open_role_count: metrics?.open_role_count ?? 0,
        hiring_spike: metrics?.hiring_spike ?? false,
      }
    })
    .sort((a, b) => b.open_role_count - a.open_role_count)
    .slice(0, 5)

  const hiring_spikes = hireSignals
    .map((signal) => {
      const metrics = readHiringVelocityFromMetadata(signal.metadata)
      if (!metrics?.hiring_spike) return null
      return {
        company_name: signal.company_name?.trim() || signal.domain?.trim() || "—",
        domain: signal.domain,
        hiring_velocity_7d: metrics.hiring_velocity_7d,
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)

  return {
    recent_hiring_signals_count: recentJobCount + recentHireCount,
    top_hiring_companies,
    hiring_spikes,
  }
}

/**
 * Milestone A stub extended — ranked feed remains lightweight.
 */
export function buildCommandCenterSignalFeed(
  signals: GrowthSignalRow[],
): { title: string; items: Array<{ id: string; label: string; score: number }> } {
  return {
    title: "Intent signals (foundation preview)",
    items: signals.slice(0, 5).map((signal) => ({
      id: signal.id,
      label: signal.evidence_summary || signal.company_name || signal.signal_type,
      score: signal.signal_score,
    })),
  }
}

export function formatCommandCenterHiringCompanyLabel(signal: GrowthSignalRow): string {
  const metrics = readHiringVelocityFromMetadata(signal.metadata)
  const company = signal.company_name?.trim() || signal.domain?.trim() || "—"
  if (!metrics) return company
  const departments = formatDepartmentDistribution(metrics.department_distribution, 2)
  return `${company} · ${metrics.open_role_count} roles · ${departments}`
}
