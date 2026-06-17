"use client"

import { Suspense } from "react"
import { GrowthCallsOperatingShell } from "@/components/growth/growth-calls-operating-shell"
import { GrowthCallsDefaultViewSync } from "@/components/growth/calls/growth-calls-default-view-sync"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GROWTH_CALLS_RUNTIME_HARDENING_QA_MARKER } from "@/lib/growth/navigation/growth-workspace-consolidation"

export default function GrowthCallsWorkspacePage() {
  return (
    <div
      className="mx-auto flex max-w-[1700px] flex-col gap-6 px-4 py-6 md:px-6 md:py-8 xl:px-8"
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
    </div>
  )
}
