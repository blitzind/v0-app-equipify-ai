"use client"

import { GROWTH_PROSPECT_SEARCH_INTELLIGENCE_SCHEMA_QA_MARKER } from "@/lib/growth/schema-health/growth-schema-health-types"
import {
  formatGrowthSchemaHealthNotice,
  type GrowthSchemaHealthSummary,
} from "@/lib/growth/schema-health/growth-schema-health-types"

export function ProspectSearchSchemaHealthNotice({
  health,
  className,
}: {
  health: GrowthSchemaHealthSummary | null | undefined
  className?: string
}) {
  const message = formatGrowthSchemaHealthNotice(health)
  if (!message) return null

  return (
    <p
      className={className ?? "mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-950"}
      data-qa-marker={GROWTH_PROSPECT_SEARCH_INTELLIGENCE_SCHEMA_QA_MARKER}
      data-prospect-search-schema-health-notice="v1"
    >
      {message}
    </p>
  )
}
