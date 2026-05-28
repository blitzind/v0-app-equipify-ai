"use client"

import { useSearchParams } from "next/navigation"
import { GrowthCallCopilotDashboard } from "@/components/growth/growth-call-copilot-dashboard"
import { GrowthCallWorkspace } from "@/components/growth/growth-call-workspace"
import { GrowthCallsOperatingHeader } from "@/components/growth/growth-calls-operating-tabs"
import { GROWTH_WORKSPACE_CONSOLIDATION_QA_MARKER } from "@/lib/growth/navigation/growth-workspace-consolidation"

export function GrowthCallsOperatingShell() {
  const searchParams = useSearchParams()
  const view = searchParams.get("view")

  return (
    <div className="w-full min-w-0 space-y-4" data-growth-workspace-consolidation-marker={GROWTH_WORKSPACE_CONSOLIDATION_QA_MARKER}>
      <GrowthCallsOperatingHeader />

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
    </div>
  )
}
