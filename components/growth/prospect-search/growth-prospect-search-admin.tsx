"use client"

import { useState } from "react"
import { GrowthAdminWidgetErrorBoundary } from "@/components/growth/growth-admin-widget-error-boundary"
import { ProspectSearchShell } from "@/components/growth/prospect-search/prospect-search-shell"
import { GROWTH_PROSPECT_SEARCH_RUNTIME_STABLE_QA_MARKER } from "@/lib/growth/admin-route-runtime-types"

/** Prospect Search admin — UX shell (Prompt 24). */
export function GrowthProspectSearchAdmin() {
  const [retryKey, setRetryKey] = useState(0)

  return (
    <GrowthAdminWidgetErrorBoundary
      label="Prospect search"
      qaMarker={GROWTH_PROSPECT_SEARCH_RUNTIME_STABLE_QA_MARKER}
      onRetry={() => setRetryKey((value) => value + 1)}
    >
      <ProspectSearchShell key={retryKey} />
    </GrowthAdminWidgetErrorBoundary>
  )
}
