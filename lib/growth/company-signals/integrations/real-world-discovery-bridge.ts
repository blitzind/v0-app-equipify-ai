import type { GrowthRealWorldCompanyCandidate } from "@/lib/growth/real-world-discovery/real-world-discovery-types"
import type { GrowthCompanySignalUiSummary } from "@/lib/growth/company-signals/company-signal-types"

/** Map stored real-world candidate fields for signal engine context. */
export function realWorldCandidateToSignalHints(
  row: GrowthRealWorldCompanyCandidate,
): {
  industry: string | null
  category: string | null
  description: string | null
} {
  return {
    industry: row.industry,
    category: row.category,
    description: row.description,
  }
}

export function mergeSignalSummaryIntoProspectSignals(
  existing: string[],
  summary: GrowthCompanySignalUiSummary,
): string[] {
  const added = [
    ...summary.technology_signals.slice(0, 2),
    ...summary.fit_indicators.slice(0, 1),
  ]
  return [...new Set([...existing, ...added])].slice(0, 8)
}
