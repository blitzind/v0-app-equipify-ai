"use client"

import { Suspense } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { GrowthCallCopilotDashboard } from "@/components/growth/growth-call-copilot-dashboard"
import { GrowthCallWorkspace } from "@/components/growth/growth-call-workspace"
import { GrowthCallsOperatingErrorBoundary } from "@/components/growth/growth-calls-operating-error-boundary"
import { GrowthCallsOperatingHeader } from "@/components/growth/growth-calls-operating-tabs"
import { useGrowthWorkspaceDefaultViewsReadonly } from "@/hooks/growth/use-growth-workspace-default-views-readonly"
import {
  GROWTH_CALLS_RUNTIME_HARDENING_QA_MARKER,
  GROWTH_WORKSPACE_CONSOLIDATION_QA_MARKER,
} from "@/lib/growth/navigation/growth-workspace-consolidation"
import { resolveGrowthCallsOperatingViewWithSavedDefault } from "@/lib/growth/settings/growth-workspace-settings-consumption"

function ShellFallback() {
  return <p className="text-sm text-muted-foreground">Loading calls…</p>
}

function GrowthCallsOperatingShellInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { defaultViews, loaded } = useGrowthWorkspaceDefaultViewsReadonly()
  const view = resolveGrowthCallsOperatingViewWithSavedDefault({
    pathname,
    viewParam: searchParams.get("view"),
    savedCallsDefaultView: loaded ? defaultViews.callsDefaultView : null,
  })

  return (
    <div
      className="w-full min-w-0 space-y-4"
      data-growth-workspace-consolidation-marker={GROWTH_WORKSPACE_CONSOLIDATION_QA_MARKER}
      data-growth-calls-runtime-hardening-marker={GROWTH_CALLS_RUNTIME_HARDENING_QA_MARKER}
    >
      <GrowthCallsOperatingHeader />

      <GrowthCallsOperatingErrorBoundary surface={view === "overview" ? "overview" : "workspace"}>
        {view === "overview" ? (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Embedded call intelligence — sessions, objections, buying signals, and post-call review. Assistive only;
              operator approval required.
            </p>
            <GrowthCallCopilotDashboard embedded />
          </div>
        ) : (
          <GrowthCallWorkspace hidePageHeader />
        )}
      </GrowthCallsOperatingErrorBoundary>
    </div>
  )
}

export function GrowthCallsOperatingShell() {
  return (
    <Suspense fallback={<ShellFallback />}>
      <GrowthCallsOperatingShellInner />
    </Suspense>
  )
}
