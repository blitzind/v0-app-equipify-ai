"use client"

import { Suspense } from "react"
import { GrowthCallsOperatingErrorBoundary } from "@/components/growth/growth-calls-operating-error-boundary"
import { GrowthCallsOperatingHeader } from "@/components/growth/growth-calls-operating-tabs"
import { GrowthRealtimeLiveDashboard } from "@/components/growth/growth-realtime-live-dashboard"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { useAdmin } from "@/lib/admin-store"
import {
  GROWTH_CALLS_RUNTIME_HARDENING_QA_MARKER,
  GROWTH_WORKSPACE_CONSOLIDATION_QA_MARKER,
} from "@/lib/growth/navigation/growth-workspace-consolidation"

function LiveFallback() {
  return <p className="text-sm text-muted-foreground">Loading live monitor…</p>
}

export default function AdminGrowthLiveCallsPage() {
  const { sessionIdentity } = useAdmin()
  const header = usePlatformAdminHeaderIdentity({
    displayName: sessionIdentity?.displayName,
    email: sessionIdentity?.email,
    platformRoleLabel: sessionIdentity?.platformRoleLabel,
  })

  return (
    <PlatformAdminPageShell header={header}>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <PlatformAdminTabNav activeKey="growth_leads" />

        <GrowthSectionLayout>
          <div
            className="space-y-4"
            data-growth-workspace-consolidation-marker={GROWTH_WORKSPACE_CONSOLIDATION_QA_MARKER}
            data-growth-calls-runtime-hardening-marker={GROWTH_CALLS_RUNTIME_HARDENING_QA_MARKER}
          >
            <GrowthCallsOperatingHeader showDescription={false} />
            <p className="text-xs text-muted-foreground">
              Live call intelligence — embedded guidance and signals. Human in control; no autonomous disposition.
            </p>
            <GrowthCallsOperatingErrorBoundary surface="live">
              <Suspense fallback={<LiveFallback />}>
                <GrowthRealtimeLiveDashboard />
              </Suspense>
            </GrowthCallsOperatingErrorBoundary>
          </div>
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
