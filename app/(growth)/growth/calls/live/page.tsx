"use client"

import { Suspense } from "react"
import { Radio } from "lucide-react"
import { GrowthCallsOperatingErrorBoundary } from "@/components/growth/growth-calls-operating-error-boundary"
import { GrowthCallsOperatingHeader } from "@/components/growth/growth-calls-operating-tabs"
import { GrowthRealtimeLiveDashboard } from "@/components/growth/growth-realtime-live-dashboard"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import {
  GROWTH_CALLS_RUNTIME_HARDENING_QA_MARKER,
  GROWTH_WORKSPACE_CONSOLIDATION_QA_MARKER,
} from "@/lib/growth/navigation/growth-workspace-consolidation"

function LiveFallback() {
  return <p className="text-sm text-muted-foreground">Loading live monitor…</p>
}

export default function GrowthCallsLivePage() {
  return (
    <div
      className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8"
      data-growth-workspace-consolidation-marker={GROWTH_WORKSPACE_CONSOLIDATION_QA_MARKER}
      data-growth-calls-runtime-hardening-marker={GROWTH_CALLS_RUNTIME_HARDENING_QA_MARKER}
    >
      <GrowthWorkspacePageHeader
        title="Live monitor"
        description="Live call intelligence — embedded guidance and signals. Human in control; no autonomous disposition."
        icon={Radio}
        iconClassName="bg-sky-50 text-sky-700"
      />

      <div className="space-y-4">
        <GrowthCallsOperatingHeader showDescription={false} />
        <GrowthCallsOperatingErrorBoundary surface="live">
          <Suspense fallback={<LiveFallback />}>
            <GrowthRealtimeLiveDashboard />
          </Suspense>
        </GrowthCallsOperatingErrorBoundary>
      </div>
    </div>
  )
}
