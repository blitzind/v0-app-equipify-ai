/** Client-safe Growth schema health summary for Prospect Search intelligence surfaces. */

import {
  formatPlatformSchemaHealthNotice,
  mergePlatformSchemaHealthSummaries,
  shouldShowPlatformSchemaHealthWarning,
  summarizePlatformSchemaProbeResults,
  type PlatformSchemaHealthSummary,
  type PlatformSchemaObjectProbe,
  type PlatformSchemaProbeOutcome,
} from "@fuzor/observability"

export const GROWTH_PROSPECT_SEARCH_INTELLIGENCE_SCHEMA_QA_MARKER =
  "growth-prospect-search-intelligence-schema-v1" as const

export type GrowthSchemaHealthSummary = PlatformSchemaHealthSummary

export type GrowthSchemaProbeOutcome = PlatformSchemaProbeOutcome

export type GrowthSchemaObjectProbe = PlatformSchemaObjectProbe

export function shouldShowGrowthSchemaHealthWarning(
  health: Pick<GrowthSchemaHealthSummary, "ready" | "warning_message"> | null | undefined,
): boolean {
  return shouldShowPlatformSchemaHealthWarning(health)
}

export function formatGrowthSchemaHealthNotice(
  health: GrowthSchemaHealthSummary | null | undefined,
): string | null {
  return formatPlatformSchemaHealthNotice(health)
}

/** Pure probe aggregation — safe to import from tests and client components. */
export function summarizeGrowthSchemaProbeResults(input: {
  featureLabel: string
  objects: GrowthSchemaObjectProbe[]
  outcomes: GrowthSchemaProbeOutcome[]
}): GrowthSchemaHealthSummary {
  return summarizePlatformSchemaProbeResults(input)
}

export function mergeGrowthSchemaHealthSummaries(
  summaries: GrowthSchemaHealthSummary[],
): GrowthSchemaHealthSummary {
  return mergePlatformSchemaHealthSummaries(summaries)
}
