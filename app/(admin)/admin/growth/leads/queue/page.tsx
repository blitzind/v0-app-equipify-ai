"use client"

import { useAdmin } from "@/lib/admin-store"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import { GrowthCallQueueWorkspace } from "@/components/growth/growth-call-queue-workspace"

export default function AdminGrowthCallQueuePage() {
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
          <GrowthCallQueueWorkspace />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
