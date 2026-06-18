"use client"

import { Suspense } from "react"
import { GrowthCallsOperatingShell } from "@/components/growth/growth-calls-operating-shell"
import { GrowthCallsDefaultViewSync } from "@/components/growth/calls/growth-calls-default-view-sync"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GROWTH_CALLS_RUNTIME_HARDENING_QA_MARKER } from "@/lib/growth/navigation/growth-workspace-consolidation"
import { GrowthWorkspacePageContent } from "@/components/growth/shell/growth-workspace-page-content"

export default function GrowthCallsWorkspacePage() {
  return (
    <GrowthWorkspacePageContent
      data-growth-calls-runtime-hardening-marker={GROWTH_CALLS_RUNTIME_HARDENING_QA_MARKER}
    >
      <Suspense fallback={null}>
        <GrowthCallsDefaultViewSync />
      </Suspense>
      <GrowthWorkspacePageHeader
        title="Call Workspace"
        description="Unified call operations — dialer, queue, embedded intelligence, briefing, and post-call review."
      />

      <GrowthCallsOperatingShell />
    </GrowthWorkspacePageContent>
  )
}
