"use client"

import { GrowthCallsOperatingShell } from "@/components/growth/growth-calls-operating-shell"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GROWTH_CALLS_RUNTIME_HARDENING_QA_MARKER } from "@/lib/growth/navigation/growth-workspace-consolidation"

export default function GrowthCallsPage() {
  return (
    <div
      className="mx-auto flex max-w-[1700px] flex-col gap-6 px-4 py-6 md:px-6 md:py-8 xl:px-8"
      data-growth-calls-runtime-hardening-marker={GROWTH_CALLS_RUNTIME_HARDENING_QA_MARKER}
    >
      <GrowthWorkspacePageHeader
        title="Calls Workspace"
        description="Operator call workspace — queue, dialer, and live session surfaces without provider configuration."
      />

      <GrowthCallsOperatingShell />
    </div>
  )
}
