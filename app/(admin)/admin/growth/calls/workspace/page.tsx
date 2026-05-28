"use client"

import { GrowthCallsOperatingShell } from "@/components/growth/growth-calls-operating-shell"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { useAdmin } from "@/lib/admin-store"
import { GROWTH_CALLS_RUNTIME_HARDENING_QA_MARKER } from "@/lib/growth/navigation/growth-workspace-consolidation"

export default function AdminGrowthCallWorkspacePage() {
  const { sessionIdentity } = useAdmin()
  const header = usePlatformAdminHeaderIdentity({
    displayName: sessionIdentity?.displayName,
    email: sessionIdentity?.email,
    platformRoleLabel: sessionIdentity?.platformRoleLabel,
  })

  return (
    <PlatformAdminPageShell header={header}>
      <div
        className="mx-auto flex max-w-[1700px] flex-col gap-6 px-6 py-8 xl:px-8"
        data-growth-calls-runtime-hardening-marker={GROWTH_CALLS_RUNTIME_HARDENING_QA_MARKER}
      >
        <PlatformAdminTabNav activeKey="growth_leads" />

        <GrowthSectionLayout>
          <GrowthCallsOperatingShell />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
