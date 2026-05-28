"use client"

import { Suspense, useState } from "react"
import { GrowthAdminWidgetErrorBoundary } from "@/components/growth/growth-admin-widget-error-boundary"
import { ProspectSearchShell } from "@/components/growth/prospect-search/prospect-search-shell"
import { GROWTH_PROSPECT_SEARCH_RUNTIME_STABLE_QA_MARKER } from "@/lib/growth/admin-route-runtime-types"
import {
  GROWTH_PROSPECT_SEARCH_RUNTIME_FIX_QA_MARKER,
  GROWTH_PROSPECT_SEARCH_RENDER_LOOP_FIX_QA_MARKER,
} from "@/lib/growth/prospect-search/prospect-search-runtime"
import { GROWTH_BASE64URL_RUNTIME_FIX_QA_MARKER } from "@/lib/encoding/base64url-runtime"

function ProspectSearchAdminFallback() {
  return <p className="text-sm text-muted-foreground">Loading prospect search…</p>
}

/** Prospect Search admin — UX shell (Prompt 24). */
export function GrowthProspectSearchAdmin() {
  const [retryKey, setRetryKey] = useState(0)

  return (
    <div
      data-prospect-search-runtime-fix-marker={GROWTH_PROSPECT_SEARCH_RUNTIME_FIX_QA_MARKER}
      data-prospect-search-render-loop-fix-marker={GROWTH_PROSPECT_SEARCH_RENDER_LOOP_FIX_QA_MARKER}
      data-base64url-runtime-fix-marker={GROWTH_BASE64URL_RUNTIME_FIX_QA_MARKER}
    >
      <GrowthAdminWidgetErrorBoundary
        label="Prospect search"
        qaMarker={GROWTH_PROSPECT_SEARCH_RUNTIME_STABLE_QA_MARKER}
        onRetry={() => setRetryKey((value) => value + 1)}
      >
        <Suspense fallback={<ProspectSearchAdminFallback />}>
          <ProspectSearchShell key={retryKey} />
        </Suspense>
      </GrowthAdminWidgetErrorBoundary>
    </div>
  )
}
