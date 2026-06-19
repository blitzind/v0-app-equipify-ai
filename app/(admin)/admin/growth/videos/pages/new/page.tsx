"use client"

import { GrowthVideoPageCreatePanel } from "@/components/growth/videos/growth-video-page-create-panel"
import { GrowthSectionLayout } from "@/components/growth/growth-section-layout"
import {
  PlatformAdminPageShell,
  PlatformAdminTabNav,
  usePlatformAdminHeaderIdentity,
} from "@/components/admin/platform-admin-shell"
import { useAdmin } from "@/lib/admin-store"

export default function AdminGrowthVideosPagesNewPage() {
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
          <GrowthVideoPageCreatePanel />
        </GrowthSectionLayout>
      </div>
    </PlatformAdminPageShell>
  )
}
