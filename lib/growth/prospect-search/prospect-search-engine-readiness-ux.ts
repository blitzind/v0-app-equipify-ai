/** Prospect Search — Growth Engine readiness UX copy & tones (7.PS-D). Client-safe. */

import type {
  GrowthProspectSearchPrioritizationTier,
  GrowthProspectSearchReadinessLevel,
  GrowthProspectSearchResearchCompleteness,
} from "@/lib/growth/prospect-search/prospect-search-engine-readiness-types"
import {
  PROSPECT_SEARCH_PRIORITIZATION_TIER_LABELS,
  PROSPECT_SEARCH_RESEARCH_COMPLETENESS_LABELS,
} from "@/lib/growth/prospect-search/prospect-search-engine-readiness"

export const GROWTH_PROSPECT_SEARCH_READINESS_UX_QA_MARKER =
  "growth-prospect-search-readiness-ux-7-ps-d-v1" as const

export const PROSPECT_SEARCH_READINESS_FILTER_SECTION_LABEL = "Account readiness & prioritization"
export const PROSPECT_SEARCH_READINESS_FILTER_SECTION_HELPER =
  "Filter and sort by deterministic Growth Engine readiness — verified channels, committee, and company intelligence (not lead scoring)."
export const PROSPECT_SEARCH_READINESS_FILTER_NOTE =
  "Applied after contact intelligence hydration. Requires canonical company linkage for engine evidence."

export const PROSPECT_SEARCH_READINESS_PANEL_TITLE = "Research readiness"
export const PROSPECT_SEARCH_READINESS_SUMMARY_TITLE = "Account readiness"

export const PROSPECT_SEARCH_PRIORITIZATION_TIER_TONES: Record<
  GrowthProspectSearchPrioritizationTier,
  string
> = {
  ready_for_outreach: "border-emerald-400 bg-emerald-50 text-emerald-950",
  outreach_with_gaps: "border-amber-400 bg-amber-50 text-amber-950",
  research_first: "border-sky-400 bg-sky-50 text-sky-950",
  insufficient_data: "border-border bg-muted text-muted-foreground",
}

export const PROSPECT_SEARCH_RESEARCH_COMPLETENESS_TONES: Record<
  GrowthProspectSearchResearchCompleteness,
  string
> = {
  fully_researched: "border-emerald-300 bg-emerald-50/80 text-emerald-900",
  partially_researched: "border-sky-300 bg-sky-50/80 text-sky-900",
  research_recommended: "border-amber-300 bg-amber-50/80 text-amber-900",
  research_blocked: "border-rose-300 bg-rose-50/80 text-rose-900",
  insufficient_data: "border-border bg-muted text-muted-foreground",
}

export const PROSPECT_SEARCH_READINESS_LEVEL_TONES: Record<GrowthProspectSearchReadinessLevel, string> =
  {
    ready: "text-emerald-800",
    partial: "text-sky-800",
    gap: "text-amber-800",
    blocked: "text-rose-800",
  }

export function formatProspectSearchPrioritizationTier(
  tier: GrowthProspectSearchPrioritizationTier,
): string {
  return PROSPECT_SEARCH_PRIORITIZATION_TIER_LABELS[tier]
}

export function formatProspectSearchResearchCompleteness(
  value: GrowthProspectSearchResearchCompleteness,
): string {
  return PROSPECT_SEARCH_RESEARCH_COMPLETENESS_LABELS[value]
}
